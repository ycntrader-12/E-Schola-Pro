"""
E-Schola Pro - Email Utilities & Core Wrappers.
Provides direct access to email delivery, templates, and SMTP health checks.
"""
from app.services.email_service import (
    get_base_html_template,
    is_valid_email,
    send_classroom_invitation_email,
    send_email,
    send_notification_email,
    send_password_reset_email,
    send_role_change_email,
    send_welcome_email,
    test_smtp_connection,
)

__all__ = [
    "send_email",
    "send_welcome_email",
    "send_password_reset_email",
    "send_notification_email",
    "send_role_change_email",
    "send_classroom_invitation_email",
    "test_smtp_connection",
    "is_valid_email",
    "get_base_html_template",
]
