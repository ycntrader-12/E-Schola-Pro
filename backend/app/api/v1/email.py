from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.api.deps import CurrentAdminUser, CurrentUser
from app.core.config import settings
from app.services.email_service import test_smtp_connection

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


@router.get("/status", response_model=EmailStatusResponse)
def get_email_status(
    current_user: CurrentUser,
) -> Any:
    """
    Returns non-sensitive SMTP configuration and status.
    Accessible to authenticated users (admin, trainers).
    """
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@eschola.pro"
    return EmailStatusResponse(
        emails_enabled=settings.EMAILS_ENABLED,
        smtp_host=settings.SMTP_HOST or "(non configuré - mode mock)",
        smtp_port=int(settings.SMTP_PORT or 587),
        smtp_tls=settings.SMTP_TLS,
        smtp_ssl=settings.SMTP_SSL,
        user_configured=bool(settings.SMTP_USER),
        from_email=from_email,
        from_name=settings.SMTP_FROM_NAME,
        environment=settings.ENVIRONMENT,
    )


@router.post("/test")
def trigger_smtp_test(
    payload: EmailTestRequest,
    current_admin: CurrentAdminUser,
) -> Any:
    """
    Admin-only diagnostic endpoint.
    Verifies DNS, TCP handshake, TLS/SSL and SMTP credentials.
    Optionally sends a test email if recipient_email is provided.
    """
    results = test_smtp_connection(
        test_recipient=str(payload.recipient_email) if payload.recipient_email else None
    )
    return results
