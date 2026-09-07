from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class ClassroomInvitation(Base):
    __tablename__ = "classroom_invitations"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(
        Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False
    )
    inviter_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invitee_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(String, default="pending", nullable=False)  # pending, accepted, declined
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", backref="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

    def __str__(self):
        return f"Invitation #{self.id} for classroom {self.classroom_id} to user {self.invitee_id} ({self.status})"
