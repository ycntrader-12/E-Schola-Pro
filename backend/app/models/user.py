from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
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
    )  # "admin", "admin_manager", "formateur", "pedagogique", "dg_rh", "employer", "stagiaire", "étudiant"
    is_active = Column(Boolean, default=True, nullable=False)
    token_version = Column(Integer, default=1, nullable=False, server_default="1")
    
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
    
    avatar_url = Column(Text, nullable=True)
    group_name = Column(String, default=None, nullable=True)

    # Réinitialisation de mot de passe directe
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)

    courses_enrolled = relationship(
        "Enrollment", back_populates="user", cascade="all, delete"
    )
    courses_taught = relationship(
        "Course", back_populates="instructor", cascade="all, delete"
    )

    def __str__(self):
        return self.username or self.email or str(self.id)

