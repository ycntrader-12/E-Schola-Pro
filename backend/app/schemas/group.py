from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class GroupMemberBase(BaseModel):
    user_id: int

class GroupMemberCreate(GroupMemberBase):
    pass

class GroupMemberResponse(GroupMemberBase):
    id: int
    group_id: int
    joined_at: datetime
    # Extra fields for frontend
    user_email: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True

class GroupBase(BaseModel):
    name: str
    level: Optional[str] = None
    description: Optional[str] = None

class GroupCreate(GroupBase):
    pass

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[str] = None
    description: Optional[str] = None

class GroupResponse(GroupBase):
    id: int
    created_at: datetime
    members_count: Optional[int] = 0

    class Config:
        from_attributes = True
