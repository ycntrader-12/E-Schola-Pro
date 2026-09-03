from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import desc, or_

from app.api.deps import CurrentUser, SessionDep
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate, MessageReport, MessageResponse

router = APIRouter()


@router.get("/inbox", response_model=list[MessageResponse])
def get_inbox_messages(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all received messages (excluding trash and drafts).
    """
    messages = (
        session.query(Message)
        .filter(
            Message.recipient_id == current_user.id,
            Message.is_trash == False,
            Message.is_draft == False,
        )
        .order_by(desc(Message.created_at))
        .all()
    )
    return messages


@router.get("/sent", response_model=list[MessageResponse])
def get_sent_messages(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all sent messages (excluding trash and drafts).
    """
    messages = (
        session.query(Message)
        .filter(
            Message.sender_id == current_user.id,
            Message.is_trash == False,
            Message.is_draft == False,
        )
        .order_by(desc(Message.created_at))
        .all()
    )
    return messages


@router.get("/drafts", response_model=list[MessageResponse])
def get_draft_messages(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all draft messages created by the current user.
    """
    messages = (
        session.query(Message)
        .filter(
            Message.sender_id == current_user.id,
            Message.is_draft == True,
            Message.is_trash == False,
        )
        .order_by(desc(Message.created_at))
        .all()
    )
    return messages


@router.get("/trash", response_model=list[MessageResponse])
def get_trash_messages(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all messages moved to trash by the current user.
    """
    messages = (
        session.query(Message)
        .filter(
            or_(
                Message.recipient_id == current_user.id,
                Message.sender_id == current_user.id,
            ),
            Message.is_trash == True,
        )
        .order_by(desc(Message.created_at))
        .all()
    )
    return messages


@router.get("/unread-count")
def get_unread_count(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get the count of unread received messages (excluding trash).
    """
    count = (
        session.query(Message)
        .filter(
            Message.recipient_id == current_user.id,
            Message.is_read == False,
            Message.is_trash == False,
            Message.is_draft == False,
        )
        .count()
    )
    return {"unread_count": count}


RESTRICTED_BROADCAST_ROLES = ["employer", "employé", "étudiant", "etudiant", "stagiaire"]


@router.post("/", response_model=MessageResponse)
def send_or_save_message(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    msg_in: MessageCreate,
) -> Any:
    """
    Send a new message or save as draft.
    Supports personal messages, broadcast ("All") with role restrictions, and CC (copie) in local & relay modes.
    """
    user_role = (current_user.role or "").strip().lower()
    is_broadcast_req = msg_in.is_broadcast or (msg_in.recipient_id == -1)

    # 1. Envoi Général / Broadcast Restriction Check
    if is_broadcast_req:
        if user_role in RESTRICTED_BROADCAST_ROLES:
            raise HTTPException(
                status_code=403,
                detail="L'envoi de messages généraux (Broadcast / All) est strictement interdit pour les employés, étudiants et stagiaires.",
            )

        if msg_in.is_draft:
            new_msg = Message(
                sender_id=current_user.id,
                recipient_id=None,
                subject=msg_in.subject.strip() if msg_in.subject else "(Brouillon général)",
                body=msg_in.body.strip() if msg_in.body else "",
                attachment_url=msg_in.attachment_url,
                attachment_name=msg_in.attachment_name,
                attachment_type=msg_in.attachment_type,
                is_read=False,
                is_draft=True,
                is_trash=False,
                is_broadcast=True,
            )
            session.add(new_msg)
            session.commit()
            session.refresh(new_msg)
            return new_msg

        # Broadcast send: query all active users except current user
        target_users = (
            session.query(User)
            .filter(User.id != current_user.id)
            .all()
        )

        sent_broadcast_msg = None
        for target_user in target_users:
            msg_item = Message(
                sender_id=current_user.id,
                recipient_id=target_user.id,
                subject=msg_in.subject.strip() if msg_in.subject else "(Sans objet)",
                body=msg_in.body.strip() if msg_in.body else "",
                attachment_url=msg_in.attachment_url,
                attachment_name=msg_in.attachment_name,
                attachment_type=msg_in.attachment_type,
                is_read=False,
                is_draft=False,
                is_trash=False,
                is_broadcast=True,
            )
            session.add(msg_item)
            if not sent_broadcast_msg:
                sent_broadcast_msg = msg_item

        # Create record in sent items for current user if no other users exist
        if not sent_broadcast_msg:
            sent_broadcast_msg = Message(
                sender_id=current_user.id,
                recipient_id=None,
                subject=msg_in.subject.strip() if msg_in.subject else "(Sans objet)",
                body=msg_in.body.strip() if msg_in.body else "",
                attachment_url=msg_in.attachment_url,
                attachment_name=msg_in.attachment_name,
                attachment_type=msg_in.attachment_type,
                is_read=True,
                is_draft=False,
                is_trash=False,
                is_broadcast=True,
            )
            session.add(sent_broadcast_msg)

        session.commit()
        session.refresh(sent_broadcast_msg)
        return sent_broadcast_msg

    # 2. Standard Personal Message & CC Processing
    recipient = None
    if msg_in.recipient_id and msg_in.recipient_id > 0:
        recipient = session.query(User).filter(User.id == msg_in.recipient_id).first()
    elif msg_in.recipient_email:
        recipient = (
            session.query(User)
            .filter(User.email == msg_in.recipient_email.strip().lower())
            .first()
        )

    # If it's not a draft, primary recipient is mandatory
    if not msg_in.is_draft and not recipient:
        raise HTTPException(status_code=404, detail="Destinataire principal introuvable.")

    cc_email_list = [e.strip().lower() for e in msg_in.cc_emails if e and e.strip()]
    cc_summary_str = ", ".join(cc_email_list) if cc_email_list else None
    has_relay = bool(cc_email_list or (msg_in.recipient_email and not recipient))

    main_msg = Message(
        sender_id=current_user.id,
        recipient_id=recipient.id if recipient else None,
        subject=msg_in.subject.strip() if msg_in.subject else "(Sans objet)",
        body=msg_in.body.strip() if msg_in.body else "",
        attachment_url=msg_in.attachment_url,
        attachment_name=msg_in.attachment_name,
        attachment_type=msg_in.attachment_type,
        is_read=False,
        is_draft=msg_in.is_draft,
        is_trash=False,
        is_broadcast=False,
        is_relay=has_relay,
        cc_emails=cc_summary_str,
    )
    session.add(main_msg)

    # If sending (not draft), dispatch CC copies to specified users/emails
    if not msg_in.is_draft:
        processed_cc_ids = set()
        if recipient:
            processed_cc_ids.add(recipient.id)
        processed_cc_ids.add(current_user.id)

        # A) CC by recipient IDs
        for cc_id in msg_in.cc_recipient_ids:
            if cc_id not in processed_cc_ids:
                cc_user = session.query(User).filter(User.id == cc_id).first()
                if cc_user:
                    processed_cc_ids.add(cc_user.id)
                    cc_msg = Message(
                        sender_id=current_user.id,
                        recipient_id=cc_user.id,
                        subject=f"[Copie] {main_msg.subject}",
                        body=f"--- Message en copie (CC) envoyé à {recipient.email if recipient else 'destinataire'} ---\n\n{main_msg.body}",
                        attachment_url=main_msg.attachment_url,
                        attachment_name=main_msg.attachment_name,
                        attachment_type=main_msg.attachment_type,
                        is_read=False,
                        is_draft=False,
                        is_trash=False,
                        is_broadcast=False,
                        is_relay=False,
                        cc_emails=cc_summary_str,
                    )
                    session.add(cc_msg)

        # B) CC by email addresses (local DB users or external relay)
        for email_addr in cc_email_list:
            cc_user = session.query(User).filter(User.email == email_addr).first()
            if cc_user and cc_user.id not in processed_cc_ids:
                processed_cc_ids.add(cc_user.id)
                cc_msg = Message(
                    sender_id=current_user.id,
                    recipient_id=cc_user.id,
                    subject=f"[Copie] {main_msg.subject}",
                    body=f"--- Message en copie (CC) envoyé à {recipient.email if recipient else 'destinataire'} ---\n\n{main_msg.body}",
                    attachment_url=main_msg.attachment_url,
                    attachment_name=main_msg.attachment_name,
                    attachment_type=main_msg.attachment_type,
                    is_read=False,
                    is_draft=False,
                    is_trash=False,
                    is_broadcast=False,
                    is_relay=True,
                    cc_emails=cc_summary_str,
                )
                session.add(cc_msg)

    session.commit()
    session.refresh(main_msg)
    return main_msg


@router.get("/{message_id}", response_model=MessageResponse)
def get_message_detail(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get message details. Marks as read if current user is the recipient.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    admin_roles = ["admin", "admin_manager", "admin_limited"]
    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in admin_roles
    ):
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce message.")

    # Mark as read if opened by recipient
    if msg.recipient_id == current_user.id and not msg.is_read and not msg.is_draft:
        msg.is_read = True
        session.commit()
        session.refresh(msg)

    return msg


@router.put("/{message_id}/restore")
def restore_message_from_trash(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Restore a message from trash.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    admin_roles = ["admin", "admin_manager", "admin_limited"]
    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in admin_roles
    ):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    msg.is_trash = False
    session.commit()
    return {"message": "Message restauré avec succès.", "id": message_id}


@router.delete("/{message_id}")
def delete_message(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a message: soft-delete to trash on first deletion, permanent delete on second.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    admin_roles = ["admin", "admin_manager", "admin_limited"]
    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in admin_roles
    ):
        raise HTTPException(
            status_code=403, detail="Accès non autorisé pour supprimer ce message."
        )

    if not msg.is_trash:
        # Move to trash
        msg.is_trash = True
        session.commit()
        return {
            "message": "Message déplacé vers la corbeille.",
            "action": "trash",
            "id": message_id,
        }
    else:
        # Permanent delete
        session.delete(msg)
        session.commit()
        return {
            "message": "Message définitivement supprimé.",
            "action": "permanent_delete",
            "id": message_id,
        }


@router.post("/{message_id}/report")
def report_message(
    message_id: int,
    report_in: MessageReport,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Report a message. Automatically alerts and transmits directly to ALL admins and instructors.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    # Flag the original message
    msg.is_reported = True
    msg.report_reason = report_in.reason

    sender_email = msg.sender.email if msg.sender else f"ID #{msg.sender_id}"

    # Find all instructors and administrators to receive direct transmitted report
    staff_users = (
        session.query(User)
        .filter(User.role.in_(["admin", "admin_manager", "admin_limited", "formateur", "pedagogique"]))
        .all()
    )

    alert_subject = (
        f"🚨 [SIGNALEMENT DIRECT] Message suspect signalé par {current_user.email}"
    )
    alert_body = (
        f"=============================================================\n"
        f"⚠️ RAPPORT DE SIGNALEMENT AUTOMATIQUE DE MESSAGE\n"
        f"=============================================================\n"
        f"Signalé par : {current_user.email} (ID #{current_user.id}, Rôle : {current_user.role})\n"
        f"Auteur du message suspect : {sender_email} (ID #{msg.sender_id})\n"
        f"Date d'envoi du message : {msg.created_at.strftime('%d/%m/%Y à %H:%M')}\n"
        f"Objet d'origine : {msg.subject}\n"
        f"Motif du signalement : {report_in.reason}\n\n"
        f"--- CONTENU TRANSMIS DU MESSAGE SIGNALÉ ---\n"
        f"{msg.body}\n"
        f"=============================================================\n"
        f"Ce message vous est transmis automatiquement car vous êtes formateur ou administrateur."
    )

    for staff in staff_users:
        if staff.id != current_user.id:
            alert_msg = Message(
                sender_id=current_user.id,
                recipient_id=staff.id,
                subject=alert_subject,
                body=alert_body,
                attachment_url=msg.attachment_url,
                attachment_name=msg.attachment_name,
                attachment_type=msg.attachment_type,
                is_read=False,
                is_draft=False,
                is_trash=False,
            )
            session.add(alert_msg)

    session.commit()
    return {
        "message": f"Signalement transmis directement aux formateurs et administrateurs ({len(staff_users)} destinataires notifiés).",
        "reported_message_id": message_id,
    }
