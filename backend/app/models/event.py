from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    target_roles = Column(String, default="étudiant,stagiaire,employer", nullable=False)

    deliverables = relationship(
        "EventDeliverable", back_populates="event", cascade="all, delete-orphan"
    )


class EventDeliverable(Base):
    __tablename__ = "event_deliverables"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_url = Column(String, nullable=True)
    link_url = Column(String, nullable=True)
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)

    event = relationship("Event", back_populates="deliverables")
    user = relationship("User")
