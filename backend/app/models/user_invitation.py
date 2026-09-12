from datetime import datetime, timedelta
import secrets
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class UserInvitation(Base):
    """
    Modèle pour la gestion des invitations d'utilisateurs par email et token sécurisé.
    Statuts : 'pending', 'accepted', 'revoked', 'expired'.
    """
    __tablename__ = "user_invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False, default="étudiant")
    group_name = Column(String, nullable=True)
    token = Column(String, unique=True, index=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    status = Column(String, default="pending", nullable=False, index=True)  # pending, accepted, revoked, expired
    invited_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow() + timedelta(days=7))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invited_by = relationship("User", foreign_keys=[invited_by_id])
