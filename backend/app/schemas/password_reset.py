from typing import Optional
from pydantic import BaseModel, Field


class PasswordResetRequest(BaseModel):
    email: str = Field(..., description="Adresse email associée au compte E-Schola Pro")


class PasswordResetInitResponse(BaseModel):
    message: str
    expires_in_minutes: int
    smtp_active: bool = Field(False, description="Indique si un serveur SMTP réel est configuré et actif")
    dev_code: Optional[str] = Field(None, description="Code OTP temporaire de secours retourné uniquement lorsque SMTP n'est pas encore configuré pour éviter tout blocage")
    smtp_notice: Optional[str] = Field(None, description="Information pour la configuration d'un serveur d'envoi SMTP réel")




class VerifyResetCodeRequest(BaseModel):
    email: Optional[str] = Field(None, description="Adresse email (optionnelle si token/contexte présent)")
    code: str = Field(..., min_length=4, max_length=12, description="Code OTP à 6 chiffres reçu par email")


class VerifyResetCodeResponse(BaseModel):
    valid: bool
    reset_token: Optional[str] = Field(None, description="Jeton temporaire d'autorisation pour l'étape nouveau mot de passe")
    masked_email: Optional[str] = None
    remaining_attempts: Optional[int] = None
    message: str


class PasswordResetVerifyResponse(BaseModel):
    valid: bool
    masked_email: Optional[str] = None
    message: str


class PasswordResetConfirm(BaseModel):
    reset_token: Optional[str] = Field(None, description="Jeton temporaire d'autorisation émis après validation de l'OTP")
    token: Optional[str] = Field(None, description="Alias rétrocompatible pour le jeton de réinitialisation")
    new_password: str = Field(..., min_length=6, description="Nouveau mot de passe (minimum 6 caractères)")
    confirm_password: Optional[str] = Field(None, description="Confirmation du mot de passe")


class PasswordResetResponse(BaseModel):
    success: bool
    message: str
