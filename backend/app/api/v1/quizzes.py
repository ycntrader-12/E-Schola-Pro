import json
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.schemas.quiz import (
    QuizAttemptDetailResponse,
    QuizAttemptResponse,
    QuizCreate,
    QuizDetailResponse,
    QuizGlobalReportResponse,
    QuizQuestionResponse,
    QuizQuestionReviewItem,
    QuizResponse,
    QuizSubmit,
)

router = APIRouter()
ADMIN_ROLES = ["admin", "admin_manager"]
STAFF_ROLES = ["admin", "admin_manager", "formateur", "pedagogique", "dg_rh"]


@router.get("/", response_model=list[QuizResponse])
def get_quizzes(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    List all quizzes available for the current user.
    """
    quizzes = (
        session.query(Quiz)
        .order_by(Quiz.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Filter by user role if student/intern/employee
    if current_user.role not in STAFF_ROLES:
        filtered = []
        for q in quizzes:
            target_list = [r.strip().lower() for r in (q.target_roles or "").split(",")]
            if (
                current_user.role.lower() in target_list
                or "all" in target_list
                or not q.target_roles
            ):
                filtered.append(q)
        quizzes = filtered

    # Fetch attempts for current user to indicate completion status
    user_attempts = (
        session.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    )
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
                best_percentage=best_pct,
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

    is_manager = current_user.role in STAFF_ROLES

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
                correct_option_index=q.correct_option_index if is_manager else None,
            )
        )

    total_pts = sum(q.points for q in quiz.questions)

    # Check attempt
    best_attempt = (
        session.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.percentage.desc())
        .first()
    )

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
        questions=questions_data,
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
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs ont le droit de créer ou générer des quiz.",
        )

    if not quiz_in.questions or len(quiz_in.questions) == 0:
        raise HTTPException(
            status_code=400, detail="Un quiz doit comporter au moins une question."
        )

    quiz = Quiz(
        title=quiz_in.title.strip(),
        description=quiz_in.description.strip() if quiz_in.description else None,
        course_id=quiz_in.course_id,
        created_by_id=current_user.id,
        target_roles=quiz_in.target_roles or "étudiant,stagiaire,employer",
        time_limit_minutes=quiz_in.time_limit_minutes,
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)

    total_pts = 0
    for q_in in quiz_in.questions:
        q_model = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q_in.question_text.strip(),
            options=json.dumps(q_in.options, ensure_ascii=False),
            correct_option_index=q_in.correct_option_index,
            points=q_in.points or 1,
        )
        total_pts += q_model.points
        session.add(q_model)

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
        best_percentage=None,
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
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs peuvent supprimer un quiz.",
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
        user_choice = submission.answers.get(str(q.id))
        is_correct = user_choice is not None and user_choice == q.correct_option_index
        if is_correct:
            score += q.points

        try:
            options_list = json.loads(q.options)
        except Exception:
            options_list = [q.options]

        detailed_review.append(
            {
                "question_id": q.id,
                "question_text": q.question_text,
                "options": options_list,
                "selected_index": user_choice,
                "correct_index": q.correct_option_index,
                "is_correct": is_correct,
                "points": q.points if is_correct else 0,
                "max_points": q.points,
            }
        )

    percentage = round((score / max_score * 100), 1) if max_score > 0 else 0.0

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=current_user.id,
        score=score,
        max_score=max_score,
        percentage=percentage,
        answers=json.dumps(submission.answers),
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
        "review": detailed_review,
    }


@router.get("/{quiz_id}/results", response_model=list[QuizAttemptResponse])
def get_quiz_results(
    quiz_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    View all student results/attempts for a specific quiz.
    Strictly restricted to Formateurs and Admins.
    """
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et les administrateurs peuvent consulter la liste des résultats des apprenants.",
        )

    attempts = (
        session.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )
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
                completed_at=a.completed_at,
            )
        )
    return results


@router.get("/attempts/my", response_model=list[QuizAttemptResponse])
def get_my_attempts(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get past quiz attempts for the current user.
    """
    attempts = (
        session.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )
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
                completed_at=a.completed_at,
            )
        )
    return results


@router.get("/attempts/{attempt_id}/details", response_model=QuizAttemptDetailResponse)
def get_attempt_details_for_pdf(
    attempt_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get full attempt details with question-by-question review for PDF generation.
    Strict Role Authorization:
    - Learners (étudiant, stagiaire, employer): strictly allowed ONLY for their own attempt.
    - Staff (formateur, admin, pedagogique, dg_rh): allowed for any student attempt.
    """
    attempt = session.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Résultat d'évaluation introuvable.")

    # Strict ownership check for learners
    if current_user.role not in STAFF_ROLES and attempt.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Accès refusé. Les apprenants ne peuvent exporter que leurs propres résultats de quiz.",
        )

    quiz = attempt.quiz
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz associé introuvable.")

    user = attempt.user
    user_email = user.email if user else "Inconnu"
    user_role = user.role if user else "étudiant"
    user_group = user.group_name if user else None

    # Parse stored answers
    user_answers = {}
    if attempt.answers:
        try:
            raw_answers = json.loads(attempt.answers)
            # Keys might be ints or strings
            user_answers = {str(k): int(v) for k, v in raw_answers.items()}
        except Exception:
            user_answers = {}

    detailed_review = []
    for q in quiz.questions:
        try:
            options_list = json.loads(q.options)
        except Exception:
            options_list = [q.options]

        user_choice = user_answers.get(str(q.id))
        is_correct = user_choice is not None and user_choice == q.correct_option_index

        detailed_review.append(
            QuizQuestionReviewItem(
                question_id=q.id,
                question_text=q.question_text,
                options=options_list,
                selected_index=user_choice,
                correct_index=q.correct_option_index,
                is_correct=is_correct,
                points=q.points if is_correct else 0,
                max_points=q.points,
            )
        )

    return QuizAttemptDetailResponse(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        quiz_description=quiz.description,
        time_limit_minutes=quiz.time_limit_minutes,
        creator_email=quiz.creator.email if quiz.creator else None,
        user_id=attempt.user_id,
        user_email=user_email,
        user_role=user_role,
        user_group=user_group,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=attempt.percentage,
        passed=attempt.percentage >= 60.0,
        completed_at=attempt.completed_at,
        questions_review=detailed_review,
    )


@router.get("/{quiz_id}/report-data", response_model=QuizGlobalReportResponse)
def get_quiz_global_report_for_pdf(
    quiz_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get full aggregated report of a quiz for formateurs and admins to export as PDF.
    Strictly restricted to STAFF_ROLES.
    """
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et administrateurs peuvent exporter le rapport global des résultats.",
        )

    quiz = session.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz introuvable.")

    attempts = (
        session.query(QuizAttempt)
        .filter(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.completed_at.desc())
        .all()
    )

    total_pts = sum(q.points for q in quiz.questions)
    total_attempts = len(attempts)
    passed_count = sum(1 for a in attempts if a.percentage >= 60.0)

    avg_score = round(sum(a.score for a in attempts) / total_attempts, 2) if total_attempts > 0 else 0.0
    avg_pct = round(sum(a.percentage for a in attempts) / total_attempts, 2) if total_attempts > 0 else 0.0
    highest_pct = max((a.percentage for a in attempts), default=0.0)
    lowest_pct = min((a.percentage for a in attempts), default=0.0)
    success_rate = round((passed_count / total_attempts * 100), 1) if total_attempts > 0 else 0.0

    attempts_data = [
        QuizAttemptResponse(
            id=a.id,
            quiz_id=a.quiz_id,
            quiz_title=quiz.title,
            user_id=a.user_id,
            user_email=a.user.email if a.user else "Inconnu",
            user_role=a.user.role if a.user else "étudiant",
            score=a.score,
            max_score=a.max_score,
            percentage=a.percentage,
            completed_at=a.completed_at,
        )
        for a in attempts
    ]

    return QuizGlobalReportResponse(
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        created_at=quiz.created_at,
        creator_email=quiz.creator.email if quiz.creator else None,
        target_roles=quiz.target_roles or "Tous",
        total_points=total_pts,
        total_attempts=total_attempts,
        passed_count=passed_count,
        average_score=avg_score,
        average_percentage=avg_pct,
        highest_percentage=highest_pct,
        lowest_percentage=lowest_pct,
        success_rate=success_rate,
        attempts=attempts_data,
    )

