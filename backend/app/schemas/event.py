from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    target_roles: str = "étudiant,stagiaire,employer"

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    target_roles: Optional[str] = None

class EventResponse(EventBase):
    id: int

    class Config:
        from_attributes = True

class EventDeliverableCreate(BaseModel):
    file_url: Optional[str] = None
    link_url: Optional[str] = None

class UserBasic(BaseModel):
    id: int
    email: str
    role: str
    
    class Config:
        from_attributes = True

class EventDeliverableResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    file_url: Optional[str] = None
    link_url: Optional[str] = None
    submitted_at: datetime
    
    # Return basic user info
    user: Optional[UserBasic] = None

    class Config:
        from_attributes = True
