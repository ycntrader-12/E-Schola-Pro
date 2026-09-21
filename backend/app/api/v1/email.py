from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel, EmailStr

from app.api.deps import CurrentAdminUser, SessionDep
from app.core.config import settings
from app.models.system_setting import SystemSetting
from app.services.audit_service import log_audit_event
from app.services.email_service import (
    get_smtp_runtime_config,
    test_smtp_connection,
    get_email_service_diagnostics,
    validate_recipient_email,
)

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
    dkim_configured: bool
    email_validate_mx: bool
    block_disposable_emails: bool


class EmailTestRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None


class EmailValidateAddressRequest(BaseModel):
    email: str
    check_mx: Optional[bool] = True
    block_disposable: Optional[bool] = True


class EmailConfigureRequest(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_from_email: Optional[str] = "contact@eschola.pro"
    smtp_from_name: Optional[str] = "E-Schola Pro"
    smtp_reply_to: Optional[str] = ""
    smtp_tls: bool = True
    smtp_ssl: bool = False
    smtp_timeout: int = 15
    smtp_allow_insecure_tls: bool = False
    emails_enabled: bool = True
    dkim_domain: Optional[str] = ""
    dkim_selector: Optional[str] = "eschola"
    dkim_private_key: Optional[str] = ""
    email_validate_mx: bool = True
    block_disposable_emails: bool = True


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
        dkim_configured=bool(cfg["dkim_private_key"] or cfg["dkim_private_key_path"]),
        email_validate_mx=cfg["email_validate_mx"],
        block_disposable_emails=cfg["block_disposable_emails"],
    )


@router.get("/diagnostics")
def get_diagnostics(
    current_admin: CurrentAdminUser,
    session: SessionDep,
) -> Dict[str, Any]:
    """
    Comprehensive diagnostic report:
    - Active SMTP handshake and credentials verification
    - In-app DKIM signing status & recommended DNS TXT record
    - SPF and DMARC active DNS records and DNS recommendations
    - Address validation and anti-spam deliverability rules
    """
    return get_email_service_diagnostics(session=session)


@router.post("/validate-address")
def validate_address_endpoint(
    payload: EmailValidateAddressRequest,
    current_admin: CurrentAdminUser,
) -> Dict[str, Any]:
    """
    Utility endpoint to test email address deliverability:
    Validates syntax, checks disposable domains and resolves DNS MX records.
    """
    is_valid, reason, normalized = validate_recipient_email(
        payload.email,
        check_mx=payload.check_mx,
        block_disposable=payload.block_disposable,
    )
    return {
        "email": payload.email,
        "is_valid": is_valid,
        "reason": reason,
        "normalized_email": normalized,
    }


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
    Persists SMTP and DKIM settings directly in the SystemSetting database table,
    enabling live email dispatch without redeploying the application.
    """
    setting_map = {
        "smtp_host": payload.smtp_host.strip(),
        "smtp_port": str(payload.smtp_port),
        "smtp_user": (payload.smtp_user or "").strip(),
        "smtp_password": (payload.smtp_password or "").strip(),
        "smtp_from_email": (payload.smtp_from_email or "contact@eschola.pro").strip(),
        "smtp_from_name": (payload.smtp_from_name or "E-Schola Pro").strip(),
        "smtp_reply_to": (payload.smtp_reply_to or "").strip(),
        "smtp_tls": str(payload.smtp_tls).lower(),
        "smtp_ssl": str(payload.smtp_ssl).lower(),
        "smtp_timeout": str(payload.smtp_timeout),
        "smtp_allow_insecure_tls": str(payload.smtp_allow_insecure_tls).lower(),
        "emails_enabled": str(payload.emails_enabled).lower(),
        "email_notifications_enabled": str(payload.emails_enabled).lower(),
        "dkim_domain": (payload.dkim_domain or "").strip(),
        "dkim_selector": (payload.dkim_selector or "eschola").strip(),
        "dkim_private_key": (payload.dkim_private_key or "").strip(),
        "email_validate_mx": str(payload.email_validate_mx).lower(),
        "block_disposable_emails": str(payload.block_disposable_emails).lower(),
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
                description=f"Configuration SMTP/DKIM dynamique ({key})",
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
        details=f"Paramètres SMTP/DKIM mis à jour (hôte: {payload.smtp_host}:{payload.smtp_port}, emails_actifs: {payload.emails_enabled})",
        status="SUCCESS",
        request=request,
    )

    return {
        "success": True,
        "message": "Configuration SMTP et DKIM mise à jour avec succès dans la base de données.",
        "smtp_host": payload.smtp_host,
        "smtp_port": payload.smtp_port,
        "emails_enabled": payload.emails_enabled,
        "dkim_enabled": bool(payload.dkim_private_key),
    }


