from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class UserShortResponse(BaseModel):
    id: int
    email: str
    role: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    subject: str
    body: str
    recipient_id: Optional[int] = None
    recipient_email: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    is_draft: bool = False

class MessageReport(BaseModel):
    reason: str = "Contenu inapproprié ou suspect"

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: Optional[int] = None
    subject: str
    body: str
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    is_read: bool
    is_draft: bool = False
    is_trash: bool = False
    is_reported: bool = False
    report_reason: Optional[str] = None
    created_at: datetime
    sender: Optional[UserShortResponse] = None
    recipient: Optional[UserShortResponse] = None

    class Config:
        from_attributes = True
