from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class GroupMemberBase(BaseModel):
    user_id: int


class GroupMemberCreate(GroupMemberBase):
    pass


class GroupMemberResponse(GroupMemberBase):
    id: int
    group_id: int
    joined_at: datetime
    # Extra fields for frontend
    user_email: str | None = None
    user_role: str | None = None

    class Config:
        from_attributes = True


class GroupBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Nom du groupe ou de la classe")
    level: str | None = Field(default=None, max_length=100, description="Niveau académique optionnel")
    description: str | None = Field(default=None, max_length=1000, description="Description détaillée optionnelle")

    @field_validator("name", "level", "description", mode="before")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    level: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=1000)

    @field_validator("name", "level", "description", mode="before")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v


class GroupResponse(GroupBase):
    id: int
    created_at: datetime
    members_count: int | None = 0

    class Config:
        from_attributes = True
