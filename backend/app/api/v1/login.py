import json
import urllib.parse

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import SessionDep
from app.core import security
from app.models.user import User
from app.schemas.token import Token

router = APIRouter()


@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    request: Request,
    session: SessionDep,
):
    """
    Universal OAuth2, Form, and JSON compatible token login.
    Accepts application/x-www-form-urlencoded, multipart/form-data, or application/json.
    Accepts both 'username' and 'email' fields.
    """
    username = None
    password = None

    content_type = request.headers.get("content-type", "").lower()

    # 1. Try parsing as JSON if application/json
    if "application/json" in content_type:
        try:
            body = await request.json()
            if isinstance(body, dict):
                username = body.get("username") or body.get("email")
                password = body.get("password")
        except Exception:
            pass

    # 2. Try parsing as form data (multipart or urlencoded)
    if not username or not password:
        try:
            form = await request.form()
            username = form.get("username") or form.get("email") or username
            password = form.get("password") or password
        except Exception:
            pass

    # 3. Fallback: Parse raw body as JSON or URL-encoded query string
    if not username or not password:
        try:
            raw_body = await request.body()
            body_text = raw_body.decode("utf-8", errors="ignore").strip()

            # Try JSON parsing
            if body_text.startswith("{"):
                data = json.loads(body_text)
                username = data.get("username") or data.get("email") or username
                password = data.get("password") or password
            else:
                # Try URL-encoded parsing
                parsed = urllib.parse.parse_qs(body_text)
                if "username" in parsed:
                    username = parsed["username"][0]
                elif "email" in parsed:
                    username = parsed["email"][0]
                if "password" in parsed:
                    password = parsed["password"][0]
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Identifiants requis : 'username' (ou 'email') et 'password'.",
        )

    # Allow lookup by username or email (case-insensitive)
    uname = str(username).strip()
    uname_lower = uname.lower()
    user = (
        session.query(User)
        .filter(
            (User.username == uname)
            | (User.username == uname_lower)
            | (User.email == uname)
            | (User.email == uname_lower)
        )
        .first()
    )

    if not user or not security.verify_password(str(password), user.hashed_password):
        from app.services.audit_service import log_audit_event
        log_audit_event(
            session,
            action="LOGIN_FAILED",
            user_email=uname,
            details="Échec d'authentification : identifiant ou mot de passe incorrect",
            status="FAILED",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identifiants incorrects (email ou mot de passe)",
        )

    # Vérification du statut d'activation du compte
    if hasattr(user, "is_active") and user.is_active is False:
        from app.services.audit_service import log_audit_event
        log_audit_event(
            session,
            action="LOGIN_BLOCKED",
            user_id=user.id,
            user_email=user.email,
            details="Tentative de connexion sur un compte utilisateur désactivé",
            status="FAILED",
            request=request,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été désactivé par l'administration. Veuillez contacter l'administration pour réactiver votre accès (contact@eschola.pro).",
        )

    access_token = security.create_access_token(
        subject=user.id, role=user.role, email=user.email
    )

    # Enregistrement de la session active et de l'événement d'audit
    from datetime import datetime, timedelta
    from app.core.config import settings
    from app.services.audit_service import log_audit_event, register_user_session

    expires_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    register_user_session(
        session,
        user_id=user.id,
        session_token=access_token[-24:],
        expires_at=expires_at,
        request=request,
    )
    log_audit_event(
        session,
        action="LOGIN_SUCCESS",
        user_id=user.id,
        user_email=user.email,
        resource_type="user",
        resource_id=user.id,
        details=f"Authentification réussie (rôle: {user.role})",
        status="SUCCESS",
        request=request,
    )

    return Token(access_token=access_token, token_type="bearer")
