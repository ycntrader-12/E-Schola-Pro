import os
import uuid
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import CurrentUser, SessionDep
from app.core.roles import STAFF_ROLES, is_staff, require_staff
from app.models.assessment import (
    Assessment,
    AssessmentAssignment,
    AssessmentType,
    AttemptStatus,
    Choice,
    Question,
    UserAnswer,
    UserAttempt,
    UserCertificate,
)
from app.models.group import Group, GroupMember
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentDetailOut,
    AssessmentOut,
    AssessmentUpdate,
    AssignedGroupOut,
    AttemptReviewOut,
    ChoiceIn,
    ChoiceOut,
    ChoiceReviewOut,
    QuestionIn,
    QuestionOut,
    QuestionReviewOut,
    StartAttemptResponse,
    SubmitAnswersRequest,
    UserCertificateOut,
)
from app.services.certificate_service import generate_certificate_document

router = APIRouter()

CREATOR_ROLES = STAFF_ROLES


def is_creator(user: Any) -> bool:
    return is_staff(user)


def check_user_access_to_assessment(user: Any, assessment: Assessment, db: Session) -> bool:
    """
    Vérifie si l'utilisateur a le droit d'accéder à cette évaluation :
    - Les créateurs/administrateurs ont un accès global universel.
    - Les apprenants doivent appartenir à au moins un des groupes assignés.
      Si aucune assignation de groupe n'est spécifiée, l'évaluation est accessible à tous.
    """
    if is_creator(user):
        return True

    # Vérification des groupes assignés
    assignments = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.assessment_id == assessment.id
    ).all()

    if not assignments:
        # Aucune restriction de groupe = ouvert
        return True

    assigned_group_ids = {a.group_id for a in assignments}

    # 1. Vérifier user.group_name (matching par nom de groupe)
    if user.group_name:
        matched_group = db.query(Group).filter(
            func.lower(Group.name) == func.lower(user.group_name)
        ).first()
        if matched_group and matched_group.id in assigned_group_ids:
            return True

    # 2. Vérifier table GroupMember
    is_member = db.query(GroupMember).filter(
        GroupMember.user_id == user.id,
        GroupMember.group_id.in_(assigned_group_ids)
    ).first()

    return is_member is not None


# ============================================================================
# 1. LIST & GET ASSESSMENTS
# ============================================================================
@router.get("/", response_model=List[AssessmentOut])
def get_assessments(
    db: SessionDep,
    current_user: CurrentUser,
    type_filter: Optional[str] = None,
) -> Any:
    """
    Liste les évaluations :
    - Créateurs : Toutes les évaluations avec métriques.
    - Apprenants : Uniquement les évaluations ciblées pour leur groupe.
    """
    query = db.query(Assessment).order_by(Assessment.created_at.desc())

    if type_filter and type_filter.upper() in ["QUIZ", "CERTIFICATION"]:
        query = query.filter(Assessment.type == type_filter.upper())

    all_assessments = query.all()
    results = []

    # Pré-chargement des tentatives de l'utilisateur pour enrichir les cartes
    user_attempts = db.query(UserAttempt).filter(
        UserAttempt.user_id == current_user.id
    ).order_by(UserAttempt.started_at.desc()).all()

    attempts_by_assessment = {}
    for att in user_attempts:
        if att.assessment_id not in attempts_by_assessment:
            attempts_by_assessment[att.assessment_id] = []
        attempts_by_assessment[att.assessment_id].append(att)

    for asm in all_assessments:
        if not check_user_access_to_assessment(current_user, asm, db):
            continue

        # Calcul des groupes assignés
        assignments = db.query(AssessmentAssignment).filter(
            AssessmentAssignment.assessment_id == asm.id
        ).all()
        assigned_groups = []
        for a in assignments:
            if a.group:
                assigned_groups.append(
                    AssignedGroupOut(id=a.group.id, name=a.group.name, level=a.group.level)
                )

        # Nombre de questions et points totaux
        questions = db.query(Question).filter(Question.assessment_id == asm.id).all()
        q_count = len(questions)
        total_pts = sum(q.points for q in questions)

        # Statut pour l'utilisateur connecté
        asm_attempts = attempts_by_assessment.get(asm.id, [])
        has_completed = any(att.status == AttemptStatus.COMPLETED for att in asm_attempts)
        completed_scores = [float(att.score_percentage) for att in asm_attempts if att.score_percentage is not None and att.status == AttemptStatus.COMPLETED]
        best_score = max(completed_scores) if completed_scores else None
        is_passed = any(att.is_passed for att in asm_attempts)
        latest_attempt_id = asm_attempts[0].id if asm_attempts else None

        # Certificat si présent
        cert = db.query(UserCertificate).filter(
            UserCertificate.user_id == current_user.id,
            UserCertificate.assessment_id == asm.id
        ).order_by(UserCertificate.issued_at.desc()).first()
        cert_url = cert.certificate_file_url if cert else None

        creator_name = asm.creator.username or asm.creator.email if asm.creator else "E-Schola Pro"

        results.append(
            AssessmentOut(
                id=asm.id,
                title=asm.title,
                description=asm.description,
                type=asm.type,
                is_standard_recommended=asm.is_standard_recommended,
                time_limit_minutes=asm.time_limit_minutes,
                passing_score_percentage=float(asm.passing_score_percentage),
                show_corrections_after=asm.show_corrections_after,
                certificate_template_url=asm.certificate_template_url,
                created_by=asm.created_by,
                creator_name=creator_name,
                created_at=asm.created_at,
                updated_at=asm.updated_at,
                question_count=q_count,
                total_points=total_pts,
                assigned_groups=assigned_groups,
                has_completed=has_completed,
                best_score=best_score,
                is_passed=is_passed,
                latest_attempt_id=latest_attempt_id,
                certificate_url=cert_url,
            )
        )

    return results


# ============================================================================
# 2. CREATE ASSESSMENT (CREATORS ONLY)
# ============================================================================
@router.post("/", response_model=AssessmentOut)
def create_assessment(
    assessment_in: AssessmentCreate,
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Création d'une évaluation (Quiz ou Certification) avec options de barème,
    assignation de cohortes et option « Prestation Standard Recommandée ».
    Réservé exclusivement aux rôles Créateurs (Admin / Formateurs).
    """
    if not is_creator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs et formateurs peuvent créer des évaluations.",
        )

    # Application de la « Prestation Standard Recommandée » en 1 clic
    passing_score = assessment_in.passing_score_percentage
    time_limit = assessment_in.time_limit_minutes
    show_corr = assessment_in.show_corrections_after

    if assessment_in.is_standard_recommended:
        passing_score = 70.0
        time_limit = 30
        show_corr = True

    new_assessment = Assessment(
        id=str(uuid.uuid4()),
        title=assessment_in.title,
        description=assessment_in.description,
        type=assessment_in.type,
        is_standard_recommended=assessment_in.is_standard_recommended,
        time_limit_minutes=time_limit,
        passing_score_percentage=passing_score,
        show_corrections_after=show_corr,
        certificate_template_url=assessment_in.certificate_template_url,
        created_by=current_user.id,
    )
    db.add(new_assessment)
    db.flush()

    # 1. Assignations de groupes
    assigned_groups_out = []
    if assessment_in.assigned_group_ids:
        for gid in assessment_in.assigned_group_ids:
            grp = db.query(Group).filter(Group.id == gid).first()
            if grp:
                assignment = AssessmentAssignment(
                    id=str(uuid.uuid4()),
                    assessment_id=new_assessment.id,
                    group_id=grp.id,
                )
                db.add(assignment)
                assigned_groups_out.append(
                    AssignedGroupOut(id=grp.id, name=grp.name, level=grp.level)
                )

    # 2. Questions et Choix
    total_pts = 0
    q_count = 0
    for idx, q_in in enumerate(assessment_in.questions):
        question = Question(
            id=str(uuid.uuid4()),
            assessment_id=new_assessment.id,
            content=q_in.content,
            points=q_in.points if q_in.points > 0 else 1,
            order_index=idx,
        )
        db.add(question)
        db.flush()
        q_count += 1
        total_pts += question.points

        for c_in in q_in.choices:
            choice = Choice(
                id=str(uuid.uuid4()),
                question_id=question.id,
                content=c_in.content,
                is_correct=c_in.is_correct,
            )
            db.add(choice)

    db.commit()
    db.refresh(new_assessment)

    return AssessmentOut(
        id=new_assessment.id,
        title=new_assessment.title,
        description=new_assessment.description,
        type=new_assessment.type,
        is_standard_recommended=new_assessment.is_standard_recommended,
        time_limit_minutes=new_assessment.time_limit_minutes,
        passing_score_percentage=float(new_assessment.passing_score_percentage),
        show_corrections_after=new_assessment.show_corrections_after,
        certificate_template_url=new_assessment.certificate_template_url,
        created_by=new_assessment.created_by,
        creator_name=current_user.username or current_user.email,
        created_at=new_assessment.created_at,
        updated_at=new_assessment.updated_at,
        question_count=q_count,
        total_points=total_pts,
        assigned_groups=assigned_groups_out,
        has_completed=False,
    )


# ============================================================================
# 3. GET ASSESSMENT DETAIL (START / PREVIEW)
# ============================================================================
@router.get("/{id}", response_model=AssessmentDetailOut)
def get_assessment_detail(
    id: str,
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Renvoie le détail d'une évaluation avec ses questions.
    RÈGLE DE SÉCURITÉ STRICTE : Si l'utilisateur est un apprenant, les choix
    ne contiennent JAMAIS le drapeau `is_correct`.
    """
    assessment = db.query(Assessment).filter(Assessment.id == id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable.")

    if not check_user_access_to_assessment(current_user, assessment, db):
        raise HTTPException(status_code=403, detail="Vous n'avez pas accès à cette évaluation.")

    # Questions ordonnées
    questions = db.query(Question).filter(Question.assessment_id == id).order_by(Question.order_index.asc()).all()

    questions_out = []
    total_pts = 0
    for q in questions:
        total_pts += q.points
        choices_out = [
            ChoiceOut(id=c.id, question_id=c.question_id, content=c.content)
            for c in q.choices
        ]
        questions_out.append(
            QuestionOut(
                id=q.id,
                assessment_id=q.assessment_id,
                content=q.content,
                points=q.points,
                order_index=q.order_index,
                choices=choices_out,
            )
        )

    # Groupes
    assignments = db.query(AssessmentAssignment).filter(AssessmentAssignment.assessment_id == id).all()
    assigned_groups = [
        AssignedGroupOut(id=a.group.id, name=a.group.name, level=a.group.level)
        for a in assignments if a.group
    ]

    return AssessmentDetailOut(
        id=assessment.id,
        title=assessment.title,
        description=assessment.description,
        type=assessment.type,
        is_standard_recommended=assessment.is_standard_recommended,
        time_limit_minutes=assessment.time_limit_minutes,
        passing_score_percentage=float(assessment.passing_score_percentage),
        show_corrections_after=assessment.show_corrections_after,
        certificate_template_url=assessment.certificate_template_url,
        created_by=assessment.created_by,
        creator_name=assessment.creator.username or assessment.creator.email if assessment.creator else "",
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        question_count=len(questions),
        total_points=total_pts,
        assigned_groups=assigned_groups,
        questions=questions_out,
    )


# ============================================================================
# 4. START ATTEMPT
# ============================================================================
@router.post("/{id}/start", response_model=StartAttemptResponse)
def start_attempt(
    id: str,
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Démarre une tentative d'évaluation (status = 'IN_PROGRESS').
    Renvoie les questions et les choix avec `is_correct` strictement masqué.
    """
    assessment = db.query(Assessment).filter(Assessment.id == id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable.")

    if not check_user_access_to_assessment(current_user, assessment, db):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à passer cette évaluation.")

    # Création de la tentative
    attempt = UserAttempt(
        id=str(uuid.uuid4()),
        assessment_id=assessment.id,
        user_id=current_user.id,
        status=AttemptStatus.IN_PROGRESS,
        started_at=datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Récupérer les questions sans réponses correctes
    questions = db.query(Question).filter(Question.assessment_id == id).order_by(Question.order_index.asc()).all()
    questions_out = []
    total_pts = 0
    for q in questions:
        total_pts += q.points
        choices_out = [
            ChoiceOut(id=c.id, question_id=c.question_id, content=c.content)
            for c in q.choices
        ]
        questions_out.append(
            QuestionOut(
                id=q.id,
                assessment_id=q.assessment_id,
                content=q.content,
                points=q.points,
                order_index=q.order_index,
                choices=choices_out,
            )
        )

    detail_out = AssessmentDetailOut(
        id=assessment.id,
        title=assessment.title,
        description=assessment.description,
        type=assessment.type,
        is_standard_recommended=assessment.is_standard_recommended,
        time_limit_minutes=assessment.time_limit_minutes,
        passing_score_percentage=float(assessment.passing_score_percentage),
        show_corrections_after=assessment.show_corrections_after,
        certificate_template_url=assessment.certificate_template_url,
        created_by=assessment.created_by,
        creator_name=assessment.creator.username if assessment.creator else "",
        created_at=assessment.created_at,
        question_count=len(questions),
        total_points=total_pts,
        assigned_groups=[],
        questions=questions_out,
    )

    return StartAttemptResponse(
        attempt_id=attempt.id,
        assessment=detail_out,
        started_at=attempt.started_at,
        time_limit_minutes=assessment.time_limit_minutes,
    )


# ============================================================================
# 5. SUBMIT ATTEMPT & WORKFLOW CERTIFICATION
# ============================================================================
@router.post("/{id}/submit", response_model=AttemptReviewOut)
def submit_attempt(
    id: str,
    submission: SubmitAnswersRequest,
    db: SessionDep,
    current_user: CurrentUser,
    attempt_id: Optional[str] = None,
) -> Any:
    """
    Soumet les réponses de l'évaluation :
    1. Calcule le score exact et le pourcentage de réussite.
    2. Passe le statut à 'COMPLETED'.
    3. Si type == 'CERTIFICATION' et is_passed == True :
       Génère automatiquement le diplôme / certificat officiel et l'enregistre.
    4. Renvoie le récapitulatif détaillé avec correction face aux bonnes réponses.
    """
    assessment = db.query(Assessment).filter(Assessment.id == id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable.")

    # Trouver ou créer la tentative correspondante
    if attempt_id:
        attempt = db.query(UserAttempt).filter(
            UserAttempt.id == attempt_id,
            UserAttempt.user_id == current_user.id
        ).first()
    else:
        attempt = db.query(UserAttempt).filter(
            UserAttempt.assessment_id == id,
            UserAttempt.user_id == current_user.id,
            UserAttempt.status == AttemptStatus.IN_PROGRESS
        ).order_by(UserAttempt.started_at.desc()).first()

    if not attempt:
        # Créer une tentative directe si non initiée
        attempt = UserAttempt(
            id=str(uuid.uuid4()),
            assessment_id=id,
            user_id=current_user.id,
            status=AttemptStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
        )
        db.add(attempt)
        db.flush()

    # Récupérer toutes les questions et choix avec les bonnes réponses
    questions = db.query(Question).filter(Question.assessment_id == id).order_by(Question.order_index.asc()).all()

    total_possible_points = sum(q.points for q in questions)
    total_earned_points = 0
    questions_review: List[QuestionReviewOut] = []

    # Nettoyage des anciennes réponses pour cette tentative
    db.query(UserAnswer).filter(UserAnswer.attempt_id == attempt.id).delete()

    for q in questions:
        selected_choice_id = submission.answers.get(q.id)

        # Enregistrement de la réponse
        answer = UserAnswer(
            id=str(uuid.uuid4()),
            attempt_id=attempt.id,
            question_id=q.id,
            selected_choice_id=selected_choice_id,
        )
        db.add(answer)

        # Vérification de l'exactitude
        correct_choice = next((c for c in q.choices if c.is_correct), None)
        is_user_correct = False
        points_for_this_q = 0

        if selected_choice_id and correct_choice and str(selected_choice_id) == str(correct_choice.id):
            is_user_correct = True
            points_for_this_q = q.points
            total_earned_points += points_for_this_q

        # Choix enrichis avec is_correct pour le feedback post-soumission
        choices_review = [
            ChoiceReviewOut(
                id=c.id,
                question_id=c.question_id,
                content=c.content,
                is_correct=c.is_correct,
            )
            for c in q.choices
        ]

        questions_review.append(
            QuestionReviewOut(
                id=q.id,
                assessment_id=q.assessment_id,
                content=q.content,
                points=q.points,
                order_index=q.order_index,
                choices=choices_review,
                user_selected_choice_id=selected_choice_id,
                is_user_correct=is_user_correct,
                points_earned=points_for_this_q,
            )
        )

    # Calcul du score en pourcentage
    if total_possible_points > 0:
        score_pct = round((total_earned_points / total_possible_points) * 100.0, 2)
    else:
        score_pct = 100.0

    is_passed = score_pct >= float(assessment.passing_score_percentage)

    attempt.score_percentage = score_pct
    attempt.is_passed = is_passed
    attempt.status = AttemptStatus.COMPLETED
    attempt.completed_at = datetime.utcnow()

    # Workflow de Certification : Génération automatique si réussi
    cert_url = None
    if assessment.type == AssessmentType.CERTIFICATION and is_passed:
        cert_id = str(uuid.uuid4())
        learner_display_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip()
        if not learner_display_name:
            learner_display_name = current_user.username or current_user.email

        try:
            cert_url = generate_certificate_document(
                certificate_id=cert_id,
                learner_name=learner_display_name,
                learner_email=current_user.email,
                assessment_title=assessment.title,
                score_percentage=score_pct,
                passing_score=float(assessment.passing_score_percentage),
                completion_date=attempt.completed_at or datetime.utcnow(),
                template_url=assessment.certificate_template_url,
            )

            user_cert = UserCertificate(
                id=cert_id,
                user_id=current_user.id,
                assessment_id=assessment.id,
                attempt_id=attempt.id,
                certificate_file_url=cert_url,
            )
            db.add(user_cert)
        except Exception as cert_err:
            print(f"[Certificate Generation Error] {cert_err}")

    db.commit()
    db.refresh(attempt)

    return AttemptReviewOut(
        attempt_id=attempt.id,
        assessment_id=assessment.id,
        assessment_title=assessment.title,
        assessment_type=assessment.type.value,
        passing_score_percentage=float(assessment.passing_score_percentage),
        score_percentage=score_pct,
        is_passed=is_passed,
        status=attempt.status.value,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        total_points_earned=total_earned_points,
        total_points_possible=total_possible_points,
        show_corrections=assessment.show_corrections_after,
        certificate_url=cert_url,
        questions=questions_review,
    )


# ============================================================================
# 6. GET ATTEMPT REVIEW (POST-EXAM FEEDBACK)
# ============================================================================
@router.get("/attempts/{attempt_id}/review", response_model=AttemptReviewOut)
def get_attempt_review(
    attempt_id: str,
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Affiche la correction et le récapitulatif complet d'une tentative passée :
    Compare les choix faits par l'utilisateur face aux bonnes réponses.
    """
    attempt = db.query(UserAttempt).filter(UserAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Tentative introuvable.")

    # Seul l'auteur de la tentative ou un créateur peut voir la correction
    if attempt.user_id != current_user.id and not is_creator(current_user):
        raise HTTPException(status_code=403, detail="Accès interdit à cette correction.")

    assessment = attempt.assessment
    questions = db.query(Question).filter(Question.assessment_id == assessment.id).order_by(Question.order_index.asc()).all()

    answers = db.query(UserAnswer).filter(UserAnswer.attempt_id == attempt.id).all()
    user_answers_map = {a.question_id: a.selected_choice_id for a in answers}

    total_possible_points = sum(q.points for q in questions)
    total_earned_points = 0
    questions_review: List[QuestionReviewOut] = []

    for q in questions:
        selected_choice_id = user_answers_map.get(q.id)
        correct_choice = next((c for c in q.choices if c.is_correct), None)
        is_user_correct = False
        points_for_this_q = 0

        if selected_choice_id and correct_choice and str(selected_choice_id) == str(correct_choice.id):
            is_user_correct = True
            points_for_this_q = q.points
            total_earned_points += points_for_this_q

        choices_review = [
            ChoiceReviewOut(
                id=c.id,
                question_id=c.question_id,
                content=c.content,
                is_correct=c.is_correct if assessment.show_corrections_after or is_creator(current_user) else False,
            )
            for c in q.choices
        ]

        questions_review.append(
            QuestionReviewOut(
                id=q.id,
                assessment_id=q.assessment_id,
                content=q.content,
                points=q.points,
                order_index=q.order_index,
                choices=choices_review,
                user_selected_choice_id=selected_choice_id,
                is_user_correct=is_user_correct,
                points_earned=points_for_this_q,
            )
        )

    # Récupérer l'URL du certificat si présent
    cert = db.query(UserCertificate).filter(UserCertificate.attempt_id == attempt.id).first()
    cert_url = cert.certificate_file_url if cert else None

    return AttemptReviewOut(
        attempt_id=attempt.id,
        assessment_id=assessment.id,
        assessment_title=assessment.title,
        assessment_type=assessment.type.value,
        passing_score_percentage=float(assessment.passing_score_percentage),
        score_percentage=float(attempt.score_percentage or 0.0),
        is_passed=bool(attempt.is_passed),
        status=attempt.status.value,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        total_points_earned=total_earned_points,
        total_points_possible=total_possible_points,
        show_corrections=assessment.show_corrections_after,
        certificate_url=cert_url,
        questions=questions_review,
    )


# ============================================================================
# 7. GET MY CERTIFICATES (LEARNER PROFILE & DIPLOMAS)
# ============================================================================
@router.get("/certificates/my-certificates", response_model=List[UserCertificateOut])
def get_my_certificates(
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Récupère la liste intégrale de tous les diplômes et certificats officiels
    obtenus par l'utilisateur connecté.
    """
    certs = db.query(UserCertificate).filter(
        UserCertificate.user_id == current_user.id
    ).order_by(UserCertificate.issued_at.desc()).all()

    results = []
    user_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.username or current_user.email

    for c in certs:
        score_val = float(c.attempt.score_percentage) if c.attempt and c.attempt.score_percentage else 100.0
        results.append(
            UserCertificateOut(
                id=c.id,
                user_id=c.user_id,
                user_name=user_name,
                user_email=current_user.email,
                assessment_id=c.assessment_id,
                assessment_title=c.assessment.title if c.assessment else "Certification E-Schola Pro",
                attempt_id=c.attempt_id,
                score_percentage=score_val,
                certificate_file_url=c.certificate_file_url,
                issued_at=c.issued_at,
            )
        )
    return results


# ============================================================================
# 8. UPLOAD CERTIFICATE TEMPLATE (CREATORS ONLY)
# ============================================================================
@router.post("/upload-template")
async def upload_certificate_template(
    file: UploadFile = File(...),
    current_user: CurrentUser = None,
) -> Any:
    """
    Téléverse un modèle de document pour les certificats (PNG, JPG, PDF).
    Réservé aux formateurs et administrateurs.
    """
    if not is_creator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les créateurs peuvent téléverser des modèles de certificats.",
        )

    upload_dir = os.path.join("uploads", "templates")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1].lower() or ".png"
    unique_name = f"template_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = os.path.join(upload_dir, unique_name)

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    return {"template_url": f"/uploads/templates/{unique_name}"}


# ============================================================================
# 9. DELETE ASSESSMENT (CREATORS ONLY)
# ============================================================================
@router.delete("/{id}")
def delete_assessment(
    id: str,
    db: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Supprime une évaluation et l'ensemble de ses questions/tentatives en cascade.
    """
    if not is_creator(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les créateurs peuvent supprimer des évaluations.",
        )

    assessment = db.query(Assessment).filter(Assessment.id == id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Évaluation introuvable.")

    db.delete(assessment)
    db.commit()
    return {"message": "Évaluation supprimée avec succès."}
