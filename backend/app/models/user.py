from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(
        String, default="étudiant"
    )  # "admin", "admin_manager", "admin_limited", "formateur", "pedagogique", "employer", "stagiaire", "étudiant"
    
    # Profil standard étendu
    nom = Column(String, nullable=True)
    prenom = Column(String, nullable=True)
    date_naissance = Column(String, nullable=True)
    cin = Column(String, nullable=True)
    telephone = Column(String, nullable=True)
    adresse = Column(String, nullable=True)
    ville = Column(String, nullable=True)
    pays = Column(String, nullable=True)
    
    # Champs conditionnels selon le rôle
    departement = Column(String, nullable=True)
    specialisation = Column(String, nullable=True)
    
    avatar_url = Column(String, nullable=True)
    group_name = Column(String, default="Groupe A - Informatique & IA", nullable=True)

    courses_enrolled = relationship(
        "Enrollment", back_populates="user", cascade="all, delete"
    )
    courses_taught = relationship(
        "Course", back_populates="instructor", cascade="all, delete"
    )

    def __str__(self):
        return self.username or self.email or str(self.id)

