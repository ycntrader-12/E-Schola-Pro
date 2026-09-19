from typing import Optional
from pydantic import BaseModel, Field


class PasswordResetRequest(BaseModel):
    email: str = Field(..., description="Adresse email associée au compte E-Schola Pro")


class PasswordResetVerifyResponse(BaseModel):
    valid: bool
    masked_email: Optional[str] = None
    message: str


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., description="Jeton de réinitialisation unique")
    new_password: str = Field(..., min_length=6, description="Nouveau mot de passe (minimum 6 caractères)")
