import base64
import io
import os
import shutil
import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps
from pydantic import BaseModel
from sqlalchemy import or_

from app.api.deps import CurrentUser, SessionDep
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserMinimalRead,
    UserResponse,
    UserUpdate,
    UserUpdatePassword,
)
from app.services.welcome import send_welcome_message

router = APIRouter()


ADMIN_ROLES = ["admin", "admin_manager", "admin_limited"]
SUPER_ADMIN_ROLES = ["admin", "admin_limited"]
VALID_ROLES = [
    "admin",
    "admin_manager",
    "admin_limited",
    "formateur",
    "pedagogique",
    "étudiant",
    "stagiaire",
    "employer",
]


import re
import unicodedata


def slugify_username(nom: str, prenom: str) -> str:
    combined = f"{prenom.strip()} {nom.strip()}".lower()
    nfkd = unicodedata.normalize("NFKD", combined)
    without_accents = "".join([c for c in nfkd if not unicodedata.combining(c)])
    slug = re.sub(r"[^a-z0-9]+", ".", without_accents).strip(".")
    return slug or "user"


@router.get("/check-username")
def check_username(
    val: str,
    session: SessionDep,
) -> Any:
    val = val.strip().lower()
    existing = (
        session.query(User)
        .filter((User.username == val) | (User.email == val))
        .first()
    )
    return {"available": existing is None, "username": val}


@router.get("/search", response_model=list[UserMinimalRead])
def search_users(
    session: SessionDep,
    current_user: CurrentUser,
    q: str = Query("", description="Terme de recherche pour filtrer les utilisateurs"),
    limit: int = Query(10, ge=1, le=50, description="Nombre maximum de résultats"),
) -> Any:
    """
    Recherche d'utilisateurs par nom, prénom, email ou nom d'utilisateur.
    Matching ILIKE insensible à la casse, exclusion des utilisateurs inactifs ou supprimés.
    """
    query_str = q.strip()
    base_query = session.query(User)

    if hasattr(User, "is_active"):
        base_query = base_query.filter(User.is_active == True)
    if hasattr(User, "is_deleted"):
        base_query = base_query.filter(User.is_deleted == False)
    if hasattr(User, "deleted_at"):
        base_query = base_query.filter(getattr(User, "deleted_at").is_(None))

    if query_str:
        pattern = f"%{query_str}%"
        base_query = base_query.filter(
            or_(
                User.prenom.ilike(pattern),
                User.nom.ilike(pattern),
                User.email.ilike(pattern),
                User.username.ilike(pattern),
            )
        )

    users = base_query.limit(limit).all()

    result = []
    for u in users:
        fn_parts = [p for p in [u.prenom, u.nom] if p]
        full_name = " ".join(fn_parts).strip() or u.username or u.email or f"Utilisateur #{u.id}"
        result.append(
            UserMinimalRead(
                id=u.id,
                full_name=full_name,
                email=u.email,
                role=u.role or "étudiant",
                avatar_url=u.avatar_url,
            )
        )

    return result


@router.post("/", response_model=UserResponse)
def create_user(
    *,
    session: SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Create new user via public registration.
    """
    requested_role = user_in.role.lower()
    if requested_role in ADMIN_ROLES or requested_role in ["formateur", "pedagogique"]:
        raise HTTPException(
            status_code=403,
            detail="Le rôle de formateur ou d'administrateur ne peut pas être choisi publiquement. Il doit être attribué par un administrateur.",
        )

    # 1. Resolve username
    resolved_username = (user_in.username or "").strip().lower()
    if not resolved_username:
        if user_in.prenom and user_in.nom:
            resolved_username = slugify_username(user_in.nom, user_in.prenom)
        elif user_in.email:
            resolved_username = user_in.email.split("@")[0].strip().lower()
        else:
            resolved_username = f"user.{uuid.uuid4().hex[:8]}"

    # Check username uniqueness
    existing_username = (
        session.query(User)
        .filter((User.username == resolved_username) | (User.email == resolved_username))
        .first()
    )
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail=f"Le nom d'utilisateur '{resolved_username}' est déjà utilisé.",
        )

    # 2. Resolve email
    resolved_email = (user_in.email or "").strip().lower()
    if resolved_email:
        existing_email = (
            session.query(User)
            .filter((User.email == resolved_email) | (User.username == resolved_email))
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=400,
                detail=f"Un utilisateur avec l'adresse email '{resolved_email}' existe déjà.",
            )
    else:
        resolved_email = f"{resolved_username}@eschola.pro"

    # 3. Validation of standard required fields
    if not user_in.nom or not user_in.nom.strip():
        raise HTTPException(status_code=422, detail="Le champ 'nom' est obligatoire.")
    if not user_in.prenom or not user_in.prenom.strip():
        raise HTTPException(status_code=422, detail="Le champ 'prénom' est obligatoire.")
    if not user_in.date_naissance or not user_in.date_naissance.strip():
        raise HTTPException(status_code=422, detail="La date de naissance est obligatoire.")
    if not user_in.pays or not user_in.pays.strip():
        raise HTTPException(status_code=422, detail="Le pays est obligatoire.")
    if not user_in.ville or not user_in.ville.strip():
        raise HTTPException(status_code=422, detail="La ville est obligatoire.")

    # 4. Conditional validation according to role
    departement_val = user_in.departement.strip() if user_in.departement else None
    specialisation_val = user_in.specialisation.strip() if user_in.specialisation else None

    if requested_role in ["employer", "stagiaire"] and not departement_val:
        raise HTTPException(status_code=422, detail="Le département est obligatoire pour ce rôle.")
    if requested_role in ["étudiant", "stagiaire"] and not specialisation_val:
        raise HTTPException(status_code=422, detail="La spécialisation est obligatoire pour ce rôle.")

    if requested_role not in ["employer", "stagiaire"]:
        departement_val = None
    if requested_role not in ["étudiant", "stagiaire"]:
        specialisation_val = None

    user_create = User(
        username=resolved_username,
        email=resolved_email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        nom=user_in.nom.strip(),
        prenom=user_in.prenom.strip(),
        date_naissance=user_in.date_naissance.strip(),
        cin=user_in.cin.strip() if user_in.cin else None,
        telephone=user_in.telephone.strip() if user_in.telephone else None,
        adresse=user_in.adresse.strip() if user_in.adresse else None,
        ville=user_in.ville.strip(),
        pays=user_in.pays.strip(),
        departement=departement_val,
        specialisation=specialisation_val,
    )
    session.add(user_create)
    session.commit()
    session.refresh(user_create)

    # Attach learner to default group if exists
    if user_create.role.lower() in ["étudiant", "stagiaire", "employer"]:
        try:
            from app.models.group import Group, GroupMember

            with session.begin_nested():
                default_grp = session.query(Group).first()
                if default_grp:
                    session.add(
                        GroupMember(group_id=default_grp.id, user_id=user_create.id)
                    )
                    user_create.group_name = default_grp.name
            session.commit()
            session.refresh(user_create)
        except Exception as grp_err:
            session.rollback()
            print(f"[Notice] Group attachment skipped: {grp_err}")

    # Send automatic welcome message
    send_welcome_message(session, user_create)

    return user_create


@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: CurrentUser,
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.put("/me/password")
def update_password(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: UserUpdatePassword,
) -> Any:
    """
    Update password for current user.
    """
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect.")

    current_user.hashed_password = get_password_hash(body.new_password)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return {"message": "Mot de passe mis à jour avec succès."}


MAX_AVATAR_UPLOAD_SIZE = 15 * 1024 * 1024  # 15 MB limit for raw input file
TARGET_AVATAR_SIZE = (256, 256)
WEBP_QUALITY = 80


def optimize_avatar_image(raw_bytes: bytes) -> tuple[str, bytes]:
    """
    Optimise et compresse automatiquement une image de profil utilisateur :
    1. Redressement EXIF (photos smartphone).
    2. Recadrage centré en carré 256x256 via le filtre haute fidélité LANCZOS.
    3. Conversion au format WebP (qualité 80, compression optimale niveau 6).
    4. Encodage Base64 Data URI pour persistance directe dans la base de données Railway.
    Économie d'espace : réduction de 95% à 99% du poids du fichier.
    """
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            # Redressement automatique selon l'orientation EXIF
            img = ImageOps.exif_transpose(img)

            # Préservation du canal alpha si nécessaire, sinon RGB
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            # Recadrage centré carré 256x256 avec interpolation Lanczos
            cropped = ImageOps.fit(img, TARGET_AVATAR_SIZE, method=Image.Resampling.LANCZOS)

            # Compression WebP haute efficacité
            out_buf = io.BytesIO()
            cropped.save(out_buf, format="WEBP", quality=WEBP_QUALITY, method=6)
            webp_bytes = out_buf.getvalue()

            # Encodage Data URI persistant
            b64_str = base64.b64encode(webp_bytes).decode("ascii")
            data_uri = f"data:image/webp;base64,{b64_str}"
            return data_uri, webp_bytes
    except Exception as err:
        raise ValueError(f"Traitement d'image impossible : {err}")


@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Téléversement et auto-optimisation de la photo de profil avec persistance directe dans la base de données Railway.
    L'image est automatiquement recadrée en carré 256x256 et compressée en WebP (qualité 80),
    réduisant le stockage de plus de 98% tout en garantissant une persistance totale sans perte lors des redéploiements.
    """
    content_type = (file.content_type or "").lower()
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/bmp", "image/tiff"]
    if not any(content_type.startswith(t) for t in allowed_types) and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Format de fichier non pris en charge. Veuillez fournir une image valide (JPG, PNG, WebP).",
        )

    try:
        raw_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Échec de lecture du fichier : {e}")

    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Le fichier fourni est vide.")

    if len(raw_bytes) > MAX_AVATAR_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail="La taille du fichier dépasse la limite maximale autorisée de 15 Mo.",
        )

    try:
        # Optimisation WebP & encodage Base64
        data_uri, webp_bytes = optimize_avatar_image(raw_bytes)

        # Sauvegarde miroir sur disque local facultative (pour cache)
        try:
            os.makedirs("uploads/avatars", exist_ok=True)
            local_path = os.path.join("uploads", "avatars", f"user_{current_user.id}.webp")
            with open(local_path, "wb") as f_out:
                f_out.write(webp_bytes)
        except Exception:
            pass

        # Persistance directe dans la base de données Railway
        current_user.avatar_url = data_uri
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        return current_user
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Échec de l'optimisation et de la sauvegarde de l'avatar: {e!s}"
        )


@router.delete("/me/avatar", response_model=UserResponse)
def delete_avatar(
    *,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Supprime la photo de profil de l'utilisateur connecté et restaure l'affichage par initiales dynamiques.
    """
    current_user.avatar_url = None
    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    # Nettoyage miroir facultatif
    try:
        local_path = os.path.join("uploads", "avatars", f"user_{current_user.id}.webp")
        if os.path.exists(local_path):
            os.remove(local_path)
    except Exception:
        pass

    return current_user


@router.get("/{user_id}/avatar")
def get_user_avatar(
    user_id: int,
    session: SessionDep,
) -> Any:
    """
    Endpoint public servant directement l'avatar WebP optimisé depuis la base de données Railway.
    """
    user = session.query(User).filter(User.id == user_id).first()
    if not user or not user.avatar_url:
        raise HTTPException(status_code=404, detail="Avatar introuvable.")

    if user.avatar_url.startswith("data:image/"):
        try:
            header, b64_str = user.avatar_url.split(",", 1)
            mime = header.split(";")[0].replace("data:", "") or "image/webp"
            image_bytes = base64.b64decode(b64_str)
            return Response(
                content=image_bytes,
                media_type=mime,
                headers={
                    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                    "Content-Disposition": f"inline; filename=avatar_{user_id}.webp",
                },
            )
        except Exception:
            raise HTTPException(status_code=500, detail="Erreur de décodage de l'avatar.")

    # Si c'est une URL externe ou chemin relatif existant
    return {"avatar_url": user.avatar_url}


@router.get("/", response_model=list[UserResponse])
def read_users(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all users. (Admin and Admin Managers)
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Not enough permissions. Admin only."
        )
    users = session.query(User).offset(skip).limit(limit).all()
    return users


class RoleUpdate(BaseModel):
    role: str


@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role_in: RoleUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Update user role. (Admin and Admin Manager with strict restrictions)
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Not enough permissions. Admin only."
        )

    new_role = role_in.role.lower()
    if new_role not in [r.lower() for r in VALID_ROLES]:
        raise HTTPException(
            status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}"
        )

    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Restrictions for ADMIN_MANAGER
    if current_user.role.lower() == "admin_manager":
        # Cannot assign ADMIN or ADMIN_MANAGER or ADMIN_LIMITED
        if new_role in ADMIN_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Un ADMIN_MANAGER ne peut pas donner ou attribuer de rôles administratifs (ADMIN, ADMIN_MANAGER, ADMIN_LIMITED).",
            )
        # Cannot modify a user that is already an ADMIN, ADMIN_MANAGER or ADMIN_LIMITED
        if user.role.lower() in ADMIN_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Un ADMIN_MANAGER ne peut pas modifier les permissions ou le rôle d'un compte administrateur.",
            )

    user.role = role_in.role
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a user. (Admin and Admin Manager with restrictions)
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Not enough permissions. Admin only."
        )

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Cannot delete your own admin account"
        )

    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role.lower() == "admin_manager" and user.role.lower() in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Un ADMIN_MANAGER ne peut pas supprimer un compte administrateur.",
        )

    # Safe cascade deletion of dependent records to respect PostgreSQL strict foreign keys
    try:
        from app.models.attendance import Attendance
        from app.models.classroom import Classroom
        from app.models.course import Course
        from app.models.course_video import CourseVideo
        from app.models.enrollment import Enrollment
        from app.models.event import EventDeliverable
        from app.models.group import GroupMember
        from app.models.message import Message
        from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
        from app.models.task import Task, TaskSubmission

        with session.begin_nested():
            session.query(GroupMember).filter(GroupMember.user_id == user_id).delete(synchronize_session=False)
            session.query(EventDeliverable).filter(EventDeliverable.user_id == user_id).delete(synchronize_session=False)
            session.query(TaskSubmission).filter(TaskSubmission.user_id == user_id).delete(synchronize_session=False)

            # For tasks assigned by this user, clean submissions first
            user_tasks = session.query(Task).filter(Task.assigned_by_id == user_id).all()
            for t in user_tasks:
                session.query(TaskSubmission).filter(TaskSubmission.task_id == t.id).delete(synchronize_session=False)
                session.delete(t)

            session.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).delete(synchronize_session=False)

            # For quizzes created by this user
            user_quizzes = session.query(Quiz).filter(Quiz.created_by_id == user_id).all()
            for q in user_quizzes:
                session.query(QuizQuestion).filter(QuizQuestion.quiz_id == q.id).delete(synchronize_session=False)
                session.query(QuizAttempt).filter(QuizAttempt.quiz_id == q.id).delete(synchronize_session=False)
                session.delete(q)

            # For courses taught by this user, clean videos and enrollments first
            user_courses = session.query(Course).filter(Course.instructor_id == user_id).all()
            for c in user_courses:
                session.query(CourseVideo).filter(CourseVideo.course_id == c.id).delete(synchronize_session=False)
                session.query(Enrollment).filter(Enrollment.course_id == c.id).delete(synchronize_session=False)
                session.delete(c)

            session.query(Attendance).filter(
                (Attendance.user_id == user_id) | (Attendance.marked_by_id == user_id)
            ).delete(synchronize_session=False)

            session.query(Classroom).filter(Classroom.instructor_id == user_id).delete(synchronize_session=False)
            session.query(Message).filter(
                (Message.sender_id == user_id) | (Message.recipient_id == user_id)
            ).delete(synchronize_session=False)
            session.query(Enrollment).filter(Enrollment.user_id == user_id).delete(synchronize_session=False)
    except Exception as cascade_err:
        session.rollback()
        print(f"[Warning] Safe cascade cleanup notice for user {user_id}: {cascade_err}")

    session.delete(user)
    session.commit()
    return {"message": "User deleted successfully", "id": user_id}


@router.post("/admin-create", response_model=UserResponse)
def admin_create_user(
    *,
    session: SessionDep,
    user_in: UserCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new user directly from Admin Panel (Admin and Admin Manager with restrictions).
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seul un administrateur peut créer des comptes depuis ce panneau.",
        )

    target_role = user_in.role.lower()
    if current_user.role.lower() == "admin_manager" and target_role in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Un ADMIN_MANAGER ne peut pas créer de compte avec un rôle administrateur (ADMIN, ADMIN_MANAGER ou ADMIN_LIMITED).",
        )

    # 1. Resolve username & email
    resolved_username = (user_in.username or "").strip().lower()
    if not resolved_username:
        if user_in.prenom and user_in.nom:
            resolved_username = slugify_username(user_in.nom, user_in.prenom)
        elif user_in.email:
            resolved_username = user_in.email.split("@")[0].strip().lower()
        else:
            resolved_username = f"user.{uuid.uuid4().hex[:8]}"

    resolved_email = (user_in.email or "").strip().lower()
    if not resolved_email:
        resolved_email = f"{resolved_username}@eschola.pro"

    # Check uniqueness
    existing = session.query(User).filter(
        (User.username == resolved_username)
        | (User.email == resolved_username)
        | (User.email == resolved_email)
        | (User.username == resolved_email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Un compte avec ce nom d'utilisateur ou cette adresse email existe déjà.",
        )

    # 2. Check if admin exemption applies
    is_admin_role = target_role in ADMIN_ROLES
    if is_admin_role:
        # Lightweight admin profile
        user = User(
            username=resolved_username,
            email=resolved_email,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role,
        )
    else:
        # Full profile for standard roles
        departement_val = user_in.departement.strip() if user_in.departement else None
        specialisation_val = user_in.specialisation.strip() if user_in.specialisation else None

        if target_role in ["employer", "stagiaire"] and not departement_val:
            raise HTTPException(status_code=422, detail="Le département est obligatoire pour ce rôle.")
        if target_role in ["étudiant", "stagiaire"] and not specialisation_val:
            raise HTTPException(status_code=422, detail="La spécialisation est obligatoire pour ce rôle.")

        if target_role not in ["employer", "stagiaire"]:
            departement_val = None
        if target_role not in ["étudiant", "stagiaire"]:
            specialisation_val = None

        user = User(
            username=resolved_username,
            email=resolved_email,
            hashed_password=get_password_hash(user_in.password),
            role=user_in.role,
            nom=user_in.nom.strip() if user_in.nom else None,
            prenom=user_in.prenom.strip() if user_in.prenom else None,
            date_naissance=user_in.date_naissance.strip() if user_in.date_naissance else None,
            cin=user_in.cin.strip() if user_in.cin else None,
            telephone=user_in.telephone.strip() if user_in.telephone else None,
            adresse=user_in.adresse.strip() if user_in.adresse else None,
            ville=user_in.ville.strip() if user_in.ville else None,
            pays=user_in.pays.strip() if user_in.pays else None,
            departement=departement_val,
            specialisation=specialisation_val,
        )

    session.add(user)
    session.commit()
    session.refresh(user)

    if user.role.lower() in ["étudiant", "stagiaire", "employer"]:
        try:
            from app.models.group import Group, GroupMember

            with session.begin_nested():
                default_grp = session.query(Group).first()
                if default_grp:
                    session.add(GroupMember(group_id=default_grp.id, user_id=user.id))
                    user.group_name = default_grp.name
            session.commit()
            session.refresh(user)
        except Exception as grp_err:
            session.rollback()
            print(f"[Notice] Group attachment skipped: {grp_err}")

    # Send automatic welcome message
    send_welcome_message(session, user)

    return user


class PasswordReset(BaseModel):
    new_password: str


@router.put("/{user_id}/password")
def admin_reset_password(
    user_id: int,
    pass_in: PasswordReset,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Reset password for a user. (Admin only, or Admin Manager for non-superadmin users)
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only.")
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    if current_user.role.lower() == "admin_manager" and user.role.lower() in SUPER_ADMIN_ROLES and current_user.id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Un ADMIN_MANAGER ne peut pas réinitialiser le mot de passe d'un administrateur principal.",
        )

    user.hashed_password = get_password_hash(pass_in.new_password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"message": "Mot de passe mis à jour avec succès.", "id": user_id}


@router.put("/me", response_model=UserResponse)
def update_user_me(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    user_in: UserUpdate,
) -> Any:
    """
    Update details for the currently authenticated user.
    """
    # 1. Update username with uniqueness check
    if user_in.username is not None:
        new_username = user_in.username.strip().lower()
        if new_username and new_username != (current_user.username or "").lower():
            existing = (
                session.query(User)
                .filter(
                    (User.username == new_username) | (User.email == new_username),
                    User.id != current_user.id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Le nom d'utilisateur '{new_username}' est déjà pris par un autre compte.",
                )
            current_user.username = new_username

    # 2. Update email with uniqueness check
    if user_in.email is not None:
        new_email = user_in.email.strip().lower()
        if new_email and new_email != (current_user.email or "").lower():
            existing = (
                session.query(User)
                .filter(
                    (User.email == new_email) | (User.username == new_email),
                    User.id != current_user.id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Cette adresse email est déjà utilisée par un autre compte.",
                )
            current_user.email = new_email

    # 3. Update password if provided
    if user_in.password and user_in.password.strip():
        pwd_val = user_in.password.strip()
        if len(pwd_val) < 6:
            raise HTTPException(
                status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères."
            )
        current_user.hashed_password = get_password_hash(pwd_val)

    # 4. Standard and conditional profile fields
    if user_in.nom is not None:
        current_user.nom = user_in.nom.strip() or None
    if user_in.prenom is not None:
        current_user.prenom = user_in.prenom.strip() or None
    if user_in.telephone is not None:
        current_user.telephone = user_in.telephone.strip() or None
    if user_in.adresse is not None:
        current_user.adresse = user_in.adresse.strip() or None
    if user_in.ville is not None:
        current_user.ville = user_in.ville.strip() or None
    if user_in.pays is not None:
        current_user.pays = user_in.pays.strip() or None
    if user_in.date_naissance is not None:
        current_user.date_naissance = user_in.date_naissance.strip() or None
    if user_in.cin is not None:
        current_user.cin = user_in.cin.strip() or None
    if user_in.departement is not None:
        current_user.departement = user_in.departement.strip() or None
    if user_in.specialisation is not None:
        current_user.specialisation = user_in.specialisation.strip() or None

    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.put("/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    *,
    session: SessionDep,
    current_user: CurrentUser,
    user_in: UserUpdate,
) -> Any:
    """
    Update any user's profile details and role (Admin and Admin Manager with restrictions).
    """
    if current_user.role.lower() not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Seul un administrateur peut modifier des comptes d'utilisateurs."
        )

    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    if current_user.role.lower() == "admin_manager" and user.role.lower() in ADMIN_ROLES and current_user.id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Un ADMIN_MANAGER ne peut pas modifier un compte administrateur.",
        )

    # Check username uniqueness if changed
    if user_in.username is not None:
        new_username = user_in.username.strip().lower()
        if new_username and new_username != (user.username or "").lower():
            existing = (
                session.query(User)
                .filter(
                    (User.username == new_username) | (User.email == new_username),
                    User.id != user_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail=f"Le nom d'utilisateur '{new_username}' est déjà pris.")
            user.username = new_username

    # Check email uniqueness if changed
    if user_in.email is not None:
        new_email = user_in.email.strip().lower()
        if new_email and new_email != (user.email or "").lower():
            existing = (
                session.query(User)
                .filter(
                    (User.email == new_email) | (User.username == new_email),
                    User.id != user_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail=f"L'adresse email '{new_email}' est déjà utilisée.")
            user.email = new_email

    # Role update with accent normalization
    if user_in.role is not None:
        raw_role = user_in.role.strip().lower()
        role_map = {
            "etudiant": "étudiant",
            "étudiant": "étudiant",
            "formateur": "formateur",
            "stagiaire": "stagiaire",
            "employer": "employer",
            "employe": "employer",
            "employé": "employer",
            "pedagogique": "pedagogique",
            "admin": "admin",
            "admin_manager": "admin_manager",
            "admin_limited": "admin_limited",
        }
        normalized_role = role_map.get(raw_role, raw_role)
        if current_user.role.lower() == "admin_manager" and normalized_role in ADMIN_ROLES:
            raise HTTPException(status_code=403, detail="Un ADMIN_MANAGER ne peut pas accorder de rôle administrateur.")
        user.role = normalized_role

    if user_in.nom is not None:
        user.nom = user_in.nom.strip() or None
    if user_in.prenom is not None:
        user.prenom = user_in.prenom.strip() or None
    if user_in.date_naissance is not None:
        user.date_naissance = user_in.date_naissance.strip() or None
    if user_in.cin is not None:
        user.cin = user_in.cin.strip() or None
    if user_in.telephone is not None:
        user.telephone = user_in.telephone.strip() or None
    if user_in.adresse is not None:
        user.adresse = user_in.adresse.strip() or None
    if user_in.ville is not None:
        user.ville = user_in.ville.strip() or None
    if user_in.pays is not None:
        user.pays = user_in.pays.strip() or None
    if user_in.departement is not None:
        user.departement = user_in.departement.strip() or None
    if user_in.specialisation is not None:
        user.specialisation = user_in.specialisation.strip() or None
    if user_in.group_name is not None:
        user.group_name = user_in.group_name.strip() or None

    if user_in.password and user_in.password.strip():
        pwd_val = user_in.password.strip()
        if len(pwd_val) < 6:
            raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères.")
        user.hashed_password = get_password_hash(pwd_val)

    session.add(user)
    session.commit()
    session.refresh(user)
    return user

