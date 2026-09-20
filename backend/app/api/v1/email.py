from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr

from app.api.deps import CurrentAdminUser, SessionDep
from app.core.config import settings
from app.models.system_setting import SystemSetting
from app.services.audit_service import log_audit_event
from app.services.email_service import get_smtp_runtime_config, test_smtp_connection

router = APIRouter()


class EmailStatusResponse(BaseModel):
    emails_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_tls: bool
    smtp_ssl: bool
    user_configured: bool
    from_email: str
    from_name: str
    environment: str


class EmailTestRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None


class EmailConfigureRequest(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_from_email: Optional[str] = "contact@eschola.pro"
    smtp_from_name: Optional[str] = "E-Schola Pro"
    smtp_tls: bool = True
    smtp_ssl: bool = False
    emails_enabled: bool = True


@router.get("/status", response_model=EmailStatusResponse)
def get_email_status(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Any:
    """
    Returns non-sensitive SMTP configuration and status.
    Accessible to administrators. Dynamically reads from SystemSetting and env.
    """
    cfg = get_smtp_runtime_config(session=session)
    from_email = cfg["smtp_from_email"] or cfg["smtp_user"] or "noreply@eschola.pro"
    return EmailStatusResponse(
        emails_enabled=cfg["emails_enabled"],
        smtp_host=cfg["smtp_host"] or "(non configuré - mode mock)",
        smtp_port=int(cfg["smtp_port"] or 587),
        smtp_tls=cfg["smtp_tls"],
        smtp_ssl=cfg["smtp_ssl"],
        user_configured=bool(cfg["smtp_user"]),
        from_email=from_email,
        from_name=cfg["smtp_from_name"],
        environment=settings.ENVIRONMENT,
    )


@router.post("/test")
def trigger_smtp_test(
    payload: EmailTestRequest,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Any:
    """
    Admin-only diagnostic endpoint.
    Verifies DNS, TCP handshake, TLS/SSL and SMTP credentials.
    Optionally sends a test email if recipient_email is provided.
    """
    results = test_smtp_connection(
        test_recipient=str(payload.recipient_email) if payload.recipient_email else None,
        session=session,
    )
    return results


@router.post("/configure")
def configure_smtp(
    payload: EmailConfigureRequest,
    request: Request,
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Admin-only configuration endpoint.
    Persists SMTP settings directly in the SystemSetting database table,
    enabling live email dispatch without redeploying the application.
    """
    setting_map = {
        "smtp_host": payload.smtp_host.strip(),
        "smtp_port": str(payload.smtp_port),
        "smtp_user": (payload.smtp_user or "").strip(),
        "smtp_password": (payload.smtp_password or "").strip(),
        "smtp_from_email": (payload.smtp_from_email or "contact@eschola.pro").strip(),
        "smtp_from_name": (payload.smtp_from_name or "E-Schola Pro").strip(),
        "smtp_tls": str(payload.smtp_tls).lower(),
        "smtp_ssl": str(payload.smtp_ssl).lower(),
        "emails_enabled": str(payload.emails_enabled).lower(),
        "email_notifications_enabled": str(payload.emails_enabled).lower(),
    }

    for key, val in setting_map.items():
        st = session.query(SystemSetting).filter(SystemSetting.key == key).first()
        if st:
            st.value = val
            st.updated_by_id = current_admin.id
            st.updated_at = datetime.utcnow()
        else:
            new_st = SystemSetting(
                key=key,
                value=val,
                category="email",
                description=f"Configuration SMTP dynamique ({key})",
                updated_by_id=current_admin.id,
                updated_at=datetime.utcnow(),
            )
            session.add(new_st)

    session.commit()

    log_audit_event(
        session,
        action="SMTP_CONFIG_UPDATE",
        user_id=current_admin.id,
        user_email=current_admin.email,
        resource_type="system_setting",
        resource_id="smtp",
        details=f"Paramètres SMTP mis à jour (hôte: {payload.smtp_host}:{payload.smtp_port}, emails_actifs: {payload.emails_enabled})",
        status="SUCCESS",
        request=request,
    )

    return {
        "success": True,
        "message": "Configuration SMTP mise à jour avec succès dans la base de données.",
        "smtp_host": payload.smtp_host,
        "smtp_port": payload.smtp_port,
        "emails_enabled": payload.emails_enabled,
    }

