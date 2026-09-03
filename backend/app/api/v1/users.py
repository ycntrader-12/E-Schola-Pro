import os
import shutil
import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.api.deps import CurrentUser, SessionDep
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdatePassword

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

            default_grp = session.query(Group).first()
            if default_grp:
                session.add(
                    GroupMember(group_id=default_grp.id, user_id=user_create.id)
                )
                user_create.group_name = default_grp.name
                session.commit()
                session.refresh(user_create)
        except Exception:
            pass

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


@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    *,
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload and set avatar for the current logged-in user.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="Le fichier fourni n'est pas une image."
        )

    try:
        os.makedirs("uploads/avatars", exist_ok=True)
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "avatars", filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        base_url = f"{request.url.scheme}://{request.client.host if request.client else '127.0.0.1'}:{request.url.port or 8000}"
        avatar_url = f"{base_url}/uploads/avatars/{filename}"

        current_user.avatar_url = avatar_url
        session.add(current_user)
        session.commit()
        session.refresh(current_user)
        return current_user
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Échec de l'upload de l'avatar: {e!s}"
        )


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

            default_grp = session.query(Group).first()
            if default_grp:
                session.add(GroupMember(group_id=default_grp.id, user_id=user.id))
                user.group_name = default_grp.name
                session.commit()
                session.refresh(user)
        except Exception:
            pass

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
