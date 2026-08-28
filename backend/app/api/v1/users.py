from typing import Any, List
from fastapi import APIRouter, HTTPException
from app.api.deps import SessionDep, CurrentUser
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdatePassword

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(
    *,
    session: SessionDep,
    user_in: UserCreate,
) -> Any:
    """
    Create new user.
    """
    user = session.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
        
    if user_in.role in ["admin", "formateur", "pedagogique"]:
        raise HTTPException(
            status_code=403,
            detail="Le rôle de formateur ou d'administrateur ne peut pas être choisi publiquement. Il doit être attribué par un administrateur.",
        )
    
    user_create = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
    )
    session.add(user_create)
    session.commit()
    session.refresh(user_create)
    return user_create

import os
import shutil
import uuid
from fastapi import UploadFile, File, Request

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
        raise HTTPException(status_code=400, detail="Le fichier fourni n'est pas une image.")

    try:
        os.makedirs("uploads/avatars", exist_ok=True)
        ext = file.filename.split('.')[-1]
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
        raise HTTPException(status_code=500, detail=f"Échec de l'upload de l'avatar: {str(e)}")


@router.get("/", response_model=List[UserResponse])
def read_users(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all users. (Admin only)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions. Admin only.")
    users = session.query(User).offset(skip).limit(limit).all()
    return users

from pydantic import BaseModel

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
    Update user role. (Admin only)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions. Admin only.")
    
    valid_roles = ["admin", "formateur", "pedagogique", "étudiant", "stagiaire", "employer"]
    if role_in.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
        
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
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
    Delete a user. (Admin only)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions. Admin only.")
        
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
        
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
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
    Create a new user directly from Admin Panel (can assign any role including admin).
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Seul un administrateur peut créer des comptes depuis ce panneau.")

    existing = session.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Un utilisateur avec cet email existe déjà.",
        )

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role
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
    Reset password for a user. (Admin only)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only.")
    user = session.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    user.hashed_password = get_password_hash(pass_in.new_password)
    session.commit()
    return {"message": "Mot de passe mis à jour avec succès.", "id": user_id}


