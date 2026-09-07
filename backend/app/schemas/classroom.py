from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class ClassroomBase(BaseModel):
    title: str
    description: str | None = None
    target_roles: str | None = None
    target_groups: str | None = None
    is_private: bool = True
    auto_invitations: bool = False
    allow_screen_sharing: bool = False
    requires_approval: bool = True
    allowed_users: str | None = None


class ClassroomCreate(ClassroomBase):
    room_id: str | None = None


class ClassroomResponse(ClassroomBase):
    id: int
    room_id: str
    instructor_id: int
    is_active: bool
    created_at: datetime
    instructor: UserResponse | None = None

    class Config:
        from_attributes = True


class ClassroomInviteCreate(BaseModel):
    user_ids: list[int] | None = None
    group_ids: list[int] | None = None


class ClassroomInvitationResponse(BaseModel):
    id: int
    classroom_id: int
    inviter_id: int
    invitee_id: int
    status: str
    created_at: datetime
    classroom: ClassroomResponse | None = None
    inviter: UserResponse | None = None

    class Config:
        from_attributes = True


