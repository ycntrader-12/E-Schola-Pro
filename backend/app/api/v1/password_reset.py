from datetime import datetime, timedelta
import os
import secrets
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import SessionDep
from app.core import security
from app.core.rate_limiter import rate_limiter
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.schemas.password_reset import (
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordResetVerifyResponse,
)
from app.services.audit_service import extract_client_ip, log_audit_event
from app.services.email_service import send_password_reset_email

router = APIRouter()


def mask_email(email: str) -> str:
    """Masks email address for privacy (e.g. j***n@example.com)."""
    if not email or "@" not in email:
        return "***"
    name_part, domain_part = email.split("@", 1)
    if len(name_part) <= 2:
        masked_name = name_part[0] + "*"
    else:
        masked_name = name_part[0] + "*" * (len(name_part) - 2) + name_part[-1]
    return f"{masked_name}@{domain_part}"


@router.post("/forgot-password")
async def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    session: SessionDep,
) -> Dict[str, str]:
    """
    Initiates password reset process:
    - Checks rate limit by IP and target email
    - Generates unique secure token with expiration (1 hour)
    - Persists token in database
    - Sends validation link email
    - Generic response to prevent user enumeration
    """
    client_ip = extract_client_ip(request)
    email_clean = payload.email.strip().lower()

    # Rate limiting protection
    rate_limiter.check_rate_limit(
        identifier=f"pwd_reset_ip_{client_ip}",
        max_requests=5,
        window_seconds=60,
        action_name="demandes de réinitialisation",
    )
    rate_limiter.check_rate_limit(
        identifier=f"pwd_reset_email_{email_clean}",
        max_requests=3,
        window_seconds=300,
        action_name="demandes de réinitialisation pour cet email",
    )

    # Search user
    user = (
        session.query(User)
        .filter(
            (User.email == payload.email.strip())
            | (User.email == email_clean)
            | (User.username == payload.email.strip())
            | (User.username == email_clean)
        )
        .first()
    )

    if user and getattr(user, "is_active", True) is not False and user.email:
        # Invalidate older unused tokens for this user
        session.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used == False,
        ).update({"is_used": True}, synchronize_session=False)

        # Generate unique secure token
        token_str = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)

        db_token = PasswordResetToken(
            user_id=user.id,
            token=token_str,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            is_used=False,
        )
        session.add(db_token)
        session.commit()

        # Build reset link
        frontend_url = os.getenv(
            "FRONTEND_URL", "https://e-schola-pro-production.up.railway.app"
        ).rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={token_str}"

        # Send email
        user_display_name = user.prenom or user.nom or user.username or "Utilisateur"
        send_password_reset_email(
            to_email=user.email,
            user_name=user_display_name,
            reset_url=reset_url,
        )

        log_audit_event(
            session,
            action="PASSWORD_RESET_REQUESTED",
            user_id=user.id,
            user_email=user.email,
            resource_type="user",
            resource_id=user.id,
            details="Demande de réinitialisation de mot de passe générée avec succès",
            status="SUCCESS",
            request=request,
        )

    # Return same generic response regardless of whether user exists
    return {
        "message": (
            "Si l'adresse saisie correspond à un compte actif, "
            "un lien de réinitialisation de mot de passe vient de vous être envoyé par email. "
            "Veuillez vérifier votre boîte de réception et vos indésirables."
        )
    }


@router.get("/verify-token/{token}", response_model=PasswordResetVerifyResponse)
async def verify_password_reset_token(
    token: str,
    session: SessionDep,
) -> PasswordResetVerifyResponse:
    """
    Verifies token validity:
    - Checks token existence in DB
    - Checks if token is not expired and not used
    """
    token_obj = (
        session.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token)
        .first()
    )

    if not token_obj or token_obj.is_used or datetime.utcnow() > token_obj.expires_at:
        return PasswordResetVerifyResponse(
            valid=False,
            masked_email=None,
            message="Le jeton de réinitialisation est invalide, déjà utilisé ou expiré.",
        )

    user = session.query(User).filter(User.id == token_obj.user_id).first()
    masked = mask_email(user.email) if user and user.email else None

    return PasswordResetVerifyResponse(
        valid=True,
        masked_email=masked,
        message="Jeton de réinitialisation valide.",
    )


@router.post("/reset-password")
async def reset_password(
    request: Request,
    payload: PasswordResetConfirm,
    session: SessionDep,
) -> Dict[str, str]:
    """
    Resets password using a verified token:
    - Verifies token validity
    - Hashes new password with bcrypt
    - Updates user record in DB
    - Marks token as used (single-use)
    - Logs audit log event
    """
    client_ip = extract_client_ip(request)
    rate_limiter.check_rate_limit(
        identifier=f"pwd_reset_confirm_ip_{client_ip}",
        max_requests=10,
        window_seconds=60,
        action_name="validations de réinitialisation",
    )

    token_obj = (
        session.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == payload.token,
            PasswordResetToken.is_used == False,
        )
        .first()
    )

    if not token_obj or datetime.utcnow() > token_obj.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le lien de réinitialisation est invalide ou a expiré. Veuillez refaire une demande.",
        )

    user = session.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    if hasattr(user, "is_active") and user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte a été désactivé par l'administration. Impossible de réinitialiser le mot de passe.",
        )

    # Validate password length
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le nouveau mot de passe doit contenir au moins 6 caractères.",
        )

    # Hash new password and update user
    hashed_pwd = security.get_password_hash(payload.new_password)
    user.hashed_password = hashed_pwd

    # Mark token as used
    token_obj.is_used = True

    session.commit()

    log_audit_event(
        session,
        action="PASSWORD_RESET_SUCCESS",
        user_id=user.id,
        user_email=user.email,
        resource_type="user",
        resource_id=user.id,
        details="Mot de passe réinitialisé avec succès via jeton d'accès unique",
        status="SUCCESS",
        request=request,
    )

    return {
        "message": "Votre mot de passe a été réinitialisé avec succès ! Vous pouvez maintenant vous connecter avec vos nouveaux identifiants."
    }
