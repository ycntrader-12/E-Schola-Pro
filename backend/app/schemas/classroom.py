from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserResponse


class ClassroomBase(BaseModel):
    title: str
    description: str | None = None
    target_roles: str | None = None


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
