from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class SystemSetting(Base):
    """
    Paramètres de configuration dynamiques de la plateforme E-Schola Pro persistés en base.
    Permet à l'administrateur de modifier le nom du site, le mode maintenance, les inscriptions,
    les quotas et les règles de sécurité sans redéploiement.
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, default="general", nullable=False)  # general, security, email, storage
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    updated_by = relationship("User", foreign_keys=[updated_by_id])
