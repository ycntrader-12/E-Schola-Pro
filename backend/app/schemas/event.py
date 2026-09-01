from datetime import datetime

from pydantic import BaseModel


class EventBase(BaseModel):
    title: str
    description: str | None = None
    start_time: datetime
    end_time: datetime
    target_roles: str = "étudiant,stagiaire,employer"


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    target_roles: str | None = None


class EventResponse(EventBase):
    id: int

    class Config:
        from_attributes = True


class EventDeliverableCreate(BaseModel):
    file_url: str | None = None
    link_url: str | None = None


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
    file_url: str | None = None
    link_url: str | None = None
    submitted_at: datetime

    # Return basic user info
    user: UserBasic | None = None

    class Config:
        from_attributes = True
