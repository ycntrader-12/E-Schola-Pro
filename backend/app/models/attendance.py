from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    marked_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    date = Column(Date, default=date.today, nullable=False, index=True)
    status = Column(
        String, nullable=False, default="present"
    )  # "present", "late", "absent", "excused"
    minutes_late = Column(Integer, default=0)
    session_name = Column(String, default="Session Principale")
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="attendances")
    marked_by = relationship("User", foreign_keys=[marked_by_id])
