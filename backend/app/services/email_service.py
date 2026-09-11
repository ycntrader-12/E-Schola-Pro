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
        try:
            print(f"[Email Service (DEV/MOCK)] To: {to_email} | Subject: '{subject}'")
        except UnicodeEncodeError:
            safe_subject = subject.encode("ascii", "replace").decode("ascii")
            print(f"[Email Service (DEV/MOCK)] To: {to_email} | Subject: '{safe_subject}'")
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
    group_name: Optional[str] = None,
) -> bool:
    """
    Sends a comprehensive welcome email with a short message from the Administration to a new user.
    """
    if not login_url:
        base_frontend = os.getenv(
            "FRONTEND_URL", "https://e-schola-pro-production.up.railway.app"
        ).rstrip("/")
        login_url = f"{base_frontend}/login"

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
    role_display = role_labels.get(role.lower().strip() if role else "étudiant", (role or "Étudiant").capitalize())

    subject = "🎓 Bienvenue sur E-Schola Pro - Votre compte est actif"
    preheader = f"Bienvenue {user_name} sur E-Schola Pro ! Découvrez vos accès à la plateforme."

    group_badge_html = ""
    if group_name and group_name.strip():
        group_badge_html = f"""
        <span style="display: block; font-size: 13px; color: #475569; margin-top: 4px;">
            Promotion / Groupe : <strong style="color: #059669;">{group_name.strip()}</strong>
        </span>
        """

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>

    <!-- Message Court de l'Administration -->
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px 20px; border-radius: 0 10px 10px 0; margin: 18px 0; color: #166534;">
        <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
            ✉️ Message de l'Administration
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.5;">
            Nous sommes très heureux de vous accueillir au sein de la communauté <strong>E-Schola Pro</strong>. 
            Votre compte est désormais configuré et prêt à l'emploi. Nous vous souhaitons une excellente expérience d'apprentissage et de collaboration.
        </p>
    </div>

    <!-- Récapitulatif du profil et des accès -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
        <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 6px;">Profil & Accès</span>
        <div style="font-size: 16px; font-weight: 700; color: #312e81; margin-bottom: 6px;">
            {role_display}
        </div>
        <span style="display: block; font-size: 13px; color: #475569; margin-top: 2px;">
            Identifiant / Email : <strong>{to_email}</strong>
        </span>
        {group_badge_html}
    </div>

    <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e293b;">
        Vos fonctionnalités disponibles :
    </p>
    <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #475569;">
        <li style="margin-bottom: 6px;">Accès immédiat à vos cours interactifs et supports de formation</li>
        <li style="margin-bottom: 6px;">Participation aux <strong>salles vidéo conférence</strong> en direct et suivi de vos présences</li>
        <li style="margin-bottom: 6px;">Dépôt de devoirs, évaluation par quiz et consultation des notes</li>
        <li style="margin-bottom: 6px;">Messagerie interne sécurisée pour échanger avec vos formateurs et collègues</li>
    </ul>

    <p style="margin: 0 0 16px 0;">
        Cliquez sur le bouton ci-dessous pour accéder à votre espace et démarrer votre session :
    </p>
    """

    html = get_base_html_template(
        title="Bienvenue sur E-Schola Pro",
        preheader=preheader,
        body_content=body_content,
        action_url=login_url,
        action_text="Accéder à mon espace E-Schola Pro",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_role_change_email(
    to_email: str,
    user_name: str,
    old_role: str,
    new_role: str,
    login_url: Optional[str] = None,
) -> bool:
    """
    Sends a security and notification email when an administrator modifies a user's role.
    """
    if not login_url:
        base_frontend = os.getenv("FRONTEND_URL", "https://e-schola-pro-production.up.railway.app").rstrip("/")
        login_url = f"{base_frontend}/login"

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
    old_display = role_labels.get(old_role.lower().strip(), old_role.capitalize())
    new_display = role_labels.get(new_role.lower().strip(), new_role.capitalize())

    subject = f"Mise à jour de votre rôle sur E-Schola Pro : {new_display}"
    preheader = f"Votre compte E-Schola Pro a été mis à jour avec le rôle : {new_display}."

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
        Nous vous informons qu'un administrateur a mis à jour vos droits d'accès sur la plateforme <strong>E-Schola Pro</strong>.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table role="presentation" width="100%" style="border-collapse: collapse;">
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Rôle précédent :</td>
                <td style="padding: 6px 0; font-weight: 600; color: #475569;">{old_display}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Nouveau rôle attribué :</td>
                <td style="padding: 6px 0; font-weight: 700; color: #4f46e5; font-size: 15px;">{new_display}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 13px;">Compte utilisateur :</td>
                <td style="padding: 6px 0; color: #334155;">{to_email}</td>
            </tr>
        </table>
    </div>

    <p style="margin: 0 0 16px 0;">
        Vos autorisations et vos fonctionnalités disponibles sur la plateforme ont été adaptées immédiatement.
    </p>
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 18px 0; font-size: 13px; color: #991b1b;">
        <strong>Information de sécurité :</strong> Si vous n'êtes pas à l'origine de cette modification ou si vous pensez qu'il s'agit d'une erreur, veuillez contacter immédiatement l'administrateur de votre établissement.
    </div>

    <p style="margin: 0 0 16px 0;">
        Cliquez sur le lien ci-dessous pour vous connecter et accéder à vos modules :
    </p>
    """

    html = get_base_html_template(
        title="Modification de votre rôle",
        preheader=preheader,
        body_content=body_content,
        action_url=login_url,
        action_text="Accéder à mon espace",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html)


def send_classroom_invitation_email(
    to_email: str,
    user_name: str,
    room_title: str,
    room_id: str,
    inviter_name: str,
    start_time: Optional[str] = None,
    room_url: Optional[str] = None,
) -> bool:
    """
    Sends an invitation email for a Salle vidéo conférence.
    """
    if not room_url:
        base_frontend = os.getenv("FRONTEND_URL", "https://e-schola-pro-production.up.railway.app").rstrip("/")
        room_url = f"{base_frontend}/classroom/{room_id}"

    date_str = start_time if start_time else "Session en direct / Accessible maintenant"

    subject = f"🎓 Invitation Salle vidéo conférence : {room_title}"
    preheader = f"Vous êtes invité(e) par {inviter_name} à rejoindre la Salle vidéo conférence '{room_title}'."

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
        Vous avez reçu une invitation de <strong>{inviter_name}</strong> pour rejoindre une <strong>Salle vidéo conférence</strong> sur la plateforme E-Schola Pro.
    </p>

    <div style="background-color: #f1f5f9; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; font-size: 17px; color: #065f46;">{room_title}</h3>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #334155;">
            📅 <strong>Disponibilité :</strong> {date_str}
        </p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #334155;">
            🔑 <strong>Code de la salle :</strong> <span style="font-family: monospace; font-weight: 700; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">{room_id}</span>
        </p>
        <p style="margin: 0; font-size: 13px; color: #334155;">
            👨‍🏫 <strong>Hôte / Formateur :</strong> {inviter_name}
        </p>
    </div>

    <p style="margin: 0 0 12px 0; font-weight: 600; color: #1e293b;">
        Comment rejoindre la Salle vidéo conférence ?
    </p>
    <ol style="margin: 0 0 20px 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li style="margin-bottom: 6px;">Cliquez sur le bouton <strong>« Rejoindre la Salle vidéo conférence »</strong> ci-dessous.</li>
        <li style="margin-bottom: 6px;">Autorisez l'accès à votre caméra et à votre microphone lorsque votre navigateur vous le demande.</li>
        <li style="margin-bottom: 6px;">Vous pouvez aussi saisir directement le code <strong>{room_id}</strong> dans l'onglet Salles vidéo conférence de votre espace.</li>
    </ol>
    """

    html = get_base_html_template(
        title="Invitation Salle vidéo conférence",
        preheader=preheader,
        body_content=body_content,
        action_url=room_url,
        action_text="Rejoindre la Salle vidéo conférence",
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
