from datetime import datetime

from pydantic import BaseModel


class GroupMemberBase(BaseModel):
    user_id: int


class GroupMemberCreate(GroupMemberBase):
    pass


class GroupMemberResponse(GroupMemberBase):
    id: int
    group_id: int
    joined_at: datetime
    # Extra fields for frontend
    user_email: str | None = None
    user_role: str | None = None

    class Config:
        from_attributes = True


class GroupBase(BaseModel):
    name: str
    level: str | None = None
    description: str | None = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = None
    level: str | None = None
    description: str | None = None


class GroupResponse(GroupBase):
    id: int
    created_at: datetime
    members_count: int | None = 0

    class Config:
        from_attributes = True
