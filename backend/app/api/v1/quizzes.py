import json
from typing import Any, List
from fastapi import APIRouter, HTTPException
from app.api.deps import SessionDep, CurrentUser
from app.models.quiz import Quiz, QuizQuestion, QuizAttempt
from app.models.user import User
from app.schemas.quiz import (
    QuizCreate, 
    QuizResponse, 
    QuizDetailResponse, 
    QuizQuestionResponse, 
    QuizSubmit, 
    QuizAttemptResponse
)

router = APIRouter()

@router.get("/", response_model=List[QuizResponse])
def get_quizzes(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    List all quizzes available for the current user.
    """
    quizzes = session.query(Quiz).order_by(Quiz.created_at.desc()).offset(skip).limit(limit).all()
    
    # Filter by user role if student/intern/employee
    if current_user.role not in ["admin", "formateur"]:
        filtered = []
        for q in quizzes:
            target_list = [r.strip().lower() for r in (q.target_roles or "").split(",")]
            if current_user.role.lower() in target_list or "all" in target_list or not q.target_roles:
                filtered.append(q)
        quizzes = filtered

    # Fetch attempts for current user to indicate completion status
    user_attempts = session.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    attempts_map = {}
    for a in user_attempts:
        if a.quiz_id not in attempts_map or a.percentage > attempts_map[a.quiz_id]:
            attempts_map[a.quiz_id] = a.percentage

    results = []
    for q in quizzes:
        total_pts = sum(question.points for question in q.questions)
        creator_email = q.creator.email if q.creator else None
        
        is_completed = q.id in attempts_map
        best_pct = attempts_map.get(q.id)

        results.append(
            QuizResponse(
                id=q.id,
                title=q.title,
                description=q.description,
                course_id=q.course_id,
                created_by_id=q.created_by_id,
                creator_email=creator_email,
                target_roles=q.target_roles or "étudiant,stagiaire,employer",
                time_limit_minutes=q.time_limit_minutes,
                created_at=q.created_at,
                question_count=len(q.questions),
                total_points=total_pts,
                is_completed=is_completed,
                best_percentage=best_pct
            )
        )
    return results

@router.get("/{quiz_id}", response_model=QuizDetailResponse)
def get_quiz_detail(
    quiz_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get quiz details with questions.
    Anti-cheat: correct answer indices are omitted for students taking the test.
    """
    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz introuvable.")

    is_manager = current_user.role in ["formateur", "admin"]
    
    questions_data = []
    for q in quiz.questions:
        try:
            options_list = json.loads(q.options)
        except Exception:
            options_list = [q.options]

        questions_data.append(
            QuizQuestionResponse(
                id=q.id,
                question_text=q.question_text,
                options=options_list,
                points=q.points,
                correct_option_index=q.correct_option_index if is_manager else None
            )
        )

    total_pts = sum(q.points for q in quiz.questions)
    
    # Check attempt
    best_attempt = session.query(QuizAttempt).filter(
        QuizAttempt.quiz_id == quiz.id, 
        QuizAttempt.user_id == current_user.id
    ).order_by(QuizAttempt.percentage.desc()).first()

    return QuizDetailResponse(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        course_id=quiz.course_id,
        created_by_id=quiz.created_by_id,
        creator_email=quiz.creator.email if quiz.creator else None,
        target_roles=quiz.target_roles or "étudiant,stagiaire,employer",
        time_limit_minutes=quiz.time_limit_minutes,
        created_at=quiz.created_at,
        question_count=len(quiz.questions),
        total_points=total_pts,
        is_completed=best_attempt is not None,
        best_percentage=best_attempt.percentage if best_attempt else None,
        questions=questions_data
    )

@router.post("/", response_model=QuizResponse)
def create_quiz(
    *,
    session: SessionDep,
    quiz_in: QuizCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new quiz with questions. Strictly restricted to Formateurs and Admins.
    """
    if current_user.role not in ["formateur", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs ont le droit de créer ou générer des quiz."
        )

    if not quiz_in.questions or len(quiz_in.questions) == 0:
        raise HTTPException(status_code=400, detail="Un quiz doit comporter au moins une question.")

    quiz = Quiz(
        title=quiz_in.title.strip(),
        description=quiz_in.description.strip() if quiz_in.description else None,
        course_id=quiz_in.course_id,
        created_by_id=current_user.id,
        target_roles=quiz_in.target_roles or "étudiant,stagiaire,employer",
        time_limit_minutes=quiz_in.time_limit_minutes
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)

    total_pts = 0
    for q_in in quiz_in.questions:
        q_obj = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_in.question_text.strip(),
            options=json.dumps(q_in.options, ensure_ascii=False),
            correct_option_index=q_in.correct_option_index,
            points=q_in.points or 1
        )
        total_pts += q_obj.points
        session.add(q_obj)

    session.commit()
    session.refresh(quiz)

    return QuizResponse(
        id=quiz.id,
        title=quiz.title,
        description=quiz.description,
        course_id=quiz.course_id,
        created_by_id=quiz.created_by_id,
        creator_email=current_user.email,
        target_roles=quiz.target_roles,
        time_limit_minutes=quiz.time_limit_minutes,
        created_at=quiz.created_at,
        question_count=len(quiz.questions),
        total_points=total_pts,
        is_completed=False,
        best_percentage=None
    )

@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a quiz. Strictly restricted to Formateurs and Admins.
    """
    if current_user.role not in ["formateur", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs peuvent supprimer un quiz."
        )

    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz introuvable.")

    session.delete(quiz)
    session.commit()
    return {"message": "Quiz supprimé avec succès.", "id": quiz_id}

@router.post("/{quiz_id}/submit")
def submit_quiz(
    quiz_id: int,
    submission: QuizSubmit,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Submit answers for a quiz. Calculate score, record attempt, and return detailed review.
    """
    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz introuvable.")

    score = 0
    max_score = 0
    detailed_review = []

    for q in quiz.questions:
        max_score += q.points
        user_choice = submission.answers.get(q.id)
        is_correct = (user_choice is not None and user_choice == q.correct_option_index)
        if is_correct:
            score += q.points

        try:
            options_list = json.loads(q.options)
        except Exception:
            options_list = [q.options]

        detailed_review.append({
            "question_id": q.id,
            "question_text": q.question_text,
            "options": options_list,
            "selected_index": user_choice,
            "correct_index": q.correct_option_index,
            "is_correct": is_correct,
            "points": q.points if is_correct else 0,
            "max_points": q.points
        })

    percentage = round((score / max_score * 100), 1) if max_score > 0 else 0.0

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        score=score,
        max_score=max_score,
        percentage=percentage,
        answers=json.dumps(submission.answers)
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "quiz_id": quiz.id,
        "quiz_title": quiz.title,
        "score": score,
        "max_score": max_score,
        "percentage": percentage,
        "passed": percentage >= 60.0,
        "review": detailed_review
    }

@router.get("/{quiz_id}/results", response_model=List[QuizAttemptResponse])
def get_quiz_results(
    quiz_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    View all student results/attempts for a specific quiz.
    Strictly restricted to Formateurs and Admins.
    """
    if current_user.role not in ["formateur", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs peuvent consulter la liste des résultats des apprenants."
        )

    attempts = session.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz_id).order_by(QuizAttempt.completed_at.desc()).all()
    results = []
    for a in attempts:
        results.append(
            QuizAttemptResponse(
                id=a.id,
                quiz_id=a.quiz_id,
                quiz_title=a.quiz.title if a.quiz else "",
                user_id=a.user_id,
                user_email=a.user.email if a.user else "Utilisateur supprimé",
                user_role=a.user.role if a.user else "étudiant",
                score=a.score,
                max_score=a.max_score,
                percentage=a.percentage,
                completed_at=a.completed_at
            )
        )
    return results

@router.get("/attempts/my", response_model=List[QuizAttemptResponse])
def get_my_attempts(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get past quiz attempts for the current user.
    """
    attempts = session.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).order_by(QuizAttempt.completed_at.desc()).all()
    results = []
    for a in attempts:
        results.append(
            QuizAttemptResponse(
                id=a.id,
                quiz_id=a.quiz_id,
                quiz_title=a.quiz.title if a.quiz else "",
                user_id=a.user_id,
                user_email=current_user.email,
                user_role=current_user.role,
                score=a.score,
                max_score=a.max_score,
                percentage=a.percentage,
                completed_at=a.completed_at
            )
        )
    return results
