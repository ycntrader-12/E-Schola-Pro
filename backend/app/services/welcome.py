from sqlalchemy.orm import Session

from app.models.message import Message
from app.models.user import User

ADMIN_ROLES = ["admin", "admin_manager", "admin_limited"]


def send_welcome_message(session: Session, new_user: User) -> Message | None:
    """
    Sends an automatic welcome message to a newly created user account
    (whether self-registered or created by an administrator).
    """
    try:
        # Find a primary administrator to act as the sender
        admin_sender = (
            session.query(User)
            .filter(User.role.in_(ADMIN_ROLES))
            .order_by(User.id.asc())
            .first()
        )

        sender_id = admin_sender.id if admin_sender else new_user.id

        user_name = f"{new_user.prenom or ''} {new_user.nom or ''}".strip()
        if not user_name:
            user_name = new_user.username or new_user.email.split("@")[0]

        welcome_subject = "Bienvenue sur la plateforme Oskula (E-Schola Pro) !"
        welcome_body = (
            f"Bonjour {user_name},\n\n"
            f"Nous sommes ravis de vous accueillir sur la plateforme Oskula (E-Schola Pro) !\n"
            f"Votre compte ({new_user.email}) a été créé avec succès avec le rôle '{new_user.role}'.\n\n"
            f"Vous avez désormais accès à l'ensemble de vos fonctionnalités :\n"
            f"- Consultation de vos cours, devoirs et ressources pédagogiques\n"
            f"- Accès au calendrier et au suivi des présences\n"
            f"- Participation aux classes virtuelles en direct\n"
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
        return welcome_msg
    except Exception as e:
        session.rollback()
        # Log error gracefully so user creation is not aborted if welcome message fails
        print(f"[WARN] Failed to send automatic welcome message: {e}")
        return None
