from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import backref, relationship

from app.db.base import Base


class PasswordResetRequest(Base):
    """
    Modèle de suivi sécurisé des demandes de réinitialisation de mot de passe par code OTP.
    - Le code OTP n'est JAMAIS stocké en clair (uniquement son hachage sécurisé dans otp_hash).
    - Suivi strict du nombre d'essais (attempts) avec verrouillage anti-bruteforce.
    - Émission d'un token temporaire à usage unique (reset_token_hash) pour autoriser l'étape mot de passe.
    - Traçabilité et audit (created_at, used_at, ip_address).
    """
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    otp_hash = Column(String(255), nullable=False)
    reset_token_hash = Column(String(255), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    used_at = Column(DateTime, nullable=True)
    ip_address = Column(String(100), nullable=True)

    user = relationship("User", backref=backref("reset_requests", passive_deletes=True), passive_deletes=True)

    def __str__(self):
        return f"PasswordResetRequest(user_id={self.user_id}, email={self.email}, used={self.used}, attempts={self.attempts})"
