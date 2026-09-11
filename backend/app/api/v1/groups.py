from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_

from app.api.deps import CurrentUser, SessionDep
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberCreate,
    GroupMemberResponse,
    GroupMembersBatchCreate,
    GroupResponse,
    GroupUpdate,
)

router = APIRouter()


ADMIN_ROLES = ["admin", "admin_manager"]
GLOBAL_VIEW_ROLES = ["admin", "admin_manager", "pedagogique", "dg_rh", "dg/rh", "dgrh"]
STAFF_ROLES = ["admin", "admin_manager", "formateur", "pedagogique", "dg_rh", "dg/rh", "dgrh"]
LEARNER_ROLES = ["etudiant", "étudiant", "stagiaire", "employer"]


def is_staff_role(role: str | None) -> bool:
    if not role:
        return False
    r = role.strip().lower()
    return (
        r in STAFF_ROLES 
        or r.replace(" ", "_") in STAFF_ROLES 
        or r.replace("/", "_") in STAFF_ROLES
    )


def is_global_view_role(role: str | None) -> bool:
    if not role:
        return False
    r = role.strip().lower()
    return (
        r in GLOBAL_VIEW_ROLES 
        or r.replace(" ", "_") in GLOBAL_VIEW_ROLES 
        or r.replace("/", "_") in GLOBAL_VIEW_ROLES
    )


@router.get("", response_model=list[GroupResponse])
@router.get("/", response_model=list[GroupResponse])
def read_groups(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
) -> Any:
    """
    Retrieve groups with strict role-based visibility:
    - Global roles (Admin, Admin Manager, Pédagogique, DG/RH): View all groups across the platform.
    - Formateurs: View exclusively groups they created OR groups they are assigned to.
    - Learners (Étudiants, Stagiaires, Employeurs): Strictly forbidden (HTTP 403).
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Accès interdit : les étudiants, stagiaires et employés ne sont pas autorisés à consulter les groupes.",
        )

    query = session.query(Group)

    user_role = (current_user.role or "").strip().lower()

    if is_global_view_role(user_role):
        # 1. Full 360° visibility for global staff roles
        groups = (
            query.order_by(Group.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    elif user_role == "formateur":
        # 2. Strict scoped visibility: only groups created by or assigned to this formateur
        groups = (
            query.filter(
                or_(
                    Group.creator_id == current_user.id,
                    Group.instructor_id == current_user.id,
                )
            )
            .order_by(Group.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    else:
        raise HTTPException(status_code=403, detail="Accès non autorisé pour ce profil.")

    # Attach instructor metadata and members_count for each group
    response = []
    for g in groups:
        count = session.query(GroupMember).filter(GroupMember.group_id == g.id).count()
        inst = session.query(User).filter(User.id == g.instructor_id).first() if g.instructor_id else None
        creator = session.query(User).filter(User.id == g.creator_id).first() if g.creator_id else None

        inst_name = None
        if inst:
            inst_name = f"{inst.prenom or ''} {inst.nom or ''}".strip() or inst.username or inst.email

        creator_name = None
        if creator:
            creator_name = f"{creator.prenom or ''} {creator.nom or ''}".strip() or creator.username or creator.email

        g_dict = {
            "id": g.id,
            "name": g.name,
            "level": g.level,
            "description": g.description,
            "creator_id": g.creator_id,
            "instructor_id": g.instructor_id,
            "instructor_name": inst_name,
            "instructor_email": inst.email if inst else None,
            "creator_name": creator_name,
            "created_at": g.created_at,
            "members_count": count,
        }
        response.append(g_dict)

    return response


@router.post("", response_model=GroupResponse)
@router.post("/", response_model=GroupResponse)
def create_group(
    *,
    session: SessionDep,
    group_in: GroupCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new group:
    - If created by a Formateur: automatically set creator_id = current_user.id and instructor_id = current_user.id.
    - If created by an Admin / Pédagogique: creator_id = current_user.id and instructor_id = group_in.instructor_id.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Accès non autorisé pour la création de groupe.")

    clean_name = group_in.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Le nom du groupe ne peut pas être vide.")

    existing = session.query(Group).filter(func.lower(Group.name) == clean_name.lower()).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Un groupe ou une classe portant le nom '{clean_name}' existe déjà."
        )

    user_role = (current_user.role or "").strip().lower()

    # Determine assigned instructor
    assigned_instructor_id = None
    if user_role == "formateur":
        # Formateur creates their own group -> auto-assigned
        assigned_instructor_id = current_user.id
    elif group_in.instructor_id:
        # Admin / Staff explicitly assigns a formateur
        formateur = session.query(User).filter(User.id == group_in.instructor_id).first()
        if formateur and formateur.role.strip().lower() in ["formateur", "pedagogique", "admin"]:
            assigned_instructor_id = formateur.id
        else:
            assigned_instructor_id = group_in.instructor_id

    group = Group(
        name=clean_name,
        level=group_in.level.strip() if group_in.level and group_in.level.strip() else None,
        description=group_in.description.strip() if group_in.description and group_in.description.strip() else None,
        creator_id=current_user.id,
        instructor_id=assigned_instructor_id,
    )
    session.add(group)
    session.commit()
    session.refresh(group)

    members_count = 0
    if group_in.member_ids:
        unique_uids = set(group_in.member_ids)
        for uid in unique_uids:
            user = session.query(User).filter(User.id == uid).first()
            if user:
                member = GroupMember(group_id=group.id, user_id=uid)
                session.add(member)
                user.group_name = group.name
                members_count += 1
        if members_count > 0:
            session.commit()

    inst = session.query(User).filter(User.id == group.instructor_id).first() if group.instructor_id else None
    inst_name = f"{inst.prenom or ''} {inst.nom or ''}".strip() or inst.username or inst.email if inst else None

    return {
        "id": group.id,
        "name": group.name,
        "level": group.level,
        "description": group.description,
        "creator_id": group.creator_id,
        "instructor_id": group.instructor_id,
        "instructor_name": inst_name,
        "instructor_email": inst.email if inst else None,
        "creator_name": f"{current_user.prenom or ''} {current_user.nom or ''}".strip() or current_user.username or current_user.email,
        "created_at": group.created_at,
        "members_count": members_count,
    }


@router.put("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    *,
    session: SessionDep,
    group_in: GroupUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update a group:
    - Global staff roles (Admin, Admin Manager, Pédagogique): Can update any group.
    - Formateurs: Can only update groups they created OR are assigned to.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    user_role = (current_user.role or "").strip().lower()
    if not is_global_view_role(user_role):
        if group.creator_id != current_user.id and group.instructor_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Accès interdit : vous n'avez pas les droits de modification sur ce groupe.",
            )

    if group_in.name is not None:
        new_name = group_in.name.strip()
        group.name = new_name
        # Update user.group_name for all members of this group
        members = session.query(GroupMember).filter(GroupMember.group_id == group.id).all()
        member_uids = [m.user_id for m in members]
        if member_uids:
            session.query(User).filter(User.id.in_(member_uids)).update({User.group_name: new_name}, synchronize_session=False)

    if group_in.level is not None:
        group.level = group_in.level.strip() if group_in.level else None
    if group_in.description is not None:
        group.description = (
            group_in.description.strip() if group_in.description else None
        )
    if group_in.instructor_id is not None and is_global_view_role(user_role):
        # Only admin / global staff can reassign the instructor
        group.instructor_id = group_in.instructor_id

    session.commit()
    session.refresh(group)

    count = session.query(GroupMember).filter(GroupMember.group_id == group.id).count()
    inst = session.query(User).filter(User.id == group.instructor_id).first() if group.instructor_id else None
    inst_name = f"{inst.prenom or ''} {inst.nom or ''}".strip() or inst.username or inst.email if inst else None

    return {
        "id": group.id,
        "name": group.name,
        "level": group.level,
        "description": group.description,
        "creator_id": group.creator_id,
        "instructor_id": group.instructor_id,
        "instructor_name": inst_name,
        "instructor_email": inst.email if inst else None,
        "creator_name": None,
        "created_at": group.created_at,
        "members_count": count,
    }


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a group:
    - Global staff roles (Admin, Admin Manager, Pédagogique): Can delete any group.
    - Formateurs: Can only delete groups they created.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    user_role = (current_user.role or "").strip().lower()
    if not is_global_view_role(user_role):
        if group.creator_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Accès interdit : seul le formateur créateur ou un administrateur peut supprimer ce groupe.",
            )

    session.delete(group)
    session.commit()
    return {"message": "Groupe supprimé avec succès."}


# --- Members Management ---


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
def get_group_members(
    group_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get members of a group. Formateur and Admin only.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(
            status_code=403,
            detail="Accès interdit : les étudiants, stagiaires et employés ne sont pas autorisés à consulter les membres d'un groupe.",
        )
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    members = session.query(GroupMember).filter(GroupMember.group_id == group_id).all()

    response = []
    for m in members:
        user = session.query(User).filter(User.id == m.user_id).first()
        response.append(
            {
                "id": m.id,
                "group_id": m.group_id,
                "user_id": m.user_id,
                "joined_at": m.joined_at,
                "user_email": user.email if user else "Inconnu",
                "user_role": user.role if user else "Inconnu",
                "user_nom": user.nom if user else None,
                "user_prenom": user.prenom if user else None,
                "user_username": user.username if user else None,
                "user_avatar": user.avatar_url if user else None,
                "user_departement": user.departement if user else None,
            }
        )

    return response


@router.post("/{group_id}/members", response_model=GroupMemberResponse)
def add_group_member(
    group_id: int,
    member_in: GroupMemberCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Add a member to a group. Admin and formateur only.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    user = session.query(User).filter(User.id == member_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    # Check if already in group
    existing = (
        session.query(GroupMember)
        .filter(
            GroupMember.group_id == group_id, GroupMember.user_id == member_in.user_id
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400, detail="Cet utilisateur est déjà dans ce groupe."
        )

    member = GroupMember(group_id=group_id, user_id=member_in.user_id)
    session.add(member)
    user.group_name = group.name
    session.commit()
    session.refresh(member)

    return {
        "id": member.id,
        "group_id": member.group_id,
        "user_id": member.user_id,
        "joined_at": member.joined_at,
        "user_email": user.email,
        "user_role": user.role,
        "user_nom": user.nom,
        "user_prenom": user.prenom,
        "user_username": user.username,
        "user_avatar": user.avatar_url,
        "user_departement": user.departement,
    }


@router.post("/{group_id}/members/batch")
def add_group_members_batch(
    group_id: int,
    batch_in: GroupMembersBatchCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Add multiple members to a group simultaneously.
    Admin, formateur and staff only.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    added_count = 0
    unique_uids = set(batch_in.user_ids)

    for uid in unique_uids:
        user = session.query(User).filter(User.id == uid).first()
        if not user:
            continue

        existing = (
            session.query(GroupMember)
            .filter(
                GroupMember.group_id == group_id, GroupMember.user_id == uid
            )
            .first()
        )
        if existing:
            continue

        member = GroupMember(group_id=group_id, user_id=uid)
        session.add(member)
        user.group_name = group.name
        added_count += 1

    if added_count > 0:
        session.commit()

    total_count = session.query(GroupMember).filter(GroupMember.group_id == group_id).count()

    return {
        "message": f"{added_count} membre(s) ajouté(s) avec succès au groupe '{group.name}'.",
        "added_count": added_count,
        "total_members": total_count,
        "group_id": group_id,
    }


@router.delete("/{group_id}/members/{user_id}")
def remove_group_member(
    group_id: int,
    user_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Remove a member from a group. Admin and formateur only.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    member = (
        session.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )

    if not member:
        raise HTTPException(
            status_code=404, detail="Membre introuvable dans ce groupe."
        )

    # Synchronize user's group_name if it points to this group
    user = session.query(User).filter(User.id == user_id).first()
    group = session.query(Group).filter(Group.id == group_id).first()
    if user and group and user.group_name == group.name:
        other_membership = session.query(GroupMember).filter(
            GroupMember.user_id == user_id,
            GroupMember.group_id != group_id
        ).first()
        if other_membership and other_membership.group:
            user.group_name = other_membership.group.name
        else:
            user.group_name = None

    session.delete(member)
    session.commit()
    return {"message": "Membre retiré du groupe."}


@router.get("/available-users", response_model=list[dict])
@router.get("/available-users/", response_model=list[dict])
def get_available_users(
    session: SessionDep, current_user: CurrentUser, group_id: int = None
) -> Any:
    """
    Get users that can be added to a group with rich profile metadata.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    query = session.query(User).order_by(User.email.asc())

    if group_id:
        # Exclude users already in the group
        subquery = session.query(GroupMember.user_id).filter(
            GroupMember.group_id == group_id
        )
        query = query.filter(User.id.notin_(subquery))

    users = query.all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "nom": u.nom,
            "prenom": u.prenom,
            "username": u.username,
            "avatar_url": u.avatar_url,
            "departement": u.departement,
            "group_name": u.group_name,
        }
        for u in users
    ]


@router.get("/instructors", response_model=list[dict])
@router.get("/instructors/", response_model=list[dict])
def get_instructors(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get list of instructors/formateurs and staff members eligible to be assigned to a group.
    """
    if not is_staff_role(current_user.role):
        raise HTTPException(status_code=403, detail="Non autorisé.")

    staff_users = (
        session.query(User)
        .filter(
            func.lower(User.role).in_(
                ["formateur", "pedagogique", "admin", "admin_manager", "dg_rh", "dg/rh", "dgrh"]
            )
        )
        .order_by(User.nom.asc(), User.prenom.asc(), User.email.asc())
        .all()
    )

    return [
        {
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "nom": u.nom,
            "prenom": u.prenom,
            "username": u.username,
            "avatar_url": u.avatar_url,
            "departement": u.departement,
        }
        for u in staff_users
    ]


