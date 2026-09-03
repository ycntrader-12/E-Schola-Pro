import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models.classroom import Classroom
from app.models.user import User
from app.models.group import Group, GroupMember
from app.models.attendance import Attendance
from app.models.message import Message
from app.schemas.classroom import ClassroomCreate, ClassroomResponse
from datetime import datetime, date

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
    Retrieve all active virtual classrooms.
    """
    classrooms = (
        session.query(Classroom)
        .filter(Classroom.is_active == True)
        .order_by(Classroom.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return classrooms


ADMIN_ROLES = ["admin", "admin_manager", "admin_limited"]


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
    if current_user.role not in ["formateur", "pedagogique"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et administrateurs peuvent créer une classe virtuelle.",
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
                status_code=400, detail="Ce code de classe virtuelle est déjà utilisé."
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
                # 1. Register in Attendance as absent
                att = Attendance(
                    user_id=t_user.id,
                    date=date.today(),
                    status="absent",
                    session_name=classroom.title,
                    remarks=f"Invitation classe virtuelle : {classroom.title}"
                )
                session.add(att)

                # 2. Send invitation Message
                invitation_body = (
                    f"Bonjour {t_user.email.split('@')[0]},\n\n"
                    f"Vous êtes convié(e) à la classe virtuelle en direct : **{classroom.title}**.\n\n"
                    f"📌 **Code de la salle :** `{classroom.room_id}`\n"
                    f"{group_info}"
                    f"👨‍🏫 **Formateur :** {current_user.email}\n\n"
                    f"👉 Connectez-vous dès maintenant depuis la page des **Classes Virtuelles** pour rejoindre la session en direct."
                )
                msg = Message(
                    sender_id=current_user.id,
                    recipient_id=t_user.id,
                    subject=f"🎓 Invitation classe virtuelle : {classroom.title}",
                    body=invitation_body,
                )
                session.add(msg)

            session.commit()

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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")

    # We only track attendance for non-instructors
    if current_user.id != classroom.instructor_id and current_user.role not in ["formateur", "pedagogique"] + ADMIN_ROLES:
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


@router.delete("/{room_id}")
def delete_classroom(
    room_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Close or delete a virtual classroom. Restricted to room instructor and admins.
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")

    if current_user.role not in ADMIN_ROLES and classroom.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Non autorisé à supprimer cette classe virtuelle."
        )

    classroom.is_active = False
    session.commit()
    return {"message": "Classe virtuelle clôturée avec succès.", "room_id": cleaned_id}


@router.delete("/history/purge")
def purge_classroom_history(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Permanently delete all closed (inactive) virtual classrooms from history. Admin only.
    """
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seul un administrateur peut supprimer l'historique.",
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
    if current_user.role not in ["formateur", "pedagogique"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et administrateurs peuvent créer et lancer des sous-groupes.",
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
    if current_user.role not in ["formateur", "pedagogique"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Seuls les formateurs et administrateurs peuvent clôturer les sous-groupes.",
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
            or current_user.role in ADMIN_ROLES
            or rec.startswith("subgroup:")
        ):
            visible.append(m)
    return visible


@router.post("/{room_id}/messages")
def post_room_message(room_id: str, message: dict, current_user: CurrentUser):
    """
    Send a message to group or private recipient in the virtual classroom.
    """
    cleaned_id = room_id.strip().lower()
    if cleaned_id not in ROOM_MESSAGES:
        ROOM_MESSAGES[cleaned_id] = []

    msg_record = {
        "id": str(uuid.uuid4()),
        "sender": current_user.email,
        "sender_role": current_user.role,
        "text": message.get("text", ""),
        "time": message.get("time", "12:00"),
        "recipient": message.get("recipient", "everyone"),
        "subgroup_id": message.get("subgroup_id"),
        "attachment": message.get("attachment"),
    }
    ROOM_MESSAGES[cleaned_id].append(msg_record)
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")
    if current_user.id != classroom.instructor_id and current_user.role not in ADMIN_ROLES:
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")

    # Instructor and admins are automatically approved
    if current_user.id == classroom.instructor_id or current_user.role in ADMIN_ROLES + ["formateur", "pedagogique"]:
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")
    if current_user.id != classroom.instructor_id and current_user.role not in ADMIN_ROLES:
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


@router.post("/{room_id}/join-requests/{user_id}/reject")
def reject_join_request(room_id: str, user_id: int, session: SessionDep, current_user: CurrentUser):
    """
    Reject a user's join request (Host / Admin).
    """
    cleaned_id = room_id.strip().lower()
    classroom = session.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")
    if current_user.id != classroom.instructor_id and current_user.role not in ADMIN_ROLES:
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")

    if current_user.id == classroom.instructor_id or current_user.role in ADMIN_ROLES + ["formateur", "pedagogique"]:
        return {"status": "approved"}

    allowed_list = [u.strip().lower() for u in (classroom.allowed_users or "").split(",") if u.strip()]
    if str(current_user.id) in allowed_list or current_user.email.lower() in allowed_list:
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
        raise HTTPException(status_code=404, detail="Classe virtuelle introuvable.")
    if current_user.id != classroom.instructor_id and current_user.role not in ADMIN_ROLES:
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

