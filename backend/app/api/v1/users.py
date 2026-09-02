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


@router.post("/", response_model=UserResponse)
def create_user(
    *,
    session: SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Create new user via public registration.
    """
    user = session.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    requested_role = user_in.role.lower()
    if requested_role in ADMIN_ROLES or requested_role in ["formateur", "pedagogique"]:
        raise HTTPException(
            status_code=403,
            detail="Le rôle de formateur ou d'administrateur ne peut pas être choisi publiquement. Il doit être attribué par un administrateur.",
        )

    user_create = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
    )
    session.add(user_create)
    session.commit()
    session.refresh(user_create)
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

    existing = session.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Un utilisateur avec cet email existe déjà.",
        )

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
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
    session.commit()
    return {"message": "Mot de passe mis à jour avec succès.", "id": user_id}
