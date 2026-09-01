from pydantic import BaseModel


class UserBase(BaseModel):
    email: str
    role: str = "étudiant"
    avatar_url: str | None = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True


class UserUpdatePassword(BaseModel):
    current_password: str
    new_password: str
