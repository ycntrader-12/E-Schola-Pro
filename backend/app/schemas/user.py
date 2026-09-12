from typing import Optional, Union
from pydantic import BaseModel


class UserBase(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = "étudiant"
    is_active: Optional[bool] = True
    nom: Optional[str] = None
    prenom: Optional[str] = None
    date_naissance: Optional[str] = None
    cin: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    pays: Optional[str] = None
    departement: Optional[str] = None
    specialisation: Optional[str] = None
    avatar_url: Optional[str] = None
    group_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True


class UserMinimalRead(BaseModel):
    id: Union[int, str]
    full_name: str
    email: Optional[str] = None
    role: Optional[str] = "étudiant"
    is_active: Optional[bool] = True
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str


class StatusUpdate(BaseModel):
    is_active: bool


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None
    date_naissance: Optional[str] = None
    cin: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    ville: Optional[str] = None
    pays: Optional[str] = None
    departement: Optional[str] = None
    specialisation: Optional[str] = None
    group_name: Optional[str] = None
    password: Optional[str] = None


