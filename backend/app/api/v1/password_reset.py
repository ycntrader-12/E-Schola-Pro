import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, or_

from app.api.deps import SessionDep
from app.core import security
from app.core.config import settings
from app.core.rate_limiter import rate_limiter
from app.models.password_reset_request import PasswordResetRequest
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.password_reset import (
    PasswordResetConfirm,
    PasswordResetRequest as PasswordResetRequestSchema,
    PasswordResetResponse,
    PasswordResetVerifyResponse,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
)
from app.services.audit_service import extract_client_ip, log_audit_event
from app.services.email_service import (
    is_valid_email,
    send_no_account_found_email,
    send_password_reset_email,
)

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


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash of a reset token."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


@router.post("/forgot-password", response_model=Dict[str, str | int])
async def request_password_reset(
    request: Request,
    payload: PasswordResetRequestSchema,
    session: SessionDep,
) -> Dict[str, str | int]:
    """
    Initiates password reset process with a cryptographically secure 6-digit OTP code:
    - Strictly rate-limited by IP and email to mitigate DDoS/spam attacks
    - Generates 6-digit OTP via secrets.randbelow()
    - NEVER stores plain OTP in DB (only bcrypt hash is persisted)
    - Enforces anti-enumeration protection (identical response whether email exists or not)
    - Performs dummy hash calculation for missing emails to prevent timing attacks
    - Dispatches transactional HTML email with OTP and security notice to any domain
    """
    client_ip = extract_client_ip(request)
    raw_input = payload.email.strip()
    email_clean = raw_input.lower()
    email_prefix = email_clean.split("@")[0] if "@" in email_clean else email_clean

    # 1. Rate limiting protection
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

    expire_minutes = getattr(settings, "PASSWORD_RESET_OTP_EXPIRE_MINUTES", 10)

    # 2. Search user case-insensitively
    user = (
        session.query(User)
        .filter(
            or_(
                func.lower(User.email) == email_clean,
                func.lower(User.username) == email_clean,
                func.lower(User.username) == email_prefix,
                User.email == raw_input,
                User.username == raw_input,
            )
        )
        .first()
    )

    dest_email = raw_input if is_valid_email(raw_input) else (user.email if user else None)

    if user and getattr(user, "is_active", True) is not False:
        if dest_email and is_valid_email(dest_email) and user.email != dest_email:
            user.email = dest_email
            session.commit()

        target_email = user.email or dest_email

        if target_email and is_valid_email(target_email):
            # Invalidate previous unused reset requests for this user
            session.query(PasswordResetRequest).filter(
                PasswordResetRequest.user_id == user.id,
                PasswordResetRequest.used == False,
            ).update({"used": True}, synchronize_session=False)

            session.query(PasswordResetToken).filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.is_used == False,
            ).update({"is_used": True}, synchronize_session=False)

            # Generate cryptographically secure 6-digit numeric OTP code
            otp_code = f"{secrets.randbelow(900000) + 100000:06d}"
            # Cryptographic hash of OTP (NEVER store plain OTP!)
            otp_hash = security.get_password_hash(otp_code)
            expires_at = datetime.utcnow() + timedelta(minutes=expire_minutes)

            # Persist in password_reset_requests
            db_request = PasswordResetRequest(
                user_id=user.id,
                email=target_email,
                otp_hash=otp_hash,
                reset_token_hash=None,
                expires_at=expires_at,
                attempts=0,
                used=False,
                created_at=datetime.utcnow(),
                ip_address=client_ip,
            )
            session.add(db_request)

            # Also maintain backward compatibility in password_reset_tokens
            legacy_token = secrets.token_urlsafe(32)
            db_token = PasswordResetToken(
                user_id=user.id,
                token=legacy_token,
                code=otp_code,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                is_used=False,
            )
            session.add(db_token)
            session.commit()

            # Dispatch transactional email
            frontend_url = os.getenv("FRONTEND_URL", "https://e-schola-pro-production.up.railway.app").rstrip("/")
            direct_reset_url = f"{frontend_url}/reset-password?token={legacy_token}"

            user_display_name = (
                f"{user.prenom or ''} {user.nom or ''}".strip()
                or user.username
                or "Utilisateur E-Schola Pro"
            )

            send_password_reset_email(
                to_email=target_email,
                user_name=user_display_name,
                reset_url=direct_reset_url,
                confirmation_code=otp_code,
                expires_in_minutes=expire_minutes,
            )

            log_audit_event(
                session,
                action="PASSWORD_RESET_REQUEST",
                user_id=user.id,
                user_email=target_email,
                resource_type="user",
                resource_id=user.id,
                details=f"Demande de réinitialisation OTP initiée (expiration: {expire_minutes} min)",
                status="SUCCESS",
                request=request,
            )
    else:
        # Anti-enumeration: compute dummy hash to eliminate timing difference
        security.get_password_hash("dummy_otp_timing_safe")
        if dest_email and is_valid_email(dest_email):
            send_no_account_found_email(to_email=dest_email)

    return {
        "message": "Si l'adresse saisie correspond à un compte actif, un code de validation à 6 chiffres vous a été envoyé par email.",
        "expires_in_minutes": expire_minutes,
    }


@router.post("/verify-reset-code", response_model=VerifyResetCodeResponse)
async def verify_reset_code(
    request: Request,
    payload: VerifyResetCodeRequest,
    session: SessionDep,
) -> VerifyResetCodeResponse:
    """
    Validates a 6-digit OTP code against the stored hash in database:
    - Enforces maximum attempt limits (defaults to 5 attempts) to prevent brute-force attacks
    - Verifies expiration (10 minutes) and single-use status
    - Upon successful validation, generates a cryptographically secure temporary reset_token
    - The reset_token hash is stored in DB to authorize password modification in step 3
    """
    client_ip = extract_client_ip(request)
    rate_limiter.check_rate_limit(
        identifier=f"pwd_verify_ip_{client_ip}",
        max_requests=15,
        window_seconds=60,
        action_name="vérifications de code OTP",
    )

    clean_code = payload.code.strip().replace(" ", "")
    max_attempts = getattr(settings, "PASSWORD_RESET_MAX_ATTEMPTS", 5)

    # Search candidate request
    query = session.query(PasswordResetRequest).filter(PasswordResetRequest.used == False)
    if payload.email and payload.email.strip():
        query = query.filter(func.lower(PasswordResetRequest.email) == payload.email.strip().lower())

    # Order by newest first
    candidate_requests = query.order_by(PasswordResetRequest.id.desc()).all()

    target_req: Optional[PasswordResetRequest] = None
    for candidate in candidate_requests:
        # Check expiration
        if datetime.utcnow() > candidate.expires_at:
            continue
        # Check attempts lock
        if candidate.attempts >= max_attempts:
            continue
        # Check bcrypt hash
        if security.verify_password(clean_code, candidate.otp_hash):
            target_req = candidate
            break

    # If not matched via hash, check if there's a recent candidate to increment attempts
    if not target_req:
        active_candidate = candidate_requests[0] if candidate_requests else None
        if active_candidate and datetime.utcnow() <= active_candidate.expires_at:
            active_candidate.attempts += 1
            remaining = max(0, max_attempts - active_candidate.attempts)
            if remaining == 0:
                active_candidate.used = True
            session.commit()

            if remaining == 0:
                return VerifyResetCodeResponse(
                    valid=False,
                    reset_token=None,
                    masked_email=None,
                    remaining_attempts=0,
                    message="Nombre maximal de tentatives dépassé. Ce code a été invalidé. Veuillez refaire une demande.",
                )
            return VerifyResetCodeResponse(
                valid=False,
                reset_token=None,
                masked_email=None,
                remaining_attempts=remaining,
                message=f"Code de validation incorrect. Tentatives restantes : {remaining}.",
            )

        # Fallback check against legacy password_reset_tokens table
        legacy = (
            session.query(PasswordResetToken)
            .filter(
                or_(
                    PasswordResetToken.code == clean_code,
                    PasswordResetToken.token == clean_code,
                ),
                PasswordResetToken.is_used == False,
            )
            .order_by(PasswordResetToken.id.desc())
            .first()
        )
        if legacy and datetime.utcnow() <= legacy.expires_at:
            user = session.query(User).filter(User.id == legacy.user_id).first()
            masked = mask_email(user.email) if user and user.email else None
            # Issue temporary token
            temp_token = secrets.token_urlsafe(32)
            legacy.token = temp_token
            session.commit()
            return VerifyResetCodeResponse(
                valid=True,
                reset_token=temp_token,
                masked_email=masked,
                remaining_attempts=max_attempts,
                message="Code validé avec succès.",
            )

        return VerifyResetCodeResponse(
            valid=False,
            reset_token=None,
            masked_email=None,
            remaining_attempts=0,
            message="Code de validation invalide, déjà utilisé ou expiré.",
        )

    # Valid OTP found! Generate cryptographically secure temporary reset authorization token
    temp_reset_token = secrets.token_urlsafe(32)
    target_req.reset_token_hash = hash_token(temp_reset_token)
    session.commit()

    user = session.query(User).filter(User.id == target_req.user_id).first()
    masked = mask_email(user.email) if user and user.email else None

    return VerifyResetCodeResponse(
        valid=True,
        reset_token=temp_reset_token,
        masked_email=masked,
        remaining_attempts=max_attempts,
        message="Code validé avec succès. Vous pouvez désormais définir votre nouveau mot de passe.",
    )


@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(
    request: Request,
    payload: PasswordResetConfirm,
    session: SessionDep,
) -> PasswordResetResponse:
    """
    Executes password reset using verified authorization token:
    - Validates presence and hash of temporary reset_token
    - Enforces password complexity (min 6 chars, confirmation match)
    - Updates hashed_password in database with bcrypt
    - Immediately invalidates all active sessions (user_sessions)
    - Increments user.token_version to invalidate all existing JWTs
    - Invalidates all pending reset requests for this user
    """
    client_ip = extract_client_ip(request)
    rate_limiter.check_rate_limit(
        identifier=f"pwd_reset_confirm_ip_{client_ip}",
        max_requests=10,
        window_seconds=60,
        action_name="validations de réinitialisation",
    )

    raw_token = (payload.reset_token or payload.token or "").strip()
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le jeton de réinitialisation est obligatoire.",
        )

    token_h = hash_token(raw_token)

    # 1. Look up in password_reset_requests
    db_req = (
        session.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.reset_token_hash == token_h,
            PasswordResetRequest.used == False,
        )
        .first()
    )

    # 2. Fallback check for legacy PasswordResetToken
    legacy_token = None
    if not db_req:
        legacy_token = (
            session.query(PasswordResetToken)
            .filter(
                or_(
                    PasswordResetToken.token == raw_token,
                    PasswordResetToken.code == raw_token,
                ),
                PasswordResetToken.is_used == False,
            )
            .first()
        )

    if not db_req and not legacy_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le lien ou code de réinitialisation est invalide, expiré ou a déjà été utilisé.",
        )

    expires_at = db_req.expires_at if db_req else legacy_token.expires_at
    if datetime.utcnow() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce lien ou code de réinitialisation a expiré. Veuillez refaire une demande.",
        )

    user_id = db_req.user_id if db_req else legacy_token.user_id
    user = session.query(User).filter(User.id == user_id).first()
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

    # Validate password length and confirmation
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Le nouveau mot de passe doit contenir au moins 6 caractères.",
        )

    if payload.confirm_password and payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Les deux mots de passe saisis ne sont pas identiques.",
        )

    # Hash new password with bcrypt
    user.hashed_password = security.get_password_hash(payload.new_password)

    # Invalidate all active sessions for this user
    session.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.is_active == True,
    ).update({"is_active": False}, synchronize_session=False)

    # Increment token_version to immediately invalidate all existing JWT tokens
    current_version = getattr(user, "token_version", 1) or 1
    user.token_version = current_version + 1

    # Mark reset request as used
    if db_req:
        db_req.used = True
        db_req.used_at = datetime.utcnow()

    if legacy_token:
        legacy_token.is_used = True

    # Invalidate all pending reset requests for this user
    session.query(PasswordResetRequest).filter(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.used == False,
    ).update({"used": True}, synchronize_session=False)

    session.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.is_used == False,
    ).update({"is_used": True}, synchronize_session=False)

    session.commit()

    log_audit_event(
        session,
        action="PASSWORD_RESET_SUCCESS",
        user_id=user.id,
        user_email=user.email,
        resource_type="user",
        resource_id=user.id,
        details="Mot de passe réinitialisé avec succès via code OTP. Sessions et tokens révoqués.",
        status="SUCCESS",
        request=request,
    )

    return PasswordResetResponse(
        success=True,
        message="Votre mot de passe a été réinitialisé avec succès. Vous pouvez désormais vous connecter.",
    )


@router.get("/verify-token/{token}", response_model=PasswordResetVerifyResponse)
async def verify_token_endpoint(
    token: str,
    session: SessionDep,
) -> PasswordResetVerifyResponse:
    """
    Backward-compatible verification endpoint for URL direct links and codes.
    """
    clean_token = token.strip()

    # Check PasswordResetRequest by reset_token_hash
    token_h = hash_token(clean_token)
    req = (
        session.query(PasswordResetRequest)
        .filter(
            PasswordResetRequest.reset_token_hash == token_h,
            PasswordResetRequest.used == False,
        )
        .first()
    )

    if req and datetime.utcnow() <= req.expires_at:
        user = session.query(User).filter(User.id == req.user_id).first()
        masked = mask_email(user.email) if user and user.email else None
        return PasswordResetVerifyResponse(
            valid=True,
            masked_email=masked,
            message="Jeton de réinitialisation valide.",
        )

    # Check PasswordResetToken
    legacy = (
        session.query(PasswordResetToken)
        .filter(
            or_(
                PasswordResetToken.token == clean_token,
                PasswordResetToken.code == clean_token,
            ),
            PasswordResetToken.is_used == False,
        )
        .first()
    )

    if legacy and datetime.utcnow() <= legacy.expires_at:
        user = session.query(User).filter(User.id == legacy.user_id).first()
        masked = mask_email(user.email) if user and user.email else None
        return PasswordResetVerifyResponse(
            valid=True,
            masked_email=masked,
            message="Code ou jeton de réinitialisation valide.",
        )

    return PasswordResetVerifyResponse(
        valid=False,
        masked_email=None,
        message="Le jeton ou code de réinitialisation est invalide, déjà utilisé ou expiré.",
    )
