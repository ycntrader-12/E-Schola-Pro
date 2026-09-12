import json
from datetime import datetime
from typing import Any, Dict, Optional, Union
from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user_session import UserSession


def extract_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extrait l'adresse IP réelle du client en prenant en compte les proxys Railway/Nginx."""
    if not request:
        return None
    # En-têtes standards de proxys inverses
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # Prendre la première IP de la liste séparée par des virgules
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return None


def extract_device_info(user_agent_str: Optional[str]) -> str:
    """Fournit une description lisible de l'appareil à partir du User-Agent."""
    if not user_agent_str:
        return "Inconnu"
    ua = user_agent_str.lower()
    os_name = "Inconnu"
    if "windows" in ua:
        os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"

    browser_name = "Navigateur"
    if "edg" in ua:
        browser_name = "Edge"
    elif "chrome" in ua:
        browser_name = "Chrome"
    elif "firefox" in ua:
        browser_name = "Firefox"
    elif "safari" in ua:
        browser_name = "Safari"

    return f"{browser_name} ({os_name})"


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[Union[str, int]] = None,
    details: Optional[Union[str, Dict[str, Any]]] = None,
    status: str = "SUCCESS",
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Optional[AuditLog]:
    """
    Enregistre un événement de manière résiliente dans le journal d'audit.
    Garantit qu'une défaillance d'audit n'interrompt pas la transaction principale.
    """
    try:
        final_ip = ip_address or extract_client_ip(request)
        final_ua = user_agent
        if request and not final_ua:
            final_ua = request.headers.get("user-agent")

        details_str = None
        if isinstance(details, dict):
            details_str = json.dumps(details, ensure_ascii=False)
        elif details:
            details_str = str(details)

        audit_entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action.strip().upper(),
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            details=details_str,
            ip_address=final_ip,
            user_agent=final_ua,
            status=status.upper(),
            created_at=datetime.utcnow(),
        )
        db.add(audit_entry)
        db.commit()
        return audit_entry
    except Exception as e:
        db.rollback()
        print(f"[Audit Log Warning] Impossible d'enregistrer l'événement {action}: {e}")
        return None


def register_user_session(
    db: Session,
    user_id: int,
    session_token: str,
    expires_at: datetime,
    request: Optional[Request] = None,
) -> Optional[UserSession]:
    """Crée ou met à jour une session active pour l'utilisateur."""
    try:
        ip = extract_client_ip(request)
        ua = request.headers.get("user-agent") if request else None
        device = extract_device_info(ua)

        session_entry = UserSession(
            user_id=user_id,
            session_token=session_token,
            ip_address=ip,
            user_agent=ua,
            device_info=device,
            is_active=True,
            last_activity=datetime.utcnow(),
            expires_at=expires_at,
            created_at=datetime.utcnow(),
        )
        db.add(session_entry)
        db.commit()
        return session_entry
    except Exception as e:
        db.rollback()
        print(f"[Session Warning] Erreur lors de l'enregistrement de session: {e}")
        return None
