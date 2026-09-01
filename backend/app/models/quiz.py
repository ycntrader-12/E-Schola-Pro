from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_roles = Column(String, default="étudiant,stagiaire,employer")
    time_limit_minutes = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    questions = relationship(
        "QuizQuestion", back_populates="quiz", cascade="all, delete-orphan"
    )
    attempts = relationship(
        "QuizAttempt", back_populates="quiz", cascade="all, delete-orphan"
    )
    creator = relationship("User", foreign_keys=[created_by_id])
    course = relationship("Course", foreign_keys=[course_id])

    def __str__(self):
        return self.title


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(
        Text, nullable=False
    )  # JSON string e.g. ["Choix A", "Choix B", "Choix C", "Choix D"]
    correct_option_index = Column(Integer, nullable=False)  # 0 to 3
    points = Column(Integer, default=1)

    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False)
    max_score = Column(Integer, nullable=False)
    percentage = Column(Float, nullable=False)
    answers = Column(Text, nullable=True)  # JSON string of answers
    completed_at = Column(DateTime, default=datetime.utcnow)

    quiz = relationship("Quiz", back_populates="attempts")
    user = relationship("User", foreign_keys=[user_id])
