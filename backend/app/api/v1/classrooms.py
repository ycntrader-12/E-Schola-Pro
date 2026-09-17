from datetime import datetime, date
from typing import Any
import uuid

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limiter import rate_limiter
from app.core.roles import (
    ADMIN_ROLES,
    STAFF_ROLES,
    is_admin,
    is_learner,
    is_staff,
    matches_target_role,
    require_admin,
    require_staff,
)
from app.core.sanitizer import sanitize_attachment_url, sanitize_text
from app.models.attendance import Attendance
from app.models.classroom import Classroom
from app.models.classroom_invitation import ClassroomInvitation
from app.models.group import Group, GroupMember
from app.models.message import Message
from app.models.user import User
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomResponse,
    ClassroomInviteCreate,
    ClassroomInvitationResponse,
)
from app.services.classroom_signaling import signaling_manager
from app.services.email_service import send_classroom_invitation_email

router = APIRouter()


def generate_room_code() -> str:
    # Generates a Google Meet style code: xxx-yyyy-zzz
    raw = uuid.uuid4().hex[:10]
    return f"{raw[:3]}-{raw[3:7]}-{raw[7:]}"


@router.get("/", response_model=list[ClassroomResponse])
def get_classrooms(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    Retrieve active virtual classrooms filtered by user permissions.
    Formateurs & Admins see all active classrooms.
    Learners (étudiants, stagiaires, employés) see public classrooms or classrooms targeting their role/group.
    """
    query = session.query(Classroom).filter(Classroom.is_active == True)

    if not is_staff(current_user):
        # Collect user group IDs & name
        user_group_ids = []
        user_group_memberships = (
            session.query(GroupMember)
            .filter(GroupMember.user_id == current_user.id)
            .all()
        )
        if user_group_memberships:
            user_group_ids = [str(m.group_id) for m in user_group_memberships]

        user_group_name = (current_user.group_name or "").strip()
        user_email = (current_user.email or "").strip().lower()

        # Fetch all active classrooms and filter in Python for complex string list matching
        all_active = query.order_by(Classroom.created_at.desc()).all()
        accessible = []
        for room in all_active:
            # 1. Instructor of the room
            if room.instructor_id == current_user.id:
                accessible.append(room)
                continue

            # 2. Public rooms
            if not room.is_private:
                accessible.append(room)
                continue

            # 2b. User has an invitation (pending or accepted)
            user_has_invitation = session.query(ClassroomInvitation).filter(
                ClassroomInvitation.classroom_id == room.id,
                ClassroomInvitation.invitee_id == current_user.id,
                ClassroomInvitation.status.in_(["pending", "accepted"])
            ).first()
            if user_has_invitation:
                accessible.append(room)
                continue

            # 3. Target roles match
            if room.target_roles and matches_target_role(current_user.role, room.target_roles):
                accessible.append(room)
                continue

            # 4. Target groups match
            if room.target_groups:
                groups_target = [g.strip() for g in room.target_groups.split(",") if g.strip()]
                if user_group_name and user_group_name in groups_target:
                    accessible.append(room)
                    continue
                if any(gid in groups_target for gid in user_group_ids):
                    accessible.append(room)
                    continue

            # 5. Allowed users match
            if room.allowed_users:
                allowed = [a.strip().lower() for a in room.allowed_users.split(",") if a.strip()]
                if user_email in allowed or str(current_user.id) in allowed:
                    accessible.append(room)
                    continue

            # 6. Fallback: if no target roles/groups/allowed_users were explicitly defined, permit learners
            if not room.target_roles and not room.target_groups and not room.allowed_users:
                accessible.append(room)
                continue

        return accessible[skip : skip + limit]

    classrooms = query.order_by(Classroom.created_at.desc()).offset(skip).limit(limit).all()
    return classrooms



@router.post("/", response_model=ClassroomResponse)
def create_classroom(
    *,
    session: SessionDep,
    classroom_in: ClassroomCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new virtual classroom. Restricted to formateurs, pedagogique, and admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs et administrateurs peuvent créer une salle vidéo conférence.",
    )

    room_code = (
        classroom_in.room_id.strip().lower()
        if classroom_in.room_id
        else generate_room_code()
    )

    # Check for uniqueness
    existing = session.query(Classroom).filter(Classroom.room_id == room_code).first()
    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=400, detail="Ce code de salle vidéo conférence est déjà utilisé."
            )
        else:
            # Reactivate
            existing.title = classroom_in.title
            existing.description = classroom_in.description
            existing.target_roles = classroom_in.target_roles
            existing.target_groups = classroom_in.target_groups
            existing.is_private = classroom_in.is_private
            existing.auto_invitations = classroom_in.auto_invitations
            existing.allow_screen_sharing = classroom_in.allow_screen_sharing
            existing.requires_approval = classroom_in.requires_approval
            existing.allowed_users = classroom_in.allowed_users
            existing.instructor_id = current_user.id
            existing.is_active = True
            session.commit()
            session.refresh(existing)
            classroom = existing
    else:
        classroom = Classroom(
            room_id=room_code,
            title=classroom_in.title,
            description=classroom_in.description,
            target_roles=classroom_in.target_roles,
            target_groups=classroom_in.target_groups,
            is_private=classroom_in.is_private,
            auto_invitations=classroom_in.auto_invitations,
            allow_screen_sharing=classroom_in.allow_screen_sharing,
            requires_approval=classroom_in.requires_approval,
            allowed_users=classroom_in.allowed_users,
            instructor_id=current_user.id,
            is_active=True,
        )
        session.add(classroom)
        session.commit()
        session.refresh(classroom)

    # Collect targeted users ONLY IF auto_invitations is enabled
    if classroom_in.auto_invitations:
        targeted_user_ids = set()
        group_labels_list = []

        # 1. Target by selected Groups (Priority)
        if classroom_in.target_groups:
            group_ids = [
                int(g.strip())
                for g in classroom_in.target_groups.split(",")
                if g.strip().isdigit()
            ]
            if group_ids:
                selected_groups = session.query(Group).filter(Group.id.in_(group_ids)).all()
                group_labels_list = [g.name for g in selected_groups]

                # Collect user IDs from GroupMember
                members = session.query(GroupMember).filter(GroupMember.group_id.in_(group_ids)).all()
                for m in members:
                    targeted_user_ids.add(m.user_id)

                # Also collect users associated via User.group_name
                if group_labels_list:
                    named_users = (
                        session.query(User)
                        .filter(User.group_name.in_(group_labels_list))
                        .all()
                    )
                    for u in named_users:
                        targeted_user_ids.add(u.id)

        # 2. Target by Roles (Fallback if specified)
        if classroom_in.target_roles:
            roles_list = [r.strip().lower() for r in classroom_in.target_roles.split(",") if r.strip()]
            if roles_list:
                role_users = session.query(User).filter(User.role.in_(roles_list)).all()
                for u in role_users:
                    targeted_user_ids.add(u.id)

        # Exclude instructor from attendance & invitation
        targeted_user_ids.discard(current_user.id)

        if targeted_user_ids:
            targeted_users = session.query(User).filter(User.id.in_(targeted_user_ids)).all()
            group_info = f"👥 **Groupe(s) invité(s) :** {', '.join(group_labels_list)}\n" if group_labels_list else ""

            for t_user in targeted_users:
                # 1. Register ClassroomInvitation in DB so it persists
                existing_inv = session.query(ClassroomInvitation).filter(
                    ClassroomInvitation.classroom_id == classroom.id,
                    ClassroomInvitation.invitee_id == t_user.id,
                    ClassroomInvitation.status == "pending"
                ).first()
                if not existing_inv:
                    inv = ClassroomInvitation(
                        classroom_id=classroom.id,
                        inviter_id=current_user.id,
                        invitee_id=t_user.id,
                        status="pending",
                    )
                    session.add(inv)

                # 2. Register in Attendance as absent
                att = Attendance(
                    user_id=t_user.id,
                    date=date.today(),
                    status="absent",
                    session_name=classroom.title,
                    remarks=f"Invitation Salle vidéo conférence : {classroom.title}"
                )
                session.add(att)

                # 3. Send in-app invitation Message
                invitation_body = (
                    f"Bonjour {t_user.email.split('@')[0]},\n\n"
                    f"Vous êtes convié(e) à la Salle vidéo conférence en direct : **{classroom.title}**.\n\n"
                    f"📌 **Code de la salle :** `{classroom.room_id}`\n"
                    f"{group_info}"
                    f"👨‍🏫 **Formateur :** {current_user.email}\n\n"
                    f"👉 Connectez-vous dès maintenant depuis la page des **Salles vidéo conférence** pour rejoindre la session en direct."
                )
                msg = Message(
                    sender_id=current_user.id,
                    recipient_id=t_user.id,
                    subject=f"🎓 Invitation Salle vidéo conférence : {classroom.title}",
                    body=invitation_body,
                )
                session.add(msg)

                # 4. Dispatch transactional email
                try:
                    if t_user.email and "@" in t_user.email:
                        target_name = f"{t_user.prenom or ''} {t_user.nom or ''}".strip() or t_user.username or t_user.email.split("@")[0]
                        inviter_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.email
                        send_classroom_invitation_email(
                            to_email=t_user.email,
                            user_name=target_name,
                            room_title=classroom.title,
                            room_id=classroom.room_id,
                            inviter_name=inviter_name,
                        )
                except Exception as mail_err:
                    print(f"[WARN] Email d'invitation salle non envoyé à {t_user.email}: {mail_err}")

            session.commit()
            print(f"[Audit Invitation] {len(targeted_users)} invitation(s) auto envoyée(s) pour la Salle vidéo conférence '{classroom.title}'.")

    return classroom



@router.get("/{room_id}", response_model=ClassroomResponse)
def get_classroom_by_code(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get virtual classroom by its room_id code.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    return classroom


@router.post("/{room_id}/join")
def join_classroom(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Record user joining the classroom for attendance tracking.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    # We only track attendance for non-instructors
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        # Find today's attendance record for this session
        att = session.query(Attendance).filter(
            Attendance.user_id == current_user.id,
            Attendance.date == date.today(),
            Attendance.session_name == classroom.title
        ).first()

        if att:
            # Check for lateness (30 minutes)
            time_diff = (datetime.utcnow() - classroom.created_at).total_seconds() / 60.0
            if time_diff >= 30:
                att.status = "late"
                att.minutes_late = int(time_diff)
            else:
                att.status = "present"
                att.minutes_late = 0
            session.commit()

    return {"message": "Rejoint avec succès", "room_id": classroom.room_id}


@router.post("/{room_id}/stop")
@router.post("/{room_id}/end")
def stop_classroom(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Stop/End a virtual classroom session.
    Strictly forbidden for learners, interns, and employees (etudiant, stagiaire, employer).
    Only authorized for formateurs, pedagogique, and admins.
    """
    require_staff(
        current_user,
        "Accès interdit : les étudiants, stagiaires et employés ne sont pas autorisés à arrêter la salle vidéo conférence.",
    )

    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    classroom.is_active = False
    session.commit()

    # Clear subgroups if active
    if cleaned_id in ROOM_SUBGROUPS:
        ROOM_SUBGROUPS[cleaned_id] = {"is_active": False, "timer_minutes": 15, "subgroups": []}

    return {
        "message": "La salle vidéo conférence a été arrêtée avec succès.",
        "room_id": cleaned_id,
        "is_active": False,
    }


@router.delete("/{room_id}")
def delete_classroom(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Close or delete a virtual classroom. Restricted to staff (formateur, admin) only.
    Strictly forbidden for learners, interns, and employees.
    """
    require_staff(
        current_user,
        "Accès interdit : les étudiants, stagiaires et employés ne sont pas autorisés à supprimer la salle vidéo conférence.",
    )

    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    classroom.is_active = False
    session.commit()
    return {"message": "Salle vidéo conférence clôturée avec succès.", "room_id": cleaned_id}


@router.delete("/history/purge")
def purge_classroom_history(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Permanently delete all closed (inactive) virtual classrooms from history. Admin only.
    """
    require_admin(
        current_user,
        "Seul un administrateur peut supprimer l'historique.",
    )

    deleted_count = (
        session.query(Classroom).filter(Classroom.is_active == False).delete()
    )
    session.commit()

    return {
        "message": f"Historique purgé. {deleted_count} anciennes sessions supprimées."
    }


# =========================================================================
# BREAKOUT ROOMS (SOUS-GROUPES) & CLASSROOM CHAT STORE
# =========================================================================
ROOM_SUBGROUPS: dict = {}
ROOM_MESSAGES: dict = {}


@router.get("/{room_id}/subgroups")
def get_room_subgroups(room_id: str, current_user: CurrentUser):
    """
    Get active breakout rooms / sub-groups for this classroom.
    """
    cleaned_id = room_id.strip().lower()
    return ROOM_SUBGROUPS.get(
        cleaned_id, {"is_active": False, "timer_minutes": 15, "subgroups": []}
    )


@router.post("/{room_id}/subgroups")
def create_or_update_subgroups(room_id: str, payload: dict, current_user: CurrentUser):
    """
    Create and launch breakout rooms. Strictly Formateurs and Admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs et administrateurs peuvent créer et lancer des sous-groupes.",
    )

    cleaned_id = room_id.strip().lower()
    ROOM_SUBGROUPS[cleaned_id] = {
        "is_active": True,
        "timer_minutes": payload.get("timer_minutes", 15),
        "subgroups": payload.get("subgroups", []),
        "launched_by": current_user.email,
    }
    return ROOM_SUBGROUPS[cleaned_id]


@router.delete("/{room_id}/subgroups")
def close_room_subgroups(room_id: str, current_user: CurrentUser):
    """
    Close all breakout rooms and recall all participants to main room. Strictly Formateurs and Admins.
    """
    require_staff(
        current_user,
        "Seuls les formateurs et administrateurs peuvent clôturer les sous-groupes.",
    )

    cleaned_id = room_id.strip().lower()
    ROOM_SUBGROUPS[cleaned_id] = {
        "is_active": False,
        "timer_minutes": 15,
        "subgroups": [],
    }
    return {"message": "Sous-groupes clôturés, retour à la salle principale."}


@router.get("/{room_id}/messages")
def get_room_messages(room_id: str, current_user: CurrentUser):
    """
    Get room chat messages (group, private, and sub-group).
    """
    cleaned_id = room_id.strip().lower()
    all_msgs = ROOM_MESSAGES.get(cleaned_id, [])
    # Return messages visible to current_user:
    # 1. recipient == 'everyone'
    # 2. recipient == current_user.email or sender == current_user.email
    # 3. or recipient is subgroup the user belongs to
    visible = []
    user_email = current_user.email.lower()
    for m in all_msgs:
        rec = m.get("recipient", "everyone").lower()
        snd = m.get("sender", "").lower()
        if (
            rec == "everyone"
            or rec == user_email
            or snd == user_email
            or is_admin(current_user)
            or rec.startswith("subgroup:")
        ):
            visible.append(m)
    return visible


@router.post("/{room_id}/messages")
def post_room_message(room_id: str, message: dict, current_user: CurrentUser):
    """
    Send a message to group or private recipient in the virtual classroom.
    Sanitized against Stored XSS and bounded against memory exhaustion / DoS.
    """
    rate_limiter.check_rate_limit(
        identifier=f"classroom_msg_{current_user.id}",
        max_requests=30,
        window_seconds=60,
        action_name="envoi de messages de classe",
    )

    cleaned_id = room_id.strip().lower()
    if cleaned_id not in ROOM_MESSAGES:
        ROOM_MESSAGES[cleaned_id] = []

    raw_text = str(message.get("text", "") or "")
    clean_text = sanitize_text(raw_text, max_length=5000, strip_html=True)

    attachment = message.get("attachment")
    clean_attachment = None
    if isinstance(attachment, dict):
        raw_url = attachment.get("url")
        safe_url = sanitize_attachment_url(raw_url) if raw_url else None
        if safe_url:
            clean_attachment = {
                "url": safe_url,
                "filename": sanitize_text(attachment.get("filename", "piece_jointe"), max_length=100),
                "type": sanitize_text(attachment.get("type", "document"), max_length=50),
            }

    msg_record = {
        "id": str(uuid.uuid4()),
        "sender": current_user.email,
        "sender_role": current_user.role,
        "text": clean_text,
        "time": datetime.now().strftime("%H:%M"),
        "recipient": sanitize_text(message.get("recipient", "everyone"), max_length=100),
        "subgroup_id": sanitize_text(message.get("subgroup_id"), max_length=100) if message.get("subgroup_id") else None,
        "attachment": clean_attachment,
    }

    ROOM_MESSAGES[cleaned_id].append(msg_record)
    # Protection DoS mémoire : conserver au maximum les 120 derniers messages
    if len(ROOM_MESSAGES[cleaned_id]) > 120:
        ROOM_MESSAGES[cleaned_id] = ROOM_MESSAGES[cleaned_id][-120:]

    return msg_record


# =========================================================================
# LOBBY / WAITING ROOM & JOIN REQUEST APPROVAL STORE
# =========================================================================
ROOM_JOIN_REQUESTS: dict = {}  # room_id -> list of request dicts


@router.get("/{room_id}/join-requests")
def get_join_requests(room_id: str, session: SessionDep, current_user: CurrentUser):
    """
    Get all join requests for a virtual classroom (Host / Admin only).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul le formateur peut consulter les demandes d'accès.")
    
    return ROOM_JOIN_REQUESTS.get(cleaned_id, [])


@router.post("/{room_id}/join-request")
def submit_join_request(room_id: str, session: SessionDep, current_user: CurrentUser):
    """
    Submit a request to join a private room requiring approval.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    # Instructor and admins are automatically approved
    if current_user.id == classroom.instructor_id or is_staff(current_user):
        return {"status": "approved", "message": "Accès formateur direct."}

    # Check if user is in allowed_users list
    allowed_list = [u.strip().lower() for u in (classroom.allowed_users or "").split(",") if u.strip()]
    if str(current_user.id) in allowed_list or current_user.email.lower() in allowed_list:
        return {"status": "approved", "message": "Participant déjà autorisé."}

    # Check if approval is required
    if not classroom.requires_approval:
        return {"status": "approved", "message": "Approbation non requise."}

    if cleaned_id not in ROOM_JOIN_REQUESTS:
        ROOM_JOIN_REQUESTS[cleaned_id] = []

    # Check existing request
    existing = next((r for r in ROOM_JOIN_REQUESTS[cleaned_id] if r["user_id"] == current_user.id), None)
    if existing:
        return {"status": existing["status"], "message": "Demande déjà soumise."}

    new_req = {
        "user_id": current_user.id,
        "user_email": current_user.email,
        "user_name": current_user.email.split("@")[0],
        "user_role": current_user.role,
        "requested_at": datetime.utcnow().strftime("%H:%M:%S"),
        "status": "pending",
    }
    ROOM_JOIN_REQUESTS[cleaned_id].append(new_req)
    return {"status": "pending", "message": "Demande d'accès envoyée à l'hôte."}


@router.post("/{room_id}/join-requests/{user_id}/approve")
def approve_join_request(room_id: str, user_id: int, session: SessionDep, current_user: CurrentUser):
    """
    Approve a user's join request (Host / Admin).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul le formateur peut approuver les demandes.")

    reqs = ROOM_JOIN_REQUESTS.get(cleaned_id, [])
    req = next((r for r in reqs if r["user_id"] == user_id), None)
    if req:
        req["status"] = "approved"

    # Record user ID in classroom.allowed_users
    current_allowed = [u.strip() for u in (classroom.allowed_users or "").split(",") if u.strip()]
    if str(user_id) not in current_allowed:
        current_allowed.append(str(user_id))
        classroom.allowed_users = ",".join(current_allowed)
        session.commit()

    return {"message": "Participant approuvé avec succès.", "user_id": user_id}


@router.post("/{room_id}/join-requests/approve-all")
def approve_all_join_requests(room_id: str, session: SessionDep, current_user: CurrentUser):
    """
    Approve all pending join requests for a virtual classroom (Host / Admin).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul le formateur peut approuver les demandes.")

    reqs = ROOM_JOIN_REQUESTS.get(cleaned_id, [])
    approved_ids = []
    current_allowed = [u.strip() for u in (classroom.allowed_users or "").split(",") if u.strip()]

    for req in reqs:
        if req.get("status") == "pending":
            req["status"] = "approved"
            uid = str(req.get("user_id"))
            if uid and uid not in current_allowed:
                current_allowed.append(uid)
            approved_ids.append(req.get("user_id"))

    classroom.allowed_users = ",".join(current_allowed)
    session.commit()

    return {"message": f"{len(approved_ids)} participants approuvés.", "approved_user_ids": approved_ids}


@router.post("/{room_id}/join-requests/{user_id}/reject")
def reject_join_request(room_id: str, user_id: int, session: SessionDep, current_user: CurrentUser):
    """
    Reject a user's join request (Host / Admin).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul le formateur peut rejeter les demandes.")

    reqs = ROOM_JOIN_REQUESTS.get(cleaned_id, [])
    req = next((r for r in reqs if r["user_id"] == user_id), None)
    if req:
        req["status"] = "rejected"

    return {"message": "Participant rejeté.", "user_id": user_id}


@router.get("/{room_id}/join-status")
def get_join_status(room_id: str, session: SessionDep, current_user: CurrentUser):
    """
    Check current user's join request status.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    if current_user.id == classroom.instructor_id or is_staff(current_user):
        return {"status": "approved"}

    # Check if user has an invitation (pending or accepted)
    has_inv = session.query(ClassroomInvitation).filter(
        ClassroomInvitation.classroom_id == classroom.id,
        ClassroomInvitation.invitee_id == current_user.id,
        ClassroomInvitation.status.in_(["pending", "accepted"])
    ).first()
    if has_inv:
        return {"status": "approved"}

    allowed_list = [u.strip().lower() for u in (classroom.allowed_users or "").split(",") if u.strip()]
    if str(current_user.id) in allowed_list or (current_user.email and current_user.email.lower() in allowed_list):
        return {"status": "approved"}

    if not classroom.requires_approval:
        return {"status": "approved"}

    reqs = ROOM_JOIN_REQUESTS.get(cleaned_id, [])
    req = next((r for r in reqs if r["user_id"] == current_user.id), None)
    if not req:
        return {"status": "not_requested"}
    return {"status": req["status"]}


@router.patch("/{room_id}/settings")
def update_room_settings(room_id: str, payload: dict, session: SessionDep, current_user: CurrentUser):
    """
    Update live room settings (allow_screen_sharing, requires_approval, is_private). Host only.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Non autorisé à modifier les paramètres.")

    if "allow_screen_sharing" in payload:
        classroom.allow_screen_sharing = bool(payload["allow_screen_sharing"])
    if "requires_approval" in payload:
        classroom.requires_approval = bool(payload["requires_approval"])
    if "is_private" in payload:
        classroom.is_private = bool(payload["is_private"])

    session.commit()
    session.refresh(classroom)
    return classroom


@router.get("/invitations/my-invitations", response_model=list[ClassroomInvitationResponse])
def get_my_invitations(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get all pending virtual classroom invitations for the current user for active classrooms.
    """
    invitations = (
        session.query(ClassroomInvitation)
        .join(Classroom, ClassroomInvitation.classroom_id == Classroom.id)
        .filter(
            ClassroomInvitation.invitee_id == current_user.id,
            ClassroomInvitation.status == "pending",
            Classroom.is_active == True
        )
        .order_by(ClassroomInvitation.created_at.desc())
        .all()
    )
    return invitations


@router.post("/{room_id}/invite")
def invite_users_to_classroom(
    room_id: str,
    payload: ClassroomInviteCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Send invitations to users or groups for a virtual classroom. Restricted to Formateurs & Admins.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs, administrateurs ou l'hôte de la salle peuvent envoyer des invitations.",
        )

    # Ensure room is active when invitations are being sent
    classroom.is_active = True

    targeted_user_ids = set()

    if payload.user_ids:
        for uid in payload.user_ids:
            targeted_user_ids.add(uid)

    if payload.group_ids:
        group_members = session.query(GroupMember).filter(GroupMember.group_id.in_(payload.group_ids)).all()
        for gm in group_members:
            targeted_user_ids.add(gm.user_id)

        # Also resolve learners matching Group.name in User.group_name
        selected_groups = session.query(Group).filter(Group.id.in_(payload.group_ids)).all()
        for grp in selected_groups:
            if grp.name:
                users_by_group_name = session.query(User).filter(func.lower(User.group_name) == grp.name.strip().lower()).all()
                for ug in users_by_group_name:
                    targeted_user_ids.add(ug.id)

    targeted_user_ids.discard(current_user.id)

    if not targeted_user_ids:
        return {"message": "Aucun participant à inviter sélectionné.", "invited_count": 0}

    invited_users = session.query(User).filter(User.id.in_(targeted_user_ids)).all()
    count = 0

    # Ensure targeted users are pre-authorized in allowed_users so they can access the room without hindrance
    allowed = [a.strip().lower() for a in (classroom.allowed_users or "").split(",") if a.strip()]
    for target_user in invited_users:
        u_email = (target_user.email or "").strip().lower()
        u_id = str(target_user.id)
        if u_email and u_email not in allowed:
            allowed.append(u_email)
        if u_id not in allowed:
            allowed.append(u_id)
    classroom.allowed_users = ",".join(allowed)

    for target_user in invited_users:
        # Check if invitation exists (pending or otherwise)
        existing_inv = session.query(ClassroomInvitation).filter(
            ClassroomInvitation.classroom_id == classroom.id,
            ClassroomInvitation.invitee_id == target_user.id,
        ).first()

        if not existing_inv:
            inv = ClassroomInvitation(
                classroom_id=classroom.id,
                inviter_id=current_user.id,
                invitee_id=target_user.id,
                status="pending"
            )
            session.add(inv)
        else:
            existing_inv.status = "pending"
            existing_inv.inviter_id = current_user.id
            existing_inv.created_at = datetime.utcnow()

        # Ensure attendance record if pre_enroll_attendance is enabled
        if getattr(payload, "pre_enroll_attendance", True):
            att = session.query(Attendance).filter(
                Attendance.user_id == target_user.id,
                Attendance.date == date.today(),
                Attendance.session_name == classroom.title
            ).first()
            if not att:
                session.add(Attendance(
                    user_id=target_user.id,
                    date=date.today(),
                    status="absent",
                    session_name=classroom.title,
                    remarks=f"Invitation Salle vidéo conférence : {classroom.title}"
                ))

        # Send invitation Message if send_notification is enabled
        if getattr(payload, "send_notification", True):
            invitation_body = (
                f"Bonjour {target_user.prenom or target_user.email.split('@')[0]},\n\n"
                f"Vous êtes invité(e) par **{current_user.prenom or ''} {current_user.nom or current_user.email}** à rejoindre la Salle vidéo conférence en direct : **{classroom.title}**.\n\n"
                f"📌 **Code de la salle :** `{classroom.room_id}`\n\n"
                f"👉 Cliquez sur le bouton **Accepter l'invitation** sur la page des Salles vidéo conférence ou sur la notification pour intégrer la session immédiatement."
            )
            msg = Message(
                sender_id=current_user.id,
                recipient_id=target_user.id,
                subject=f"🎓 Invitation Salle vidéo conférence : {classroom.title}",
                body=invitation_body,
            )
            session.add(msg)
        count += 1

        # Dispatch transactional invitation email if send_email is enabled
        if getattr(payload, "send_email", True):
            try:
                if target_user.email and "@" in target_user.email:
                    target_name = f"{target_user.prenom or ''} {target_user.nom or ''}".strip() or target_user.username or target_user.email.split("@")[0]
                    inviter_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.email
                    send_classroom_invitation_email(
                        to_email=target_user.email,
                        user_name=target_name,
                        room_title=classroom.title,
                        room_id=classroom.room_id,
                        inviter_name=inviter_name,
                    )
            except Exception as mail_err:
                print(f"[WARN] Email d'invitation salle non envoyé à {target_user.email}: {mail_err}")

    session.commit()
    print(f"[Audit Invitation] {count} invitation(s) envoyée(s) pour la Salle vidéo conférence '{classroom.title}' ({classroom.room_id}) par {current_user.email}.")
    return {"message": f"{count} invitation(s) envoyée(s) avec succès.", "invited_count": count}


@router.get("/{room_id}/invitations", response_model=list[ClassroomInvitationResponse])
def get_classroom_invitations(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all invitations sent for a specific classroom (Host & Staff).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(
            status_code=403,
            detail="Seul l'hôte ou les administrateurs peuvent consulter la liste des invitations.",
        )

    invitations = (
        session.query(ClassroomInvitation)
        .filter(ClassroomInvitation.classroom_id == classroom.id)
        .order_by(ClassroomInvitation.created_at.desc())
        .all()
    )
    return invitations


@router.delete("/{room_id}/invitations/{invitation_id}")
def cancel_classroom_invitation(
    room_id: str,
    invitation_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Cancel/delete an invitation (Host & Staff only).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul l'hôte peut annuler une invitation.")

    inv = session.query(ClassroomInvitation).filter(
        ClassroomInvitation.id == invitation_id,
        ClassroomInvitation.classroom_id == classroom.id,
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    session.delete(inv)
    session.commit()
    return {"message": "Invitation annulée avec succès.", "invitation_id": invitation_id}


@router.post("/{room_id}/invitations/{invitation_id}/resend")
def resend_classroom_invitation(
    room_id: str,
    invitation_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Resend an invitation notification and email.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")

    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul l'hôte peut relancer une invitation.")

    inv = session.query(ClassroomInvitation).filter(
        ClassroomInvitation.id == invitation_id,
        ClassroomInvitation.classroom_id == classroom.id,
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    target_user = inv.invitee
    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur invité introuvable.")

    # Re-dispatch Message notification
    invitation_body = (
        f"Rappel : Bonjour {target_user.email.split('@')[0]},\n\n"
        f"Vous êtes invité(e) par **{current_user.email}** à rejoindre la Salle vidéo conférence : **{classroom.title}**.\n\n"
        f"📌 **Code de la salle :** `{classroom.room_id}`"
    )
    msg = Message(
        sender_id=current_user.id,
        recipient_id=target_user.id,
        subject=f"🎓 Rappel Invitation : {classroom.title}",
        body=invitation_body,
    )
    session.add(msg)

    # Re-dispatch email if available
    try:
        if target_user.email and "@" in target_user.email:
            target_name = f"{target_user.prenom or ''} {target_user.nom or ''}".strip() or target_user.username or target_user.email.split("@")[0]
            inviter_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.email
            send_classroom_invitation_email(
                to_email=target_user.email,
                user_name=target_name,
                room_title=classroom.title,
                room_id=classroom.room_id,
                inviter_name=inviter_name,
            )
    except Exception as e:
        print(f"[WARN] Resend email failed: {e}")

    session.commit()
    return {"message": f"Invitation relancée pour {target_user.email}."}


@router.post("/invitations/{invitation_id}/accept")
def accept_classroom_invitation(
    invitation_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Accept a virtual classroom invitation.
    """
    inv = session.query(ClassroomInvitation).filter(
        ClassroomInvitation.id == invitation_id,
        ClassroomInvitation.invitee_id == current_user.id
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    inv.status = "accepted"

    # Automatically add to allowed_users if room is private
    classroom = inv.classroom
    if classroom:
        allowed = [a.strip() for a in (classroom.allowed_users or "").split(",") if a.strip()]
        if str(current_user.id) not in allowed and current_user.email not in allowed:
            allowed.append(current_user.email)
            classroom.allowed_users = ",".join(allowed)

        # Mark attendance
        att = session.query(Attendance).filter(
            Attendance.user_id == current_user.id,
            Attendance.date == date.today(),
            Attendance.session_name == classroom.title
        ).first()
        if att:
            att.status = "present"
            att.remarks = f"Invitation acceptée le {datetime.now().strftime('%H:%M')}"

    session.commit()
    return {
        "message": "Invitation acceptée avec succès !",
        "status": "accepted",
        "room_id": classroom.room_id if classroom else None
    }


@router.post("/invitations/{invitation_id}/decline")
def decline_classroom_invitation(
    invitation_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Decline a virtual classroom invitation.
    """
    inv = session.query(ClassroomInvitation).filter(
        ClassroomInvitation.id == invitation_id,
        ClassroomInvitation.invitee_id == current_user.id
    ).first()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitation introuvable.")

    inv.status = "declined"
    session.commit()
    return {"message": "Invitation déclinée.", "status": "declined"}


# =========================================================================
# WEBRTC PROTOCOL & REAL-TIME SIGNALING STORE (TCP/IP & UDP TRANSPORT)
# =========================================================================
ROOM_WEBRTC_PEERS: dict[str, dict[str, dict]] = {}     # room_id -> { email: { info, last_seen, mic, cam, speaking, protocol } }
ROOM_WEBRTC_SIGNALS: dict[str, dict[str, list[dict]]] = {}  # room_id -> { recipient_email: [ signals ] }


@router.get("/{room_id}/webrtc/config")
def get_webrtc_config(room_id: str, current_user: CurrentUser):
    """
    Get WebRTC ICE server configuration with primary UDP and TCP fallback relays.
    Provides STUN and TURN server topology for reliable NAT traversal and low-latency audio/video.
    """
    return {
        "iceServers": [
            {
                "urls": [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ]
            },
            {
                "urls": [
                    "stun:global.stun.twilio.com:3478",
                    "stun:stun.services.mozilla.com:3478",
                    "stun:stun.voipbuster.com:3478",
                ]
            }
        ],
        "iceCandidatePoolSize": 10,
        "iceTransportPolicy": "all",
        "bundlePolicy": "max-bundle",
        "rtcpMuxPolicy": "require",
        "sdpSemantics": "unified-plan",
        "protocols": {
            "primary": "UDP (SRTP/SCTP ultra-low latency real-time voice & video)",
            "fallback": "TCP/TLS (Port 443/80 STUN/TURN Relay)",
            "voice_codec": "Opus (48kHz full-band high fidelity, echo cancellation, AGC)",
            "video_codec": "VP8 / VP9 / H.264 / AV1 (Adaptive HD bitrate)",
        }
    }


@router.post("/{room_id}/webrtc/ping")
def webrtc_peer_ping(
    room_id: str,
    payload: dict,
    current_user: CurrentUser,
):
    """
    Heartbeat, discovery and status reporting for audio/video peers.
    Reports mic state, webcam state, speaking status, and active network protocol (UDP/TCP).
    """
    cleaned_id = room_id.strip().lower()
    if cleaned_id not in ROOM_WEBRTC_PEERS:
        ROOM_WEBRTC_PEERS[cleaned_id] = {}

    user_email = current_user.email.lower()
    user_name = f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.username or user_email.split("@")[0]

    ROOM_WEBRTC_PEERS[cleaned_id][user_email] = {
        "user_id": current_user.id,
        "email": current_user.email,
        "name": user_name,
        "role": current_user.role,
        "is_mic_muted": bool(payload.get("is_mic_muted", False)),
        "is_camera_off": bool(payload.get("is_camera_off", False)),
        "is_screen_sharing": bool(payload.get("is_screen_sharing", False)),
        "is_speaking": bool(payload.get("is_speaking", False)),
        "transport_protocol": str(payload.get("transport_protocol", "UDP")),
        "audio_level": float(payload.get("audio_level", 0.0)),
        "last_seen": datetime.now().timestamp(),
    }

    # Clean inactive peers (> 12 seconds without ping)
    now = datetime.now().timestamp()
    active_peers = []
    for email, peer in list(ROOM_WEBRTC_PEERS[cleaned_id].items()):
        if now - peer["last_seen"] <= 12:
            active_peers.append(peer)
        else:
            del ROOM_WEBRTC_PEERS[cleaned_id][email]

    return {
        "room_id": cleaned_id,
        "active_peers": active_peers,
        "total_peers": len(active_peers),
    }


@router.post("/{room_id}/webrtc/signal")
def send_webrtc_signal(
    room_id: str,
    signal_data: dict,
    current_user: CurrentUser,
):
    """
    Exchange WebRTC SDP Offer, SDP Answer, or ICE Candidates (UDP/TCP).
    Bounded against memory leaks / DoS.
    """
    rate_limiter.check_rate_limit(
        identifier=f"webrtc_sig_{current_user.id}",
        max_requests=150,
        window_seconds=60,
        action_name="signaux WebRTC",
    )

    cleaned_id = room_id.strip().lower()
    if cleaned_id not in ROOM_WEBRTC_SIGNALS:
        ROOM_WEBRTC_SIGNALS[cleaned_id] = {}

    sender_email = current_user.email.lower()
    recipient = (signal_data.get("recipient_email") or "broadcast").strip().lower()
    now_ts = datetime.now().timestamp()

    envelope = {
        "id": str(uuid.uuid4()),
        "sender": current_user.email,
        "recipient": recipient,
        "type": sanitize_text(signal_data.get("type"), max_length=50),
        "payload": signal_data.get("payload"),
        "protocol": sanitize_text(signal_data.get("protocol", "UDP"), max_length=20),
        "created_at": now_ts,
    }

    def push_signal(target_mail: str):
        if target_mail not in ROOM_WEBRTC_SIGNALS[cleaned_id]:
            ROOM_WEBRTC_SIGNALS[cleaned_id][target_mail] = []
        # Nettoyage des signaux périmés (> 30s)
        ROOM_WEBRTC_SIGNALS[cleaned_id][target_mail] = [
            s for s in ROOM_WEBRTC_SIGNALS[cleaned_id][target_mail]
            if now_ts - s.get("created_at", now_ts) < 30
        ]
        # Borne maximale pour éviter toute explosion mémoire
        if len(ROOM_WEBRTC_SIGNALS[cleaned_id][target_mail]) < 50:
            ROOM_WEBRTC_SIGNALS[cleaned_id][target_mail].append(envelope)

    if recipient == "broadcast" or not recipient:
        peers = ROOM_WEBRTC_PEERS.get(cleaned_id, {})
        for peer_email in peers:
            if peer_email != sender_email:
                push_signal(peer_email)
    else:
        push_signal(recipient)

    return {"status": "dispatched", "signal_id": envelope["id"]}


@router.get("/{room_id}/webrtc/signals")
def get_webrtc_signals(room_id: str, current_user: CurrentUser):
    """
    Retrieve pending WebRTC signals (Offers, Answers, ICE candidates) for the current user.
    """
    cleaned_id = room_id.strip().lower()
    user_email = current_user.email.lower()
    signals = []

    if cleaned_id in ROOM_WEBRTC_SIGNALS and user_email in ROOM_WEBRTC_SIGNALS[cleaned_id]:
        signals = ROOM_WEBRTC_SIGNALS[cleaned_id][user_email]
        ROOM_WEBRTC_SIGNALS[cleaned_id][user_email] = []

    return signals


# =========================================================================
# WEBSOCKET SIGNALING SERVER (SFU / WAITING ROOM / SEGMENTED CHAT)
# =========================================================================

@router.websocket("/{room_id}/ws")
async def classroom_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(None),
):
    """
    Point de terminaison WebSocket pour la signalisation SFU temps réel :
    - Authentification JWT
    - Gestion de la salle d'attente (Knock, Admit, Reject, Block, Kick)
    - Signalisation SFU (Pub/Sub tracks, SDP, ICE Candidates)
    - Chat segmenté (Global, Privé 1-à-1, Breakout rooms)
    """
    await signaling_manager.handle_connection(websocket, room_id, token)


@router.get("/{room_id}/state")
def get_live_classroom_state(
    room_id: str,
    current_user: CurrentUser,
):
    """
    Récupère l'état en direct de la salle géré par le gestionnaire de signalisation.
    """
    state = signaling_manager.get_room_state(room_id)
    if not state:
        return {
            "room_id": room_id.strip().lower(),
            "active_peers_count": 0,
            "waiting_count": 0,
            "blocked_count": 0,
            "active_peers": [],
            "waiting_users": [],
            "blocked_user_ids": []
        }
    return state


@router.post("/{room_id}/block-user/{user_id}")
async def block_classroom_user(
    room_id: str,
    user_id: int,
    session: SessionDep,
    current_user: CurrentUser,
):
    """
    Bannit définitivement un utilisateur de la salle de visioconférence (Hôte / Admin).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul l'hôte peut bloquer un utilisateur.")

    await signaling_manager.block_user_rest(cleaned_id, user_id)
    return {"message": f"Utilisateur #{user_id} bloqué de la session.", "room_id": cleaned_id, "user_id": user_id}


@router.delete("/{room_id}/block-user/{user_id}")
async def unblock_classroom_user(
    room_id: str,
    user_id: int,
    session: SessionDep,
    current_user: CurrentUser,
):
    """
    Débloque un utilisateur pour lui permettre de rejoindre à nouveau la salle.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Salle vidéo conférence introuvable.")
    if current_user.id != classroom.instructor_id and not is_staff(current_user):
        raise HTTPException(status_code=403, detail="Seul l'hôte peut débloquer un utilisateur.")

    await signaling_manager.unblock_user_rest(cleaned_id, user_id)
    return {"message": f"Utilisateur #{user_id} débloqué.", "room_id": cleaned_id, "user_id": user_id}




