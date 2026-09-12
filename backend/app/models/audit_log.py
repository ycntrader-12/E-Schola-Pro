from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditLog(Base):
    """
    Journal d'audit immuable enregistrant toutes les actions critiques de la plateforme :
    authentifications, gestion des utilisateurs, modifications de rôles, sauvegardes,
    paramètres système et supervision.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)  # ex: LOGIN_SUCCESS, USER_CREATE, ROLE_UPDATE, etc.
    resource_type = Column(String, nullable=True, index=True)  # ex: user, course, system, quiz, classroom
    resource_id = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    status = Column(String, default="SUCCESS", nullable=False)  # SUCCESS, FAILED, WARNING
    created_at = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
