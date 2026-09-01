from datetime import datetime

from pydantic import BaseModel


class EnrollmentBase(BaseModel):
    course_id: int


class EnrollmentCreate(EnrollmentBase):
    pass


class EnrollmentResponse(EnrollmentBase):
    id: int
    user_id: int
    enrolled_at: datetime

    class Config:
        from_attributes = True
