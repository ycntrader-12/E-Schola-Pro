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
        role_display = role_labels.get(
            (new_user.role or "étudiant").lower().strip(),
            (new_user.role or "Étudiant").capitalize(),
        )

        welcome_subject = "Bienvenue sur la plateforme E-Schola Pro !"
        welcome_body = (
            f"Bonjour {user_name},\n\n"
            f"Toute l'équipe d'Administration vous souhaite la bienvenue sur E-Schola Pro !\n\n"
            f"Votre compte ({new_user.email}) est désormais actif avec le rôle '{role_display}'.\n\n"
            f"Vous pouvez dès à présent accéder à tous vos services :\n"
            f"• Vos cours et ressources d'apprentissage\n"
            f"• Vos salles vidéo conférence et le suivi de vos présences\n"
            f"• Vos devoirs, quiz et évaluations\n"
            f"• La messagerie interne pour échanger en direct avec vos formateurs et collègues.\n\n"
            f"Pour toute question, vous pouvez répondre directement à ce message.\n\n"
            f"Bien cordialement,\n"
            f"L'Administration E-Schola Pro"
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
                group_name=getattr(new_user, "group_name", None),
            )
    except Exception as mail_err:
        print(f"[WARN] Failed to dispatch welcome email: {mail_err}")

    return welcome_msg
