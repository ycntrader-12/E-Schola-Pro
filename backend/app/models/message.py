from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_name = Column(String(255), nullable=True)
    attachment_type = Column(String(50), nullable=True)
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False, nullable=True)
    is_draft = Column(Boolean, default=False)
    is_trash = Column(Boolean, default=False)
    is_reported = Column(Boolean, default=False)
    report_reason = Column(String(500), nullable=True)
    is_broadcast = Column(Boolean, default=False)
    is_welcome_msg = Column(Boolean, default=False)
    is_relay = Column(Boolean, default=False)
    cc_emails = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

    def __str__(self):
        return f"{self.subject} ({self.sender_id} -> {self.recipient_id})"
