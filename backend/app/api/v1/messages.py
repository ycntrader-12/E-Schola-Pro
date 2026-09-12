from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import desc, func, or_

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limiter import rate_limiter
from app.core.sanitizer import (
    sanitize_attachment_url,
    sanitize_filename,
    sanitize_subject,
    sanitize_text,
)
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate, MessageReport, MessageResponse

router = APIRouter()

ADMIN_ROLES = ["admin", "admin_manager"]
RESTRICTED_BROADCAST_ROLES = ["employer", "employé", "étudiant", "etudiant", "stagiaire"]


@router.get("/inbox", response_model=list[MessageResponse])
def get_inbox_messages(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all received messages for the authenticated user (excluding trash and drafts).
    Strict authorization: strictly scoped to current_user.id.
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
    Get all sent messages for the authenticated user (excluding trash and drafts).
    Strict authorization: strictly scoped to current_user.id.
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
    Get all messages moved to trash involving the current user.
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
    Get the count of unread received messages for the authenticated user.
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


@router.post("", response_model=MessageResponse)
@router.post("/", response_model=MessageResponse)
def send_or_save_message(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    msg_in: MessageCreate,
) -> Any:
    """
    Send a new message or save as draft.
    Protected against:
    - Flooding / DoS (Rate limited)
    - Stored XSS / Injection (Text & Subject Sanitization)
    - Malicious Attachment URLs (Scheme & Protocol validation)
    - Unauthorized Broadcasts & Mass-recipient spamming
    """
    # 1. Anti-Flooding / Rate Limit Protection
    rate_limiter.check_rate_limit(
        identifier=f"msg_send_{current_user.id}",
        max_requests=25,
        window_seconds=60,
        action_name="envoi de messages",
    )

    user_role = (current_user.role or "").strip().lower()
    is_broadcast_req = msg_in.is_broadcast or (msg_in.recipient_id == -1)

    # 2. Input Sanitization (XSS & Protocol Protection)
    clean_subject = sanitize_subject(msg_in.subject)
    clean_body = sanitize_text(msg_in.body, max_length=50000, strip_html=True)

    raw_att_url = (msg_in.attachment_url or "").strip()
    clean_attachment_url = None
    if raw_att_url:
        clean_attachment_url = sanitize_attachment_url(raw_att_url)
        if not clean_attachment_url:
            raise HTTPException(
                status_code=400,
                detail="URL de pièce jointe non sécurisée ou protocole interdit (javascript:, vbscript:, etc.).",
            )

    clean_attachment_name = sanitize_filename(msg_in.attachment_name) if msg_in.attachment_name else None
    clean_attachment_type = sanitize_text(msg_in.attachment_type, max_length=50) if msg_in.attachment_type else None

    # 3. Anti-Spam: Recipient Count Limitation for Non-Staff Users
    if user_role in RESTRICTED_BROADCAST_ROLES:
        unique_targets = set()
        for rid in (msg_in.recipient_ids or []):
            if rid and rid > 0:
                unique_targets.add(f"id:{rid}")
        if msg_in.recipient_id and msg_in.recipient_id > 0:
            unique_targets.add(f"id:{msg_in.recipient_id}")
        for remail in (msg_in.recipient_emails or []):
            clean_em = (remail or "").strip().lower()
            if clean_em:
                unique_targets.add(f"email:{clean_em}")
        if msg_in.recipient_email:
            clean_em = msg_in.recipient_email.strip().lower()
            if clean_em:
                unique_targets.add(f"email:{clean_em}")
        for cc_id in (msg_in.cc_recipient_ids or []):
            if cc_id and cc_id > 0:
                unique_targets.add(f"id:{cc_id}")
        for cc_em in (msg_in.cc_emails or []):
            clean_em = (cc_em or "").strip().lower()
            if clean_em:
                unique_targets.add(f"email:{clean_em}")

        if len(unique_targets) > 10:
            raise HTTPException(
                status_code=403,
                detail="Protection anti-spam : les étudiants et employés ne peuvent pas dépasser 10 destinataires par message.",
            )

    # 4. Envoi Général / Broadcast Restriction Check
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
                subject=clean_subject if clean_subject != "(Sans objet)" else "(Brouillon général)",
                body=clean_body,
                attachment_url=clean_attachment_url,
                attachment_name=clean_attachment_name,
                attachment_type=clean_attachment_type,
                is_read=False,
                is_starred=False,
                is_draft=True,
                is_trash=False,
                is_reported=False,
                is_broadcast=True,
                is_welcome_msg=False,
                is_relay=False,
                cc_emails=None,
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
                subject=clean_subject,
                body=clean_body,
                attachment_url=clean_attachment_url,
                attachment_name=clean_attachment_name,
                attachment_type=clean_attachment_type,
                is_read=False,
                is_starred=False,
                is_draft=False,
                is_trash=False,
                is_reported=False,
                is_broadcast=True,
                is_welcome_msg=False,
                is_relay=False,
                cc_emails=None,
            )
            session.add(msg_item)
            if not sent_broadcast_msg:
                sent_broadcast_msg = msg_item

        # Create record in sent items for current user if no other users exist
        if not sent_broadcast_msg:
            sent_broadcast_msg = Message(
                sender_id=current_user.id,
                recipient_id=None,
                subject=clean_subject,
                body=clean_body,
                attachment_url=clean_attachment_url,
                attachment_name=clean_attachment_name,
                attachment_type=clean_attachment_type,
                is_read=True,
                is_starred=False,
                is_draft=False,
                is_trash=False,
                is_reported=False,
                is_broadcast=True,
                is_welcome_msg=False,
                is_relay=False,
                cc_emails=None,
            )
            session.add(sent_broadcast_msg)

        session.commit()
        session.refresh(sent_broadcast_msg)
        return sent_broadcast_msg

    # 5. Standard Personal & Multi-Recipient Resolution
    primary_users = []
    seen_ids = set()

    # Collect by recipient_ids list
    for r_id in (msg_in.recipient_ids or []):
        if r_id and r_id > 0 and r_id not in seen_ids:
            u = session.query(User).filter(User.id == r_id).first()
            if u:
                primary_users.append(u)
                seen_ids.add(u.id)

    # Collect by singular recipient_id
    if msg_in.recipient_id and msg_in.recipient_id > 0 and msg_in.recipient_id not in seen_ids:
        u = session.query(User).filter(User.id == msg_in.recipient_id).first()
        if u:
            primary_users.append(u)
            seen_ids.add(u.id)

    # Collect by recipient_emails list
    for r_email in (msg_in.recipient_emails or []):
        clean_email = sanitize_text(r_email, max_length=255).lower().strip()
        if clean_email:
            query_filter = (func.lower(User.email) == clean_email) | (func.lower(User.username) == clean_email)
            if clean_email.isdigit():
                query_filter = query_filter | (User.id == int(clean_email))
            u = session.query(User).filter(query_filter).first()
            if u and u.id not in seen_ids:
                primary_users.append(u)
                seen_ids.add(u.id)

    # Collect by singular recipient_email
    if msg_in.recipient_email:
        clean_email = sanitize_text(msg_in.recipient_email, max_length=255).lower().strip()
        if clean_email:
            query_filter = (func.lower(User.email) == clean_email) | (func.lower(User.username) == clean_email)
            if clean_email.isdigit():
                query_filter = query_filter | (User.id == int(clean_email))
            u = session.query(User).filter(query_filter).first()
            if u and u.id not in seen_ids:
                primary_users.append(u)
                seen_ids.add(u.id)

    # Fallback to external email string if non-registered recipient
    external_recipient_email = None
    if msg_in.recipient_email and msg_in.recipient_email.strip():
        external_recipient_email = sanitize_text(msg_in.recipient_email, max_length=255).strip()
    elif msg_in.recipient_emails and len(msg_in.recipient_emails) > 0:
        for em in msg_in.recipient_emails:
            clean_em = sanitize_text(em, max_length=255).strip()
            if clean_em:
                external_recipient_email = clean_em
                break

    if not primary_users and external_recipient_email:
        # If email looks valid, allow relay send
        if "@" in external_recipient_email:
            pass
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Destinataire '{external_recipient_email}' introuvable. Veuillez vérifier le nom d'utilisateur ou indiquer une adresse email valide avec '@'.",
            )

    if not msg_in.is_draft and not primary_users and not external_recipient_email:
        raise HTTPException(status_code=400, detail="Veuillez sélectionner au moins un destinataire valide.")

    cc_email_list = [
        sanitize_text(e, max_length=255).lower().strip()
        for e in (msg_in.cc_emails or [])
        if e and e.strip() and "@" in e
    ]
    cc_summary_str = ", ".join(cc_email_list) if cc_email_list else None
    has_relay = bool(cc_email_list or (external_recipient_email and not primary_users))

    # Draft saving
    if msg_in.is_draft:
        draft_recipient_id = primary_users[0].id if primary_users else None
        draft_msg = Message(
            sender_id=current_user.id,
            recipient_id=draft_recipient_id,
            subject=clean_subject if clean_subject != "(Sans objet)" else "(Brouillon)",
            body=clean_body,
            attachment_url=clean_attachment_url,
            attachment_name=clean_attachment_name,
            attachment_type=clean_attachment_type,
            is_read=False,
            is_starred=False,
            is_draft=True,
            is_trash=False,
            is_reported=False,
            is_broadcast=False,
            is_welcome_msg=False,
            is_relay=has_relay,
            cc_emails=cc_summary_str,
        )
        session.add(draft_msg)
        session.commit()
        session.refresh(draft_msg)
        return draft_msg

    # Active Sending
    created_primary_messages = []
    if primary_users:
        for recipient in primary_users:
            main_msg = Message(
                sender_id=current_user.id,
                recipient_id=recipient.id,
                subject=clean_subject,
                body=clean_body,
                attachment_url=clean_attachment_url,
                attachment_name=clean_attachment_name,
                attachment_type=clean_attachment_type,
                is_read=False,
                is_starred=False,
                is_draft=False,
                is_trash=False,
                is_reported=False,
                is_broadcast=False,
                is_welcome_msg=False,
                is_relay=has_relay,
                cc_emails=cc_summary_str,
            )
            session.add(main_msg)
            created_primary_messages.append(main_msg)
    else:
        # Relay only external recipient
        main_msg = Message(
            sender_id=current_user.id,
            recipient_id=None,
            subject=clean_subject,
            body=clean_body,
            attachment_url=clean_attachment_url,
            attachment_name=clean_attachment_name,
            attachment_type=clean_attachment_type,
            is_read=False,
            is_starred=False,
            is_draft=False,
            is_trash=False,
            is_reported=False,
            is_broadcast=False,
            is_welcome_msg=False,
            is_relay=True,
            cc_emails=f"{external_recipient_email}, {cc_summary_str}" if cc_summary_str else external_recipient_email,
        )
        session.add(main_msg)
        created_primary_messages.append(main_msg)

    # Dispatch CC copies (once per unique CC user)
    processed_cc_ids = set(seen_ids)
    processed_cc_ids.add(current_user.id)

    # A) CC by recipient IDs
    for cc_id in (msg_in.cc_recipient_ids or []):
        if cc_id and cc_id not in processed_cc_ids:
            cc_user = session.query(User).filter(User.id == cc_id).first()
            if cc_user:
                processed_cc_ids.add(cc_user.id)
                cc_msg = Message(
                    sender_id=current_user.id,
                    recipient_id=cc_user.id,
                    subject=f"[Copie] {clean_subject}",
                    body=f"--- Message en copie (CC) ---\n\n{clean_body}",
                    attachment_url=clean_attachment_url,
                    attachment_name=clean_attachment_name,
                    attachment_type=clean_attachment_type,
                    is_read=False,
                    is_starred=False,
                    is_draft=False,
                    is_trash=False,
                    is_reported=False,
                    is_broadcast=False,
                    is_welcome_msg=False,
                    is_relay=False,
                    cc_emails=cc_summary_str,
                )
                session.add(cc_msg)

    # B) CC by email addresses
    for email_addr in cc_email_list:
        cc_user = session.query(User).filter(
            (func.lower(User.email) == email_addr) | (func.lower(User.username) == email_addr)
        ).first()
        if cc_user and cc_user.id not in processed_cc_ids:
            processed_cc_ids.add(cc_user.id)
            cc_msg = Message(
                sender_id=current_user.id,
                recipient_id=cc_user.id,
                subject=f"[Copie] {clean_subject}",
                body=f"--- Message en copie (CC) ---\n\n{clean_body}",
                attachment_url=clean_attachment_url,
                attachment_name=clean_attachment_name,
                attachment_type=clean_attachment_type,
                is_read=False,
                is_starred=False,
                is_draft=False,
                is_trash=False,
                is_reported=False,
                is_broadcast=False,
                is_welcome_msg=False,
                is_relay=True,
                cc_emails=cc_summary_str,
            )
            session.add(cc_msg)

    session.commit()
    for m in created_primary_messages:
        session.refresh(m)

    return created_primary_messages[0]


@router.get("/{message_id}", response_model=MessageResponse)
def get_message_detail(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get message details. Marks as read if current user is the recipient.
    Strict IDOR prevention: only sender, recipient, or admin can access.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in ADMIN_ROLES
    ):
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce message.")

    # Mark as read if opened by recipient
    if msg.recipient_id == current_user.id and not msg.is_draft:
        if not msg.is_read:
            msg.is_read = True
            if not msg.read_at:
                msg.read_at = datetime.utcnow()
            session.commit()
            session.refresh(msg)

    return msg


@router.put("/{message_id}/read")
def mark_message_as_read(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Mark a message as read.
    Allowed for recipient or admin.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if msg.recipient_id != current_user.id and current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    msg.is_read = True
    if not msg.read_at:
        msg.read_at = datetime.utcnow()
    session.commit()
    session.refresh(msg)
    return {"message_id": message_id, "is_read": True, "read_at": msg.read_at}


@router.put("/{message_id}/unread")
def mark_message_as_unread(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Mark a message as unread.
    Allowed for recipient or admin.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if msg.recipient_id != current_user.id and current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    msg.is_read = False
    msg.read_at = None
    session.commit()
    session.refresh(msg)
    return {"message_id": message_id, "is_read": False, "read_at": None}


@router.put("/{message_id}/star")
def toggle_star_message(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Toggle star / favorite flag for a message.
    Strict IDOR prevention: only sender, recipient, or admin can toggle.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in ADMIN_ROLES
    ):
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    msg.is_starred = not bool(getattr(msg, "is_starred", False))
    session.commit()
    session.refresh(msg)
    return {"message_id": message_id, "is_starred": msg.is_starred}


@router.put("/{message_id}/restore")
def restore_message_from_trash(
    message_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Restore a message from trash.
    Strict IDOR prevention: only sender, recipient, or admin can restore.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in ADMIN_ROLES
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
    Strict IDOR prevention: only sender, recipient, or admin can delete.
    """
    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    if (
        msg.sender_id != current_user.id
        and msg.recipient_id != current_user.id
        and current_user.role not in ADMIN_ROLES
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
    Report a message for suspicious or inappropriate content.
    Automatically forwards the report to:
    1. All administrators ('admin' and 'admin_manager')
    2. The trainer(s) ('formateur' / 'pedagogique') if the user belongs to their group / promotion / course.
    """
    # 1. Rate Limiting on Reports (Anti-Flooding)
    rate_limiter.check_rate_limit(
        identifier=f"msg_report_{current_user.id}",
        max_requests=5,
        window_seconds=60,
        action_name="signalement de messages",
    )

    msg = session.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message introuvable.")

    # 2. Strict IDOR Authorization Check
    is_involved = (
        msg.recipient_id == current_user.id
        or msg.sender_id == current_user.id
        or current_user.role in ADMIN_ROLES
    )
    if not is_involved:
        raise HTTPException(
            status_code=403,
            detail="Accès non autorisé : vous ne pouvez signaler qu'un message dont vous êtes le destinataire direct.",
        )

    if msg.sender_id == current_user.id and current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Vous ne pouvez pas signaler un message que vous avez vous-même rédigé.",
        )

    # 3. Sanitize Reason
    clean_reason = sanitize_text(report_in.reason, max_length=1000) or "Contenu inapproprié ou offensant"

    # Flag the original message
    msg.is_reported = True
    msg.report_reason = clean_reason

    # 4. Resolve Target Recipients:
    # A) All admins and admin_managers
    admin_targets = (
        session.query(User)
        .filter(User.role.in_(["admin", "admin_manager"]))
        .all()
    )

    # B) Formateurs matching the user's or author's group / courses
    from app.models.group import Group, GroupMember
    from app.models.course import Course
    from app.models.enrollment import Enrollment
    from app.services.email_service import send_notification_email

    group_ids = set()
    group_names = set()

    # Group names from User models
    if current_user.group_name and current_user.group_name.strip():
        group_names.add(current_user.group_name.strip().lower())
    if msg.sender and msg.sender.group_name and msg.sender.group_name.strip():
        group_names.add(msg.sender.group_name.strip().lower())

    # Group IDs from GroupMember table
    memberships = (
        session.query(GroupMember)
        .filter(GroupMember.user_id.in_([current_user.id, msg.sender_id]))
        .all()
    )
    for m in memberships:
        group_ids.add(m.group_id)

    if group_names:
        matched_groups = (
            session.query(Group)
            .filter(func.lower(Group.name).in_(list(group_names)))
            .all()
        )
        for g in matched_groups:
            group_ids.add(g.id)

    formateur_targets = set()

    # 1. Formateurs in matching GroupMember
    if group_ids:
        grp_formateurs = (
            session.query(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(
                GroupMember.group_id.in_(list(group_ids)),
                User.role.in_(["formateur", "pedagogique"]),
            )
            .all()
        )
        for f in grp_formateurs:
            formateur_targets.add(f)

    # 2. Formateurs with matching group_name field
    if group_names:
        named_formateurs = (
            session.query(User)
            .filter(
                func.lower(func.coalesce(User.group_name, "")).in_(list(group_names)),
                User.role.in_(["formateur", "pedagogique"]),
            )
            .all()
        )
        for f in named_formateurs:
            formateur_targets.add(f)

    # 3. Formateurs of courses the reporting user or author is enrolled in
    enrolled_courses = (
        session.query(Course.instructor_id)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(
            Enrollment.user_id.in_([current_user.id, msg.sender_id]),
            Course.instructor_id.isnot(None),
        )
        .all()
    )
    for (inst_id,) in enrolled_courses:
        if inst_id:
            inst_user = (
                session.query(User)
                .filter(
                    User.id == inst_id,
                    User.role.in_(["formateur", "pedagogique"]),
                )
                .first()
            )
            if inst_user:
                formateur_targets.add(inst_user)

    # Combine all recipients (deduplicated by user.id)
    all_recipients_dict = {}
    for u in admin_targets:
        if u.id != current_user.id:
            all_recipients_dict[u.id] = u
    for u in formateur_targets:
        if u.id != current_user.id:
            all_recipients_dict[u.id] = u

    recipient_list = list(all_recipients_dict.values())

    # Build detailed alert report
    sender_name = f"{msg.sender.prenom or ''} {msg.sender.nom or ''}".strip() if msg.sender else ""
    sender_email = msg.sender.email if msg.sender else f"ID #{msg.sender_id}"
    sender_role = msg.sender.role if msg.sender else "Inconnu"
    sender_group = msg.sender.group_name if msg.sender and msg.sender.group_name else "Aucun groupe"

    reporter_name = (
        f"{current_user.prenom or ''} {current_user.nom or ''}".strip()
        or current_user.username
        or current_user.email
    )
    reporter_group = current_user.group_name or "Aucun groupe"

    formatted_date = (
        msg.created_at.strftime("%d/%m/%Y à %H:%M")
        if msg.created_at
        else "Date inconnue"
    )

    alert_subject = f"🚨 [SIGNALEMENT] Message #{msg.id} signalé par {reporter_name}"
    alert_body = (
        f"=============================================================\n"
        f"⚠️ RAPPORT OFFICIEL DE SIGNALEMENT DE MESSAGE\n"
        f"=============================================================\n"
        f"👤 Signalé par : {reporter_name} ({current_user.email})\n"
        f"   • Rôle : {current_user.role}\n"
        f"   • Groupe / Promotion : {reporter_group}\n\n"
        f"✉️ Auteur du message suspect : {sender_name or sender_email} ({sender_email})\n"
        f"   • Rôle : {sender_role}\n"
        f"   • Groupe : {sender_group}\n\n"
        f"📅 Date d'envoi du message : {formatted_date}\n"
        f"📌 Objet d'origine : {msg.subject}\n"
        f"🚩 Motif du signalement : {clean_reason}\n\n"
        f"--- CONTENU TRANSMIS DU MESSAGE SIGNALÉ ---\n"
        f"{msg.body}\n"
        f"=============================================================\n"
        f"Ce signalement vous a été automatiquement transmis en tant qu'administrateur, "
        f"gestionnaire ou formateur référent du groupe de l'utilisateur."
    )

    for target_user in recipient_list:
        alert_msg = Message(
            sender_id=current_user.id,
            recipient_id=target_user.id,
            subject=alert_subject,
            body=alert_body,
            attachment_url=msg.attachment_url,
            attachment_name=msg.attachment_name,
            attachment_type=msg.attachment_type,
            is_read=False,
            is_draft=False,
            is_trash=False,
            is_reported=True,
            report_reason=clean_reason,
            is_broadcast=False,
            is_welcome_msg=False,
            is_relay=True,
        )
        session.add(alert_msg)

        # Dispatch email notification if SMTP is configured
        try:
            if target_user.email and "@" in target_user.email:
                send_notification_email(
                    to_email=target_user.email,
                    subject=f"🚨 [Signalement E-Schola Pro] Message #{msg.id} signalé",
                    title="Signalement de message suspect",
                    message_text=(
                        f"Un message a été signalé par <strong>{reporter_name}</strong> (Groupe: {reporter_group}) "
                        f"avec le motif suivant : <em>« {clean_reason} »</em>.<br><br>"
                        f"<strong>Auteur du message :</strong> {sender_name or sender_email} ({sender_role})<br>"
                        f"<strong>Objet :</strong> {msg.subject}<br><br>"
                        f"Ce rapport vous est transmis en tant qu'administrateur ou formateur du groupe. "
                        f"Veuillez vous connecter à votre espace E-Schola Pro pour examiner ce dossier."
                    ),
                    action_text="Consulter la messagerie",
                )
        except Exception as mail_err:
            print(f"[WARN] Failed to send report notification email to {target_user.email}: {mail_err}")

    session.commit()
    session.refresh(msg)

    admin_count = len([u for u in recipient_list if u.role in ["admin", "admin_manager"]])
    formateur_count = len([u for u in recipient_list if u.role in ["formateur", "pedagogique"]])

    return {
        "message": (
            f"Signalement transmis avec succès ({admin_count} administrateur(s) et "
            f"{formateur_count} formateur(s) de groupe notifié(s))."
        ),
        "reported_message_id": message_id,
        "admins_notified": admin_count,
        "formateurs_notified": formateur_count,
        "total_recipients": len(recipient_list),
    }
