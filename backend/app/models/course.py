from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text)
    cover_image_url = Column(String, nullable=True)
    document_url = Column(String, nullable=True)
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

    instructor = relationship("User", back_populates="courses_taught")
    enrollments = relationship(
        "Enrollment", back_populates="course", cascade="all, delete"
    )
    videos = relationship(
        "CourseVideo",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseVideo.order_index",
    )

    def __str__(self):
        return self.title
