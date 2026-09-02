from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.message import Message
from app.models.task import Task, TaskSubmission
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskSubmissionCreate,
    TaskSubmissionGrade,
    TaskSubmissionResponse,
)

router = APIRouter()


def seed_default_tasks_if_empty(db: Session, current_user: User):
    count = db.query(Task).count()
    if count == 0:
        admin_user = (
            db.query(User).filter(User.role.in_(["admin", "formateur"])).first()
            or current_user
        )
        demo_tasks = [
            Task(
                title="Projet Python & IA: Classification d'Images",
                description="Concevez un script Python utilisant PyTorch ou TensorFlow pour entraîner un modèle de classification d'images. Soumettez le lien GitHub ou le rapport PDF.",
                course_name="Intelligence Artificielle & Deep Learning",
                assigned_by_id=admin_user.id,
                target_role="all",
                target_group="all",
                due_date="2026-09-20",
                points=20,
                priority="haute",
            ),
            Task(
                title="Étude de Cas: Architecture Microservices & Docker",
                description="Rédigez la spécification technique et composez le fichier docker-compose.yml pour orchestrer une application multi-services avec PostgreSQL et Redis.",
                course_name="Ingénierie Logicielle & DevOps",
                assigned_by_id=admin_user.id,
                target_role="all",
                target_group="all",
                due_date="2026-09-25",
                points=20,
                priority="moyenne",
            ),
            Task(
                title="Livrable Mensuel: Rapport d'Avancement du Stage / Projet",
                description="Téléversez votre bilan mensuel d'activité certifié par votre tuteur de stage ou responsable d'équipe.",
                course_name="Projet Professionnel & Stage",
                assigned_by_id=admin_user.id,
                target_role="stagiaire",
                target_group="all",
                due_date="2026-09-30",
                points=20,
                priority="basse",
            ),
        ]
        db.add_all(demo_tasks)
        db.commit()


@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    seed_default_tasks_if_empty(db, current_user)

    is_manager = current_user.role in ["admin", "formateur"]

    if is_manager:
        tasks = db.query(Task).order_by(Task.created_at.desc()).all()
    else:
        # Filter for learners based on target_role
        tasks = (
            db.query(Task)
            .filter(
                (Task.target_role == "all") | (Task.target_role == current_user.role)
            )
            .order_by(Task.created_at.desc())
            .all()
        )

    result = []
    for t in tasks:
        creator = db.query(User).filter(User.id == t.assigned_by_id).first()
        sub_count = (
            db.query(TaskSubmission).filter(TaskSubmission.task_id == t.id).count()
        )

        my_sub = None
        if not is_manager:
            my_sub_obj = (
                db.query(TaskSubmission)
                .filter(
                    TaskSubmission.task_id == t.id,
                    TaskSubmission.user_id == current_user.id,
                )
                .first()
            )
            if my_sub_obj:
                my_sub = TaskSubmissionResponse(
                    id=my_sub_obj.id,
                    task_id=my_sub_obj.task_id,
                    user_id=my_sub_obj.user_id,
                    content_link=my_sub_obj.content_link,
                    status=my_sub_obj.status,
                    grade=my_sub_obj.grade,
                    feedback=my_sub_obj.feedback,
                    submitted_at=my_sub_obj.submitted_at,
                    user_email=current_user.email,
                    user_role=current_user.role,
                )

        result.append(
            TaskResponse(
                id=t.id,
                title=t.title,
                description=t.description,
                course_name=t.course_name,
                assigned_by_id=t.assigned_by_id,
                target_role=t.target_role,
                target_group=t.target_group,
                due_date=t.due_date,
                points=t.points,
                priority=t.priority,
                attachment_url=t.attachment_url,
                created_at=t.created_at,
                assigned_by_email=creator.email if creator else "Équipe Pédagogique",
                my_submission=my_sub,
                total_submissions=sub_count,
            )
        )

    return result


@router.post("/", response_model=TaskResponse)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les formateurs et administrateurs peuvent attribuer des devoirs.",
        )

    task = Task(
        title=task_in.title,
        description=task_in.description,
        course_name=task_in.course_name,
        assigned_by_id=current_user.id,
        target_role=task_in.target_role,
        target_group=task_in.target_group,
        due_date=task_in.due_date,
        points=task_in.points,
        priority=task_in.priority,
        attachment_url=task_in.attachment_url,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        course_name=task.course_name,
        assigned_by_id=task.assigned_by_id,
        target_role=task.target_role,
        target_group=task.target_group,
        due_date=task.due_date,
        points=task.points,
        priority=task.priority,
        attachment_url=task.attachment_url,
        created_at=task.created_at,
        assigned_by_email=current_user.email,
        my_submission=None,
        total_submissions=0,
    )


@router.get("/{task_id}/submissions", response_model=list[TaskSubmissionResponse])
def get_task_submissions(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé au corps pédagogique.",
        )

    submissions = (
        db.query(TaskSubmission).filter(TaskSubmission.task_id == task_id).all()
    )
    res = []
    for s in submissions:
        student = db.query(User).filter(User.id == s.user_id).first()
        res.append(
            TaskSubmissionResponse(
                id=s.id,
                task_id=s.task_id,
                user_id=s.user_id,
                content_link=s.content_link,
                status=s.status,
                grade=s.grade,
                feedback=s.feedback,
                submitted_at=s.submitted_at,
                user_email=student.email if student else f"User #{s.user_id}",
                user_role=student.role if student else "étudiant",
            )
        )
    return res


@router.post("/{task_id}/submit", response_model=TaskSubmissionResponse)
def submit_task_deliverable(
    task_id: int,
    submission_in: TaskSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soumet ou met à jour le livrable d'un étudiant pour un devoir (Task) spécifique.
    
    Ce processus effectue deux actions principales :
    1. Enregistrement/Mise à jour du livrable (lien ou fichier uploadé) dans la table TaskSubmission.
    2. Envoi automatique d'une notification via la messagerie interne à l'équipe pédagogique 
       (Formateurs, Administrateurs) pour les informer qu'un devoir a été rendu.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée.")

    existing = (
        db.query(TaskSubmission)
        .filter(
            TaskSubmission.task_id == task_id, TaskSubmission.user_id == current_user.id
        )
        .first()
    )

    # 1. Traitement de la base de données : Création ou mise à jour de la soumission
    if existing:
        existing.content_link = submission_in.content_link
        existing.submitted_at = datetime.utcnow()
        existing.status = "submitted"
        db.commit()
        db.refresh(existing)
        sub_obj = existing
    else:
        sub_obj = TaskSubmission(
            task_id=task_id,
            user_id=current_user.id,
            content_link=submission_in.content_link,
            status="submitted",
        )
        db.add(sub_obj)
        db.commit()
        db.refresh(sub_obj)

    # 2. Système de Notification Automatique par Messagerie Interne
    # Nous récupérons tous les membres du staff (Admin, Formateur, Pédagogique)
    staff_users = (
        db.query(User)
        .filter(User.role.in_(["admin", "formateur", "pedagogique"]))
        .all()
    )

    alert_subject = f"[LIVRABLE] Soumission pour le devoir : {task.title}"
    alert_body = (
        f"L'apprenant {current_user.email} (Rôle: {current_user.role}) a soumis son livrable.\n\n"
        f"Devoir : {task.title}\n"
        f"Cours : {task.course_name}\n\n"
        f"Lien / Fichier : {submission_in.content_link}\n\n"
        f"Vous pouvez consulter les soumissions dans l'espace 'Tâches & Devoirs' ou 'Messages'."
    )

    # Pour chaque membre du staff, on insère un nouveau Message dans la base de données
    for staff in staff_users:
        if staff.id != current_user.id:
            msg = Message(
                sender_id=current_user.id,
                recipient_id=staff.id,
                subject=alert_subject,
                body=alert_body,
                is_read=False,
                is_draft=False,
                is_trash=False,
            )
            db.add(msg)

    db.commit()

    return TaskSubmissionResponse(
        id=sub_obj.id,
        task_id=sub_obj.task_id,
        user_id=sub_obj.user_id,
        content_link=sub_obj.content_link,
        status=sub_obj.status,
        grade=sub_obj.grade,
        feedback=sub_obj.feedback,
        submitted_at=sub_obj.submitted_at,
        user_email=current_user.email,
        user_role=current_user.role,
    )


@router.put("/submissions/{submission_id}/grade", response_model=TaskSubmissionResponse)
def grade_submission(
    submission_id: int,
    grade_in: TaskSubmissionGrade,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé au corps pédagogique.",
        )

    sub_obj = (
        db.query(TaskSubmission).filter(TaskSubmission.id == submission_id).first()
    )
    if not sub_obj:
        raise HTTPException(status_code=404, detail="Soumission introuvable.")

    sub_obj.grade = grade_in.grade
    sub_obj.feedback = grade_in.feedback
    sub_obj.status = "graded"
    db.commit()
    db.refresh(sub_obj)

    student = db.query(User).filter(User.id == sub_obj.user_id).first()

    return TaskSubmissionResponse(
        id=sub_obj.id,
        task_id=sub_obj.task_id,
        user_id=sub_obj.user_id,
        content_link=sub_obj.content_link,
        status=sub_obj.status,
        grade=sub_obj.grade,
        feedback=sub_obj.feedback,
        submitted_at=sub_obj.submitted_at,
        user_email=student.email if student else f"User #{sub_obj.user_id}",
        user_role=student.role if student else "étudiant",
    )


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé au corps pédagogique.",
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tâche non trouvée.")

    db.delete(task)
    db.commit()
    return {"message": "Tâche supprimée avec succès."}
