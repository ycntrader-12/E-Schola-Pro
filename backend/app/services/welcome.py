from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.user import User
from app.services.email_service import send_welcome_email

ADMIN_ROLES = ["admin", "admin_manager"]


def send_welcome_message(session: Session, new_user: User) -> Message | None:
    """
    Sends an automatic welcome message to a newly created user account
    (both in-app message and via SMTP email when configured).
    """
    welcome_msg = None
    user_name = f"{new_user.prenom or ''} {new_user.nom or ''}".strip()
    if not user_name:
        user_name = new_user.username or new_user.email.split("@")[0]

    # 1. Dispatch in-app message
    try:
        # Find a primary administrator to act as the sender
        admin_sender = (
            session.query(User)
            .filter(User.role.in_(ADMIN_ROLES))
            .order_by(User.id.asc())
            .first()
        )

        sender_id = admin_sender.id if admin_sender else new_user.id

        welcome_subject = "Bienvenue sur la plateforme E-Schola Pro !"
        welcome_body = (
            f"Bonjour {user_name},\n\n"
            f"Nous sommes ravis de vous accueillir sur la plateforme d'enseignement E-Schola Pro !\n"
            f"Votre compte ({new_user.email}) a été créé avec succès avec le rôle '{new_user.role}'.\n\n"
            f"Vous avez désormais accès à l'ensemble de vos fonctionnalités :\n"
            f"- Consultation de vos cours, devoirs et ressources pédagogiques\n"
            f"- Accès au calendrier et au suivi des présences\n"
            f"- Participation aux salles vidéo conférence en direct\n"
            f"- Messagerie sécurisée et échanges personnels en direct avec vos formateurs et collègues.\n\n"
            f"Pour toute assistance, vous pouvez contacter l'équipe d'administration ou poser vos questions via cette messagerie.\n\n"
            f"Bien cordialement,\n"
            f"L'équipe d'Administration E-Schola Pro"
        )

        welcome_msg = Message(
            sender_id=sender_id,
            recipient_id=new_user.id,
            subject=welcome_subject,
            body=welcome_body,
            is_read=False,
            is_draft=False,
            is_trash=False,
            is_welcome_msg=True,
            is_broadcast=False,
            is_relay=False,
        )

        with session.begin_nested():
            session.add(welcome_msg)
        session.commit()
        session.refresh(welcome_msg)
    except Exception as e:
        session.rollback()
        # Log error gracefully so user creation is not aborted if in-app welcome message fails
        print(f"[WARN] Failed to send automatic in-app welcome message: {e}")

    # 2. Dispatch real SMTP welcome email (or dev mock log)
    try:
        if new_user.email and "@" in new_user.email:
            send_welcome_email(
                to_email=new_user.email,
                user_name=user_name,
                role=new_user.role or "étudiant",
            )
    except Exception as mail_err:
        print(f"[WARN] Failed to dispatch welcome email: {mail_err}")

    return welcome_msg
