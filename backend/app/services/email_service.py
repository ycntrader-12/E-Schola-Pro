import os
import re
import smtplib
import socket
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

from app.core.config import settings


def is_valid_email(email_str: str) -> bool:
    """Validates email format using standard regex."""
    if not email_str:
        return False
    email_pattern = r"^[\w\.\+\-]+@[a-zA-Z0-9\-]+(\.[a-zA-Z0-9\-]+)+$"
    return bool(re.match(email_pattern, email_str.strip()))


def get_base_html_template(
    title: str,
    preheader: str,
    body_content: str,
    action_url: Optional[str] = None,
    action_text: Optional[str] = None,
) -> str:
    """
    Renders an enterprise-grade, responsive HTML email template for E-Schola Pro.
    Compatible with all major email clients (Gmail, Outlook, Apple Mail, etc.).
    """
    button_html = ""
    if action_url and action_text:
        button_html = f"""
        <div style="margin: 32px 0; text-align: center;">
            <a href="{action_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); letter-spacing: 0.3px;">
                {action_text} &rarr;
            </a>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
    <!-- Preheader preview text -->
    <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">
        {preheader}
    </div>

    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                E-Schola <span style="color: #a5b4fc;">Pro</span>
                            </h1>
                            <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                                Plateforme d'Enseignement & Formation Professionnelle
                            </p>
                        </td>
                    </tr>

                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 36px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
                            <h2 style="margin: 0 0 18px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
                                {title}
                            </h2>

                            {body_content}

                            {button_html}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f1f5f9; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
                            <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">
                                E-Schola Pro - Système Intégré de Gestion de l'Apprentissage
                            </p>
                            <p style="margin: 0 0 8px 0;">
                                Cet email a été envoyé automatiquement par le système. Pour toute assistance, contactez votre administrateur ou le support technique.
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                                &copy; 2026 E-Schola Pro. Tous droits réservés.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
) -> bool:
    """
    Universal, robust email dispatcher.
    
    Behavior:
    - If SMTP credentials are configured and EMAILS_ENABLED is True:
      Connects to the SMTP server (TLS on 587 or SSL on 465) and sends the email.
    - If SMTP is NOT configured (development or missing credentials):
      Gracefully logs the email to standard output (Mock mode) and returns True.
      This ensures that user creation, password changes, and notifications never
      fail or throw exceptions in local development or unconfigured deployments.
    """
    if not to_email or not is_valid_email(to_email):
        print(f"[Email Service Warning] Invalid destination email: '{to_email}'. Dispatch aborted.")
        return False

    # Check if SMTP is configured and active
    is_active = (
        settings.EMAILS_ENABLED
        and bool(settings.SMTP_HOST)
        and bool(settings.SMTP_HOST.strip())
    )

    if not is_active:
        print(f"[Email Service (DEV/MOCK)] To: {to_email} | Subject: '{subject}'")
        print(f"       -> SMTP is inactive or unconfigured in .env. Email was logged safely without error.")
        return True

    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    if not from_email:
        from_email = "noreply@eschola.pro"

    from_name = settings.SMTP_FROM_NAME or "E-Schola Pro"

    # Create message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    # Plain text fallback
    if not text_content:
        clean_text = re.sub(r"<[^>]+>", " ", html_content)
        text_content = " ".join(clean_text.split())

    part_text = MIMEText(text_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")

    msg.attach(part_text)
    msg.attach(part_html)

    try:
        host = settings.SMTP_HOST.strip()
        port = int(settings.SMTP_PORT or 587)
        timeout = 15

        if settings.SMTP_SSL or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout)
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
            if settings.SMTP_TLS:
                server.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD.strip())

        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()

        print(f"[Email Service] Email successfully sent to '{to_email}' via {host}:{port}.")
        return True

    except Exception as exc:
        print(f"[Email Service Error] Failed to send email to '{to_email}': {exc}")
        return False


def send_welcome_email(
    to_email: str,
    user_name: str,
    role: str,
    login_url: Optional[str] = None,
) -> bool:
    """
    Sends a comprehensive welcome email to a new user.
    """
    if not login_url:
        login_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        if not login_url.endswith("/"):
            login_url += "/login"

    role_labels = {
        "admin": "Administrateur Système",
        "admin_manager": "Gestionnaire Administratif",
        "formateur": "Formateur / Enseignant",
        "pedagogique": "Responsable Pédagogique",
        "dg_rh": "DG / RH (Direction Générale / Ressources Humaines)",
        "étudiant": "Étudiant",
        "stagiaire": "Stagiaire",
        "employer": "Partenaire Employeur",
    }
    role_display = role_labels.get(role, role.capitalize())

    subject = "Bienvenue sur E-Schola Pro - Votre compte est prêt"
    preheader = f"Bienvenue {user_name} sur E-Schola Pro ! Découvrez vos accès à la plateforme."

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
        Nous sommes ravis de vous accueillir sur la plateforme d'apprentissage <strong>E-Schola Pro</strong>. Votre profil a été configuré avec succès avec le rôle suivant :
    </p>

    <div style="background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 4px;">Rôle attribué</span>
        <span style="font-size: 16px; font-weight: 700; color: #312e81;">{role_display}</span>
        <span style="display: block; font-size: 13px; color: #475569; margin-top: 4px;">Identifiant / Email : <strong>{to_email}</strong></span>
    </div>

    <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e293b;">
        Vos fonctionnalités disponibles :
    </p>
    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 6px;">Accès à vos cours et modules de formation interactive</li>
        <li style="margin-bottom: 6px;">Participation aux classes virtuelles en direct et suivi de présence</li>
        <li style="margin-bottom: 6px;">Dépôt de devoirs, passage de quiz et consultation de vos relevés de notes</li>
        <li style="margin-bottom: 6px;">Messagerie interne sécurisée avec vos formateurs et collègues</li>
    </ul>

    <p style="margin: 0 0 16px 0;">
        Cliquez sur le bouton ci-dessous pour vous connecter et commencer votre session :
    </p>
    """

    html = get_base_html_template(
        title="Bienvenue sur E-Schola Pro",
        preheader=preheader,
        body_content=body_content,
        action_url=login_url,
        action_text="Accéder à la plateforme",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_password_reset_email(
    to_email: str,
    user_name: str,
    reset_url: str,
) -> bool:
    """
    Sends a secure password reset link.
    """
    subject = "Réinitialisation de votre mot de passe - E-Schola Pro"
    preheader = "Demande de réinitialisation de mot de passe sur E-Schola Pro."

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
        Une demande de réinitialisation de mot de passe a été initiée pour votre compte associé à l'adresse <strong>{to_email}</strong>.
    </p>
    <p style="margin: 0 0 20px 0;">
        Pour définir un nouveau mot de passe, veuillez cliquer sur le bouton ci-dessous :
    </p>
    """

    html = get_base_html_template(
        title="Réinitialisation de mot de passe",
        preheader=preheader,
        body_content=body_content,
        action_url=reset_url,
        action_text="Réinitialiser mon mot de passe",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_notification_email(
    to_email: str,
    subject: str,
    title: str,
    message_text: str,
    action_url: Optional[str] = None,
    action_text: Optional[str] = None,
) -> bool:
    """
    Sends a general transactional notification email.
    """
    body_content = f"""
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin: 16px 0; color: #334155;">
        {message_text}
    </div>
    """

    html = get_base_html_template(
        title=title,
        preheader=subject,
        body_content=body_content,
        action_url=action_url,
        action_text=action_text,
    )

    return send_email(to_email=to_email, subject=subject, html_content=html)


def test_smtp_connection(test_recipient: Optional[str] = None) -> Dict[str, Any]:
    """
    Diagnostic tool to verify SMTP network reachability, TLS/SSL handshake,
    credentials authentication, and optional test email sending.
    """
    host = (settings.SMTP_HOST or "").strip()
    port = int(settings.SMTP_PORT or 587)
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "test@eschola.pro"

    results: Dict[str, Any] = {
        "status": "pending",
        "smtp_host": host,
        "smtp_port": port,
        "emails_enabled": settings.EMAILS_ENABLED,
        "tls": settings.SMTP_TLS,
        "ssl": settings.SMTP_SSL,
        "user_configured": bool(settings.SMTP_USER),
        "steps": [],
        "message": "",
    }

    if not host:
        results["status"] = "unconfigured"
        results["message"] = "SMTP_HOST n'est pas configuré. Le système fonctionne en mode Mock/Développement (les emails sont journalisés en console sans erreur)."
        return results

    # Step 1: DNS Resolution
    try:
        ip = socket.gethostbyname(host)
        results["steps"].append({"step": "DNS Resolution", "success": True, "ip": ip})
    except Exception as e:
        results["status"] = "error"
        results["message"] = f"Échec de résolution DNS pour l'hôte SMTP '{host}': {e}"
        results["steps"].append({"step": "DNS Resolution", "success": False, "error": str(e)})
        return results

    # Step 2: Connection & Handshake
    server = None
    try:
        timeout = 10
        if settings.SMTP_SSL or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout)
            results["steps"].append({"step": "SSL Connection (port 465)", "success": True})
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
            results["steps"].append({"step": "TCP Connection", "success": True})
            if settings.SMTP_TLS:
                server.starttls()
                results["steps"].append({"step": "STARTTLS Handshake", "success": True})

        # Step 3: Authentication
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD.strip())
            results["steps"].append({"step": "Authentication", "success": True, "user": settings.SMTP_USER})

        # Step 4: Optional Test Send
        if test_recipient:
            if is_valid_email(test_recipient):
                test_subject = "Test de configuration SMTP - E-Schola Pro"
                test_body = f"""
                <p>Ceci est un message de test envoyé depuis votre instance E-Schola Pro.</p>
                <p>Votre configuration SMTP (<strong>{host}:{port}</strong>) fonctionne parfaitement et en toute sécurité.</p>
                """
                test_html = get_base_html_template(
                    title="Test de connexion SMTP réussi",
                    preheader="Configuration email vérifiée",
                    body_content=test_body,
                )
                msg = MIMEMultipart("alternative")
                msg["Subject"] = Header(test_subject, "utf-8")
                msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_email}>"
                msg["To"] = test_recipient
                msg.attach(MIMEText(test_html, "html", "utf-8"))
                server.sendmail(from_email, [test_recipient], msg.as_string())
                results["steps"].append({"step": "Send Test Email", "success": True, "recipient": test_recipient})
            else:
                results["steps"].append({"step": "Send Test Email", "success": False, "error": "Invalid test recipient email"})

        server.quit()
        results["status"] = "success"
        results["message"] = f"Connexion SMTP vers {host}:{port} validée avec succès !"
        return results

    except Exception as e:
        if server:
            try:
                server.quit()
            except Exception:
                pass
        results["status"] = "error"
        results["message"] = f"Erreur lors de la connexion SMTP ({host}:{port}) : {e}"
        results["steps"].append({"step": "SMTP Handshake/Auth", "success": False, "error": str(e)})
        return results
