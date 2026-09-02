import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models.classroom import Classroom
from app.models.user import User
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
            existing.instructor_id = current_user.id
            existing.is_active = True
            session.commit()
            session.refresh(existing)
            return existing

    classroom = Classroom(
        room_id=room_code,
        title=classroom_in.title,
        description=classroom_in.description,
        target_roles=classroom_in.target_roles,
        instructor_id=current_user.id,
        is_active=True,
    )
    session.add(classroom)
    session.commit()
    session.refresh(classroom)

    # Handle invitations and attendance if target_roles is specified
    if classroom_in.target_roles:
        roles_list = [r.strip().lower() for r in classroom_in.target_roles.split(",") if r.strip()]
        if roles_list:
            # Find users matching these roles
            targeted_users = session.query(User).filter(User.role.in_(roles_list)).all()
            for t_user in targeted_users:
                # 1. Register in Attendance as absent
                att = Attendance(
                    user_id=t_user.id,
                    date=date.today(),
                    status="absent",
                    session_name=classroom.title
                )
                session.add(att)

                # 2. Send invitation Message
                invitation_body = (
                    f"Bonjour,\n\nVous êtes invité(e) à rejoindre la classe virtuelle : **{classroom.title}**.\n\n"
                    f"Code de la salle : `{classroom.room_id}`\n\n"
                    f"Vous pouvez rejoindre cette session depuis la page des classes virtuelles."
                )
                msg = Message(
                    sender_id=current_user.id,
                    recipient_id=t_user.id,
                    subject="Invitation à une classe virtuelle",
                    body=invitation_body
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
