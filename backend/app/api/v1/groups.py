from typing import Any, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.api.deps import SessionDep, CurrentUser
from app.models.group import Group, GroupMember
from app.models.user import User
from app.schemas.group import GroupCreate, GroupUpdate, GroupResponse, GroupMemberCreate, GroupMemberResponse

router = APIRouter()

@router.get("/", response_model=List[GroupResponse])
def read_groups(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 200,
) -> Any:
    """
    Retrieve all groups.
    """
    groups = session.query(Group).order_by(Group.created_at.desc()).offset(skip).limit(limit).all()
    
    # Attach members_count for each group
    response = []
    for g in groups:
        count = session.query(GroupMember).filter(GroupMember.group_id == g.id).count()
        g_dict = {
            "id": g.id,
            "name": g.name,
            "level": g.level,
            "description": g.description,
            "created_at": g.created_at,
            "members_count": count
        }
        response.append(g_dict)
    
    return response

@router.post("/", response_model=GroupResponse)
def create_group(
    *,
    session: SessionDep,
    group_in: GroupCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create a new group. Admin and formateur only.
    """
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    group = Group(
        name=group_in.name.strip(),
        level=group_in.level.strip() if group_in.level else None,
        description=group_in.description.strip() if group_in.description else None
    )
    session.add(group)
    session.commit()
    session.refresh(group)
    
    return {
        "id": group.id,
        "name": group.name,
        "level": group.level,
        "description": group.description,
        "created_at": group.created_at,
        "members_count": 0
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
    Update a group. Admin and formateur only.
    """
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    if group_in.name is not None:
        group.name = group_in.name.strip()
    if group_in.level is not None:
        group.level = group_in.level.strip() if group_in.level else None
    if group_in.description is not None:
        group.description = group_in.description.strip() if group_in.description else None

    session.commit()
    session.refresh(group)
    
    count = session.query(GroupMember).filter(GroupMember.group_id == group.id).count()
    return {
        "id": group.id,
        "name": group.name,
        "level": group.level,
        "description": group.description,
        "created_at": group.created_at,
        "members_count": count
    }

@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a group. Admin and formateur only.
    """
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")
        
    session.delete(group)
    session.commit()
    return {"message": "Groupe supprimé avec succès."}

# --- Members Management ---

@router.get("/{group_id}/members", response_model=List[GroupMemberResponse])
def get_group_members(
    group_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get members of a group.
    """
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")

    members = session.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    
    response = []
    for m in members:
        user = session.query(User).filter(User.id == m.user_id).first()
        response.append({
            "id": m.id,
            "group_id": m.group_id,
            "user_id": m.user_id,
            "joined_at": m.joined_at,
            "user_email": user.email if user else "Inconnu",
            "user_role": user.role if user else "Inconnu"
        })
        
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
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    group = session.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Groupe introuvable.")
        
    user = session.query(User).filter(User.id == member_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
        
    # Check if already in group
    existing = session.query(GroupMember).filter(
        GroupMember.group_id == group_id, 
        GroupMember.user_id == member_in.user_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Cet utilisateur est déjà dans ce groupe.")
        
    member = GroupMember(
        group_id=group_id,
        user_id=member_in.user_id
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    
    return {
        "id": member.id,
        "group_id": member.group_id,
        "user_id": member.user_id,
        "joined_at": member.joined_at,
        "user_email": user.email,
        "user_role": user.role
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
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    member = session.query(GroupMember).filter(
        GroupMember.group_id == group_id, 
        GroupMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="Membre introuvable dans ce groupe.")
        
    session.delete(member)
    session.commit()
    return {"message": "Membre retiré du groupe."}

@router.get("/available-users", response_model=List[dict])
def get_available_users(
    session: SessionDep,
    current_user: CurrentUser,
    group_id: int = None
) -> Any:
    """
    Get users that can be added to a group.
    """
    if current_user.role not in ["admin", "formateur"]:
        raise HTTPException(status_code=403, detail="Non autorisé.")
        
    query = session.query(User).order_by(User.email.asc())
    
    if group_id:
        # Exclude users already in the group
        subquery = session.query(GroupMember.user_id).filter(GroupMember.group_id == group_id)
        query = query.filter(User.id.notin_(subquery))
        
    users = query.all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]
