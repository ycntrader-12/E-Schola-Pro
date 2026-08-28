from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.schemas.user import UserResponse

class ClassroomBase(BaseModel):
    title: str
    description: Optional[str] = None

class ClassroomCreate(ClassroomBase):
    room_id: Optional[str] = None

class ClassroomResponse(ClassroomBase):
    id: int
    room_id: str
    instructor_id: int
    is_active: bool
    created_at: datetime
    instructor: Optional[UserResponse] = None

    class Config:
        from_attributes = True
