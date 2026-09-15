import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class AssessmentType(str, enum.Enum):
    QUIZ = "QUIZ"
    CERTIFICATION = "CERTIFICATION"


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


def generate_uuid():
    return str(uuid.uuid4())


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(
        Enum(AssessmentType, name="assessment_type", native_enum=False),
        default=AssessmentType.QUIZ,
        nullable=False,
    )
    is_standard_recommended = Column(Boolean, default=False, nullable=False)
    time_limit_minutes = Column(Integer, default=30, nullable=True)
    passing_score_percentage = Column(Numeric(5, 2), default=70.00, nullable=False)
    show_corrections_after = Column(Boolean, default=True, nullable=False)
    certificate_template_url = Column(String(255), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    assignments = relationship(
        "AssessmentAssignment",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )
    questions = relationship(
        "Question",
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
    attempts = relationship(
        "UserAttempt",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )
    certificates = relationship(
        "UserCertificate",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )

    def __str__(self):
        return f"{self.title} ({self.type.value})"


class AssessmentAssignment(Base):
    __tablename__ = "assessment_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    assessment_id = Column(
        String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    assessment = relationship("Assessment", back_populates="assignments")
    group = relationship("Group", foreign_keys=[group_id])

    def __str__(self):
        return f"Assignment {self.assessment_id} -> Group {self.group_id}"


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    assessment_id = Column(
        String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    points = Column(Integer, default=1, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)

    # Relationships
    assessment = relationship("Assessment", back_populates="questions")
    choices = relationship(
        "Choice",
        back_populates="question",
        cascade="all, delete-orphan",
    )

    def __str__(self):
        return f"Q: {self.content[:40]}..."


class Choice(Base):
    __tablename__ = "choices"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    question_id = Column(
        String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)

    # Relationships
    question = relationship("Question", back_populates="choices")

    def __str__(self):
        return f"{'[V]' if self.is_correct else '[X]'} {self.content[:30]}"


class UserAttempt(Base):
    __tablename__ = "user_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    assessment_id = Column(
        String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score_percentage = Column(Numeric(5, 2), nullable=True)
    is_passed = Column(Boolean, nullable=True)
    status = Column(
        Enum(AttemptStatus, name="attempt_status", native_enum=False),
        default=AttemptStatus.IN_PROGRESS,
        nullable=False,
    )
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="attempts")
    user = relationship("User", foreign_keys=[user_id])
    answers = relationship(
        "UserAnswer",
        back_populates="attempt",
        cascade="all, delete-orphan",
    )
    certificate = relationship(
        "UserCertificate",
        back_populates="attempt",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __str__(self):
        return f"Attempt {self.id[:8]} - User {self.user_id} - {self.status.value}"


class UserAnswer(Base):
    __tablename__ = "user_answers"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    attempt_id = Column(
        String(36), ForeignKey("user_attempts.id", ondelete="CASCADE"), nullable=False
    )
    question_id = Column(
        String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    selected_choice_id = Column(
        String(36), ForeignKey("choices.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    attempt = relationship("UserAttempt", back_populates="answers")
    question = relationship("Question")
    selected_choice = relationship("Choice")


class UserCertificate(Base):
    __tablename__ = "user_certificates"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assessment_id = Column(
        String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    attempt_id = Column(
        String(36), ForeignKey("user_attempts.id", ondelete="CASCADE"), nullable=False
    )
    certificate_file_url = Column(String(255), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    assessment = relationship("Assessment", back_populates="certificates")
    attempt = relationship("UserAttempt", back_populates="certificate")

    def __str__(self):
        return f"Certificate {self.id[:8]} for User {self.user_id}"
