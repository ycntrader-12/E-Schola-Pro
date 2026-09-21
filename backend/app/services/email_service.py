import base64
import email
import email.utils
import hashlib
import os
import re
import smtplib
import socket
import ssl
import time
import uuid
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional, Tuple, Union

import dns.resolver
from email_validator import validate_email as ext_validate_email, EmailNotValidError
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.core.config import settings

# Common disposable email domains blacklist
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "trashmail.com", "yopmail.com", "sharklasers.com", "dispostable.com",
    "throwawaymail.com", "fakeinbox.com", "generator.email", "getnada.com",
    "temp-mail.org", "nada.ltd", "mohmal.com", "inboxkitten.com", "mytemp.email"
}


def canonicalize_header_relaxed(name: str, value: str) -> bytes:
    """RFC 6376 Relaxed Header Canonicalization."""
    name_clean = name.strip().lower().encode("ascii")
    val_clean = re.sub(r"\r?\n[ \t]+", " ", value)
    val_clean = re.sub(r"[ \t]+", " ", val_clean).strip()
    return name_clean + b":" + val_clean.encode("utf-8")


def canonicalize_body_relaxed(body_bytes: bytes) -> bytes:
    """RFC 6376 Relaxed Body Canonicalization."""
    text = body_bytes.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        l = re.sub(r"[ \t]+", " ", line).rstrip(" \t")
        cleaned_lines.append(l)
    while cleaned_lines and cleaned_lines[-1] == "":
        cleaned_lines.pop()
    if not cleaned_lines:
        return b""
    return ("\r\n".join(cleaned_lines) + "\r\n").encode("utf-8")


def load_dkim_private_key(cfg: Dict[str, Any]) -> Optional[rsa.RSAPrivateKey]:
    """Loads RSA private key for DKIM from environment variable or filesystem."""
    key_pem = (cfg.get("dkim_private_key") or "").strip()
    key_path = (cfg.get("dkim_private_key_path") or "").strip()

    if not key_pem and key_path and os.path.exists(key_path):
        try:
            with open(key_path, "r", encoding="utf-8") as f:
                key_pem = f.read().strip()
        except Exception as e:
            print(f"[DKIM Warning] Failed to read private key from file {key_path}: {e}")
            return None

    if not key_pem:
        return None

    if "\\n" in key_pem and "-----BEGIN" in key_pem:
        key_pem = key_pem.replace("\\n", "\n")

    try:
        loaded = serialization.load_pem_private_key(
            key_pem.encode("utf-8"),
            password=None,
        )
        if isinstance(loaded, rsa.RSAPrivateKey):
            return loaded
    except Exception as e:
        print(f"[DKIM Warning] Could not parse DKIM private key: {e}")
    return None


def get_dkim_dns_record_info(private_key: rsa.RSAPrivateKey, selector: str, domain: str) -> Dict[str, str]:
    """Extracts base64 public key and formats recommended DKIM DNS TXT record."""
    pub_der = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    pub_b64 = base64.b64encode(pub_der).decode("ascii")
    record_name = f"{selector}._domainkey.{domain}".strip(".")
    record_value = f"v=DKIM1; k=rsa; p={pub_b64}"
    return {
        "record_type": "TXT",
        "record_name": record_name,
        "record_value": record_value,
        "public_key_b64": pub_b64,
    }


def sign_mime_message_dkim(
    raw_message_bytes: bytes,
    selector: str,
    domain: str,
    private_key: rsa.RSAPrivateKey,
) -> bytes:
    """Signs MIME message using RSA-SHA256 according to RFC 6376."""
    parts = raw_message_bytes.split(b"\r\n\r\n", 1)
    delimiter = b"\r\n"
    if len(parts) != 2:
        parts = raw_message_bytes.split(b"\n\n", 1)
        delimiter = b"\n"
        if len(parts) != 2:
            return raw_message_bytes

    header_bytes, body_bytes = parts
    c_body = canonicalize_body_relaxed(body_bytes)
    bh = base64.b64encode(hashlib.sha256(c_body).digest()).decode("ascii")

    msg_parsed = email.message_from_bytes(header_bytes)
    sign_headers = ["from", "to", "subject", "date", "message-id", "mime-version", "content-type"]
    present_sign_headers = [h for h in sign_headers if h in msg_parsed]
    h_param = ":".join(present_sign_headers)
    timestamp = str(int(time.time()))

    dkim_sig_header_val = (
        f"v=1; a=rsa-sha256; c=relaxed/relaxed; d={domain}; s={selector}; "
        f"t={timestamp}; h={h_param}; bh={bh}; b="
    )

    canon_headers = []
    for h in present_sign_headers:
        val = msg_parsed.get(h, "")
        canon_headers.append(canonicalize_header_relaxed(h, val))
    canon_headers.append(canonicalize_header_relaxed("dkim-signature", dkim_sig_header_val))

    sign_data = b"\r\n".join(canon_headers)
    sig_bytes = private_key.sign(sign_data, padding.PKCS1v15(), hashes.SHA256())
    b_param = base64.b64encode(sig_bytes).decode("ascii")

    full_dkim_header = f"DKIM-Signature: {dkim_sig_header_val}{b_param}\r\n".encode("utf-8")
    return full_dkim_header + raw_message_bytes


def validate_recipient_email(
    email_str: str,
    check_mx: Optional[bool] = None,
    block_disposable: Optional[bool] = None,
) -> Tuple[bool, str, str]:
    """
    Multi-tier recipient email address validation:
    1. RFC 5321/5322 syntax validation via email_validator
    2. Optional disposable/temporary domain detection
    3. Optional DNS MX/A record reachability check
    """
    if not email_str or not isinstance(email_str, str):
        return False, "Adresse email vide ou invalide", ""

    email_clean = email_str.strip()
    if check_mx is None:
        check_mx = getattr(settings, "EMAIL_VALIDATE_MX", True)
    if block_disposable is None:
        block_disposable = getattr(settings, "BLOCK_DISPOSABLE_EMAILS", True)

    try:
        valid = ext_validate_email(email_clean, check_deliverability=False)
        normalized = valid.normalized
        domain = valid.domain.lower()
    except EmailNotValidError as e:
        return False, f"Format d'email invalide : {e}", email_clean

    if block_disposable and domain in DISPOSABLE_DOMAINS:
        return False, f"Domaine d'adresse temporaire/jetable non autorisé ({domain})", normalized

    INTERNAL_ALLOWED_DOMAINS = {"eschola.pro", "localhost", "local", "example.com", "test.com"}
    if domain in INTERNAL_ALLOWED_DOMAINS:
        return True, "Email valide (domaine interne plateforme)", normalized

    if check_mx:
        try:
            resolver = dns.resolver.Resolver()
            resolver.lifetime = 2.0
            answers = resolver.resolve(domain, "MX")
            if not answers:
                try:
                    resolver.resolve(domain, "A")
                except Exception:
                    return False, f"Aucun serveur de messagerie (MX ou A) pour le domaine '{domain}'", normalized
        except dns.resolver.NXDOMAIN:
            return False, f"Le domaine '{domain}' n'existe pas (NXDOMAIN)", normalized
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            try:
                resolver.resolve(domain, "A")
            except Exception:
                return False, f"Le domaine '{domain}' ne possède aucun enregistrement MX ou A", normalized
        except Exception:
            # Network latency or offline test environment, do not reject valid RFC format
            pass

    return True, "Email valide", normalized


def is_valid_email(email_str: str) -> bool:
    """Validates email RFC syntax safely without blocking DNS MX lookup."""
    is_valid, _, _ = validate_recipient_email(email_str, check_mx=False, block_disposable=False)
    return is_valid


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
            <a href="{action_url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #1877f2 0%, #0052cc 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(24, 119, 242, 0.35); letter-spacing: 0.3px;">
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
                        <td style="background: linear-gradient(135deg, #1877f2 0%, #16325c 100%); padding: 36px 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                                E-Schola <span style="color: #93c5fd;">Pro</span>
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


def get_smtp_runtime_config(session=None) -> Dict[str, Any]:
    """
    Dynamically loads SMTP, DKIM and Deliverability configuration:
    1. Checks SystemSetting from database if reachable.
    2. Falls back to settings from config.py / environment variables.
    """
    config: Dict[str, Any] = {
        "smtp_host": (settings.SMTP_HOST or "").strip(),
        "smtp_port": int(settings.SMTP_PORT or 587),
        "smtp_user": (settings.SMTP_USER or settings.SMTP_USERNAME or "").strip(),
        "smtp_password": (settings.SMTP_PASSWORD or "").strip(),
        "smtp_from_email": (settings.SMTP_FROM_EMAIL or settings.SMTP_FROM or settings.SMTP_USER or "contact@eschola.pro").strip(),
        "smtp_from_name": (settings.SMTP_FROM_NAME or "E-Schola Pro").strip(),
        "smtp_reply_to": (settings.SMTP_REPLY_TO or "").strip(),
        "smtp_tls": bool(settings.SMTP_TLS),
        "smtp_ssl": bool(settings.SMTP_SSL),
        "smtp_timeout": int(settings.SMTP_TIMEOUT or 15),
        "smtp_allow_insecure_tls": bool(settings.SMTP_ALLOW_INSECURE_TLS),
        "emails_enabled": bool(settings.EMAILS_ENABLED),
        "dkim_domain": (settings.DKIM_DOMAIN or "").strip(),
        "dkim_selector": (settings.DKIM_SELECTOR or "eschola").strip(),
        "dkim_private_key": (settings.DKIM_PRIVATE_KEY or "").strip(),
        "dkim_private_key_path": (settings.DKIM_PRIVATE_KEY_PATH or "").strip(),
        "email_validate_mx": bool(settings.EMAIL_VALIDATE_MX),
        "block_disposable_emails": bool(settings.BLOCK_DISPOSABLE_EMAILS),
    }

    close_session = False
    if session is None:
        try:
            from app.db.database import SessionLocal
            session = SessionLocal()
            close_session = True
        except Exception:
            session = None

    if session is not None:
        try:
            from app.models.system_setting import SystemSetting
            db_settings = session.query(SystemSetting).filter(
                SystemSetting.key.in_([
                    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
                    "smtp_from_email", "smtp_from_name", "smtp_reply_to",
                    "smtp_tls", "smtp_ssl", "smtp_timeout", "smtp_allow_insecure_tls",
                    "emails_enabled", "email_notifications_enabled",
                    "dkim_domain", "dkim_selector", "dkim_private_key",
                    "email_validate_mx", "block_disposable_emails"
                ])
            ).all()
            for s in db_settings:
                val = (s.value or "").strip()
                if s.key == "smtp_host" and val:
                    config["smtp_host"] = val
                elif s.key == "smtp_port" and val:
                    try:
                        config["smtp_port"] = int(val)
                    except Exception:
                        pass
                elif s.key == "smtp_user" and val:
                    config["smtp_user"] = val
                elif s.key == "smtp_password" and val:
                    config["smtp_password"] = val
                elif s.key == "smtp_from_email" and val:
                    config["smtp_from_email"] = val
                elif s.key == "smtp_from_name" and val:
                    config["smtp_from_name"] = val
                elif s.key == "smtp_reply_to" and val:
                    config["smtp_reply_to"] = val
                elif s.key == "smtp_tls" and val:
                    config["smtp_tls"] = val.lower() in ("true", "1", "yes", "on")
                elif s.key == "smtp_ssl" and val:
                    config["smtp_ssl"] = val.lower() in ("true", "1", "yes", "on")
                elif s.key == "smtp_timeout" and val:
                    try:
                        config["smtp_timeout"] = int(val)
                    except Exception:
                        pass
                elif s.key == "smtp_allow_insecure_tls" and val:
                    config["smtp_allow_insecure_tls"] = val.lower() in ("true", "1", "yes", "on")
                elif s.key in ("emails_enabled", "email_notifications_enabled") and val:
                    config["emails_enabled"] = val.lower() in ("true", "1", "yes", "on")
                elif s.key == "dkim_domain" and val:
                    config["dkim_domain"] = val
                elif s.key == "dkim_selector" and val:
                    config["dkim_selector"] = val
                elif s.key == "dkim_private_key" and val:
                    config["dkim_private_key"] = val
                elif s.key == "email_validate_mx" and val:
                    config["email_validate_mx"] = val.lower() in ("true", "1", "yes", "on")
                elif s.key == "block_disposable_emails" and val:
                    config["block_disposable_emails"] = val.lower() in ("true", "1", "yes", "on")
        except Exception:
            pass
        finally:
            if close_session:
                try:
                    session.close()
                except Exception:
                    pass

    return config


def is_smtp_configured(session=None) -> bool:
    """Returns True if a valid SMTP server is configured and active."""
    cfg = get_smtp_runtime_config(session=session)
    return bool(cfg.get("emails_enabled") and cfg.get("smtp_host"))


def build_mime_message(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    cfg: Optional[Dict[str, Any]] = None,
    custom_headers: Optional[Dict[str, str]] = None,
    reply_to: Optional[str] = None,
) -> MIMEMultipart:
    """Constructs RFC 5322 MIME message with robust custom headers and multipart body."""
    if cfg is None:
        cfg = get_smtp_runtime_config()

    from_email = cfg["smtp_from_email"] or cfg["smtp_user"] or "noreply@eschola.pro"
    from_name = cfg["smtp_from_name"] or "E-Schola Pro"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email

    # RFC 5322 Date
    msg["Date"] = email.utils.formatdate(localtime=True)

    # Cryptographic Message-ID (RFC 5322)
    domain_part = from_email.split("@")[-1] if "@" in from_email else "eschola.pro"
    message_id = f"<{uuid.uuid4().hex}@{domain_part}>"
    msg["Message-ID"] = message_id

    # Custom Transactional Headers & Anti-Spam Classification
    msg["X-Mailer"] = "E-Schola-Pro-Transactional-Mailer/2.0"
    msg["X-Entity-Ref-ID"] = str(uuid.uuid4())
    msg["Auto-Submitted"] = "auto-generated"
    msg["Precedence"] = "bulk"

    reply_to_addr = reply_to or cfg.get("smtp_reply_to")
    if reply_to_addr:
        msg["Reply-To"] = reply_to_addr

    # Extra custom headers if provided
    if custom_headers:
        for k, v in custom_headers.items():
            if k not in msg:
                msg[k] = v

    # Plain text fallback
    if not text_content:
        clean_text = re.sub(r"<[^>]+>", " ", html_content)
        text_content = " ".join(clean_text.split())

    part_text = MIMEText(text_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")

    msg.attach(part_text)
    msg.attach(part_html)

    return msg


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    session=None,
    custom_headers: Optional[Dict[str, str]] = None,
    reply_to: Optional[str] = None,
) -> bool:
    """
    Universal, robust and secure transactional email dispatcher with:
    - Multi-tier external address validation (syntax, MX, disposable check)
    - STARTTLS / SSL/TLS hardened with modern TLS 1.2+ SSLContext
    - Cryptographic DKIM signing (RFC 6376) if configured
    - Automatic Mock fallback in development or unconfigured environments
    - Transient connection retry mechanism
    """
    cfg = get_smtp_runtime_config(session=session)

    # 1. Validation
    is_valid, reason, normalized_to = validate_recipient_email(
        to_email,
        check_mx=cfg["email_validate_mx"],
        block_disposable=cfg["block_disposable_emails"],
    )
    if not is_valid:
        print(f"[Email Service Warning] Destinataire rejeté '{to_email}': {reason}. Envoi annulé.")
        return False

    to_email = normalized_to
    is_active = cfg["emails_enabled"] and bool(cfg["smtp_host"])

    # 2. Mock / Dev Fallback
    if not is_active:
        try:
            print(f"[Email Service (DEV/MOCK)] To: {to_email} | Subject: '{subject}'")
        except UnicodeEncodeError:
            safe_subject = subject.encode("ascii", "replace").decode("ascii")
            print(f"[Email Service (DEV/MOCK)] To: {to_email} | Subject: '{safe_subject}'")
        print(f"       -> SMTP is inactive or unconfigured in .env. Email was logged safely without error.")

        if not text_content:
            clean_text = re.sub(r"<[^>]+>", " ", html_content)
            text_content_preview = " ".join(clean_text.split())
        else:
            text_content_preview = text_content

        try:
            print(f"       -> [CONTENU EMAIL MOCK] :\n{text_content_preview[:300]}...\n")
        except UnicodeEncodeError:
            safe_preview = text_content_preview[:300].encode("ascii", errors="replace").decode("ascii")
            print(f"       -> [CONTENU EMAIL MOCK] :\n{safe_preview}...\n")
        return True

    # 3. Build RFC message
    msg = build_mime_message(
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        cfg=cfg,
        custom_headers=custom_headers,
        reply_to=reply_to,
    )

    from_email = cfg["smtp_from_email"] or cfg["smtp_user"] or "noreply@eschola.pro"
    raw_bytes = msg.as_bytes()

    # 4. Optional DKIM signing
    dkim_key = load_dkim_private_key(cfg)
    dkim_domain = cfg["dkim_domain"] or (from_email.split("@")[-1] if "@" in from_email else "")
    dkim_selector = cfg["dkim_selector"] or "eschola"

    if dkim_key and dkim_domain and dkim_selector:
        try:
            raw_bytes = sign_mime_message_dkim(
                raw_bytes,
                selector=dkim_selector,
                domain=dkim_domain,
                private_key=dkim_key,
            )
        except Exception as dkim_err:
            print(f"[Email Service Warning] DKIM signing failed: {dkim_err}. Sending unsigned.")

    # 5. Connect and send with retry
    host = cfg["smtp_host"]
    port = int(cfg["smtp_port"] or 587)
    timeout = int(cfg["smtp_timeout"] or 15)

    ssl_context = ssl.create_default_context()
    try:
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
    except Exception:
        pass

    if cfg["smtp_allow_insecure_tls"]:
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    max_retries = 2
    for attempt in range(1, max_retries + 1):
        server = None
        try:
            if cfg["smtp_ssl"] or port == 465:
                server = smtplib.SMTP_SSL(host, port, timeout=timeout, context=ssl_context)
            else:
                server = smtplib.SMTP(host, port, timeout=timeout)
                if cfg["smtp_tls"]:
                    server.starttls(context=ssl_context)

            if cfg["smtp_user"] and cfg["smtp_password"]:
                server.login(cfg["smtp_user"], cfg["smtp_password"])

            server.sendmail(from_email, [to_email], raw_bytes)
            server.quit()
            print(f"[Email Service] Email successfully sent to '{to_email}' via {host}:{port}.")
            return True

        except (socket.timeout, smtplib.SMTPServerDisconnected, ConnectionResetError) as transient_exc:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
            if attempt < max_retries:
                time.sleep(1.0)
                continue
            print(f"[Email Service Error] Transient network error delivering to '{to_email}': {transient_exc}")
            return False
        except Exception as exc:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
            print(f"[Email Service Error] Failed to send email to '{to_email}': {exc}")
            return False

    return False


def send_transactional_email_background(
    background_tasks,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    custom_headers: Optional[Dict[str, str]] = None,
    reply_to: Optional[str] = None,
) -> None:
    """Helper to dispatch transactional email via FastAPI BackgroundTasks non-blockingly."""
    background_tasks.add_task(
        send_email,
        to_email=to_email,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        custom_headers=custom_headers,
        reply_to=reply_to,
    )




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
    confirmation_code: Optional[str] = None,
    expires_in_minutes: Optional[int] = None,
    session=None,
) -> bool:
    """
    Sends a secure password reset email containing a 6-digit OTP code, expiration, and security warning.
    Compatible with all external domains (Gmail, Outlook, Yahoo, professional, custom).
    """
    if expires_in_minutes is None:
        expires_in_minutes = getattr(settings, "PASSWORD_RESET_OTP_EXPIRE_MINUTES", 10)

    subject = "🔒 Code OTP de réinitialisation de votre mot de passe - E-Schola Pro"
    preheader = f"Votre code OTP à 6 chiffres pour E-Schola Pro. Valable {expires_in_minutes} minutes."

    code_html = ""
    if confirmation_code:
        code_html = f"""
        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 22px; text-align: center; margin: 24px 0;">
            <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #475569; font-weight: 800; margin-bottom: 10px;">
                🔑 Votre Code OTP de Validation (6 chiffres)
            </span>
            <div style="font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #1877f2; background: #ffffff; padding: 14px 28px; border-radius: 10px; border: 2px solid #93c5fd; display: inline-block; box-shadow: 0 4px 10px rgba(24, 119, 242, 0.1);">
                {confirmation_code}
            </div>
            <p style="margin: 12px 0 0 0; font-size: 13px; color: #475569;">
                Durée de validité : <strong>{expires_in_minutes} minutes</strong> &bull; Usage unique
            </p>
        </div>
        """

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour <strong>{user_name}</strong>,
    </p>
    <p style="margin: 0 0 16px 0;">
        Une demande de réinitialisation de mot de passe a été initiée pour votre compte <strong>E-Schola Pro</strong> (<code>{to_email}</code>).
    </p>
    
    {code_html}

    <p style="margin: 0 0 16px 0;">
        Saisissez ce code dans l'application pour valider votre identité et définir un nouveau mot de passe, ou utilisez le bouton direct ci-dessous :
    </p>

    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 24px 0; color: #92400e; font-size: 13px; line-height: 1.5;">
        <strong>⚠️ Avertissement de sécurité :</strong> Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité. Aucun changement ne sera effectué sans ce code OTP. Ne transmettez jamais ce code à un tiers.
    </div>
    """

    html = get_base_html_template(
        title="Réinitialisation de mot de passe",
        preheader=preheader,
        body_content=body_content,
        action_url=reset_url,
        action_text="Réinitialiser mon mot de passe",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html, session=session)


def send_no_account_found_email(to_email: str, session=None) -> bool:
    """
    Sends an email informing the user that a password reset was requested for this email,
    but no active account was found, with a link to create an account.
    """
    frontend_url = os.getenv("FRONTEND_URL", "https://e-schola-pro-production.up.railway.app").rstrip("/")
    register_url = f"{frontend_url}/register"
    subject = "Information concernant votre demande de mot de passe - E-Schola Pro"
    preheader = "Demande de réinitialisation de mot de passe sur E-Schola Pro."

    body_content = f"""
    <p style="margin: 0 0 16px 0;">
        Bonjour,
    </p>
    <p style="margin: 0 0 16px 0;">
        Une demande de réinitialisation de mot de passe a été soumise pour l'adresse <strong>{to_email}</strong>.
    </p>
    <p style="margin: 0 0 16px 0;">
        Cependant, aucun compte n'est actuellement associé à cette adresse e-mail sur la plateforme <strong>E-Schola Pro</strong>.
    </p>
    <p style="margin: 0 0 20px 0;">
        Si vous n'avez pas encore de compte ou si vous souhaitez en créer un, cliquez sur le bouton ci-dessous :
    </p>
    """

    html = get_base_html_template(
        title="Aucun compte associé",
        preheader=preheader,
        body_content=body_content,
        action_url=register_url,
        action_text="Créer un compte E-Schola Pro",
    )

    return send_email(to_email=to_email, subject=subject, html_content=html, session=session)


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


def test_smtp_connection(test_recipient: Optional[str] = None, session=None) -> Dict[str, Any]:
    """
    Diagnostic tool to verify SMTP network reachability, TLS/SSL handshake,
    credentials authentication, and optional test email sending.
    """
    cfg = get_smtp_runtime_config(session=session)
    host = cfg["smtp_host"]
    port = int(cfg["smtp_port"] or 587)
    from_email = cfg["smtp_from_email"] or cfg["smtp_user"] or "test@eschola.pro"
    from_name = cfg["smtp_from_name"] or "E-Schola Pro"

    results: Dict[str, Any] = {
        "status": "pending",
        "smtp_host": host,
        "smtp_port": port,
        "emails_enabled": cfg["emails_enabled"],
        "tls": cfg["smtp_tls"],
        "ssl": cfg["smtp_ssl"],
        "user_configured": bool(cfg["smtp_user"]),
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
        if cfg["smtp_ssl"] or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout)
            results["steps"].append({"step": "SSL Connection (port 465)", "success": True})
        else:
            server = smtplib.SMTP(host, port, timeout=timeout)
            results["steps"].append({"step": "TCP Connection", "success": True})
            if cfg["smtp_tls"]:
                server.starttls()
                results["steps"].append({"step": "STARTTLS Handshake", "success": True})

        # Step 3: Authentication
        if cfg["smtp_user"] and cfg["smtp_password"]:
            server.login(cfg["smtp_user"], cfg["smtp_password"])
            results["steps"].append({"step": "Authentication", "success": True, "user": cfg["smtp_user"]})

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
                msg["From"] = f"{from_name} <{from_email}>"
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


def get_email_service_diagnostics(session=None) -> Dict[str, Any]:
    """
    Comprehensive diagnostic report covering:
    - Runtime SMTP connectivity and configuration
    - In-app DKIM signing readiness and DNS public key record
    - SPF and DMARC DNS recommendations and active query status
    - External address delivery policies (MX check, disposable block)
    """
    cfg = get_smtp_runtime_config(session=session)
    from_email = cfg["smtp_from_email"] or "contact@eschola.pro"
    domain = cfg["dkim_domain"] or (from_email.split("@")[-1] if "@" in from_email else "eschola.pro")
    selector = cfg["dkim_selector"] or "eschola"

    # 1. Base SMTP test
    smtp_diag = test_smtp_connection(session=session)

    # 2. DKIM diagnostics
    dkim_key = load_dkim_private_key(cfg)
    dkim_status: Dict[str, Any] = {
        "enabled": bool(dkim_key),
        "domain": domain,
        "selector": selector,
        "private_key_configured": bool(cfg["dkim_private_key"] or cfg["dkim_private_key_path"]),
        "key_valid_rsa": bool(dkim_key is not None),
        "dns_record": None,
    }
    if dkim_key:
        dkim_status["dns_record"] = get_dkim_dns_record_info(dkim_key, selector, domain)

    # 3. SPF and DMARC DNS queries and recommendations
    spf_dns_current = None
    dmarc_dns_current = None
    resolver = dns.resolver.Resolver()
    resolver.lifetime = 2.0

    try:
        spf_answers = resolver.resolve(domain, "TXT")
        for r in spf_answers:
            txt_val = "".join([part.decode("utf-8", errors="replace") for part in r.strings])
            if txt_val.startswith("v=spf1"):
                spf_dns_current = txt_val
                break
    except Exception:
        spf_dns_current = None

    try:
        dmarc_domain = f"_dmarc.{domain}".strip(".")
        dmarc_answers = resolver.resolve(dmarc_domain, "TXT")
        for r in dmarc_answers:
            txt_val = "".join([part.decode("utf-8", errors="replace") for part in r.strings])
            if txt_val.startswith("v=DMARC1"):
                dmarc_dns_current = txt_val
                break
    except Exception:
        dmarc_dns_current = None

    recommended_spf = f"v=spf1 include:{cfg['smtp_host']} ~all" if cfg["smtp_host"] else "v=spf1 mx ~all"
    recommended_dmarc = f"v=DMARC1; p=reject; sp=reject; rua=mailto:dmarc@{domain}; adkim=r; aspf=r"

    return {
        "status": "ready" if smtp_diag.get("status") == "success" else smtp_diag.get("status", "unknown"),
        "smtp": smtp_diag,
        "dkim": dkim_status,
        "spf": {
            "domain": domain,
            "current_dns_record": spf_dns_current,
            "recommended_record": {
                "record_type": "TXT",
                "record_name": domain,
                "record_value": recommended_spf,
            }
        },
        "dmarc": {
            "domain": f"_dmarc.{domain}".strip("."),
            "current_dns_record": dmarc_dns_current,
            "recommended_record": {
                "record_type": "TXT",
                "record_name": f"_dmarc.{domain}".strip("."),
                "record_value": recommended_dmarc,
            }
        },
        "policies": {
            "email_validate_mx": cfg["email_validate_mx"],
            "block_disposable_emails": cfg["block_disposable_emails"],
            "smtp_timeout": cfg["smtp_timeout"],
            "smtp_allow_insecure_tls": cfg["smtp_allow_insecure_tls"],
        }
    }


