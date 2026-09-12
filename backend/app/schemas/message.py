from datetime import datetime

from pydantic import BaseModel


class UserShortResponse(BaseModel):
    id: int
    email: str | None = None
    role: str | None = "étudiant"
    avatar_url: str | None = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    subject: str = ""
    body: str = ""
    recipient_id: int | None = None
    recipient_email: str | None = None
    recipient_ids: list[int] = []
    recipient_emails: list[str] = []
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_type: str | None = None
    is_draft: bool = False
    is_broadcast: bool = False
    cc_recipient_ids: list[int] = []
    cc_emails: list[str] = []


class MessageReport(BaseModel):
    reason: str = "Contenu inapproprié ou suspect"


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    recipient_id: int | None = None
    subject: str = ""
    body: str = ""
    attachment_url: str | None = None
    attachment_name: str | None = None
    attachment_type: str | None = None
    is_read: bool | None = False
    read_at: datetime | None = None
    is_starred: bool | None = False
    is_draft: bool | None = False
    is_trash: bool | None = False
    is_reported: bool | None = False
    report_reason: str | None = None
    is_broadcast: bool | None = False
    is_welcome_msg: bool | None = False
    is_relay: bool | None = False
    cc_emails: str | None = None
    created_at: datetime
    sender: UserShortResponse | None = None
    recipient: UserShortResponse | None = None

    class Config:
        from_attributes = True
