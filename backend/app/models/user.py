from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(
        String, default="étudiant"
    )  # "admin", "formateur", "employer", "stagiaire", "étudiant"
    avatar_url = Column(String, nullable=True)
    group_name = Column(String, default="Groupe A - Informatique & IA", nullable=True)

    courses_enrolled = relationship(
        "Enrollment", back_populates="user", cascade="all, delete"
    )
    courses_taught = relationship(
        "Course", back_populates="instructor", cascade="all, delete"
    )

    def __str__(self):
        return self.email
