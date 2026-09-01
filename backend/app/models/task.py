from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    course_name = Column(String, default="Général", nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_role = Column(
        String, default="all", nullable=False
    )  # 'all', 'étudiant', 'stagiaire', 'employer'
    target_group = Column(String, default="all", nullable=False)
    due_date = Column(String, nullable=False)  # e.g. "2026-09-15"
    points = Column(Integer, default=20, nullable=False)
    priority = Column(
        String, default="moyenne", nullable=False
    )  # 'haute', 'moyenne', 'basse'
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    assigned_by = relationship("User")
    submissions = relationship(
        "TaskSubmission", back_populates="task", cascade="all, delete-orphan"
    )


class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_link = Column(Text, nullable=False)  # Link, file URL, or text deliverable
    status = Column(
        String, default="submitted", nullable=False
    )  # 'submitted', 'graded', 'late'
    grade = Column(Float, nullable=True)  # e.g. 18.0 / 20
    feedback = Column(Text, nullable=True)  # Comments from instructor/admin
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="submissions")
    user = relationship("User")
