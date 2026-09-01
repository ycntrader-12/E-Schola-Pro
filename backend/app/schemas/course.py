from datetime import datetime

from pydantic import BaseModel

from .user import UserResponse


class CourseVideoBase(BaseModel):
    title: str
    description: str | None = None
    video_url: str
    order_index: int = 0


class CourseVideoCreate(CourseVideoBase):
    pass


class CourseVideoResponse(CourseVideoBase):
    id: int
    course_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    title: str
    description: str | None = None
    cover_image_url: str | None = None
    document_url: str | None = None


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: int
    instructor_id: int
    instructor: UserResponse | None = None
    videos: list[CourseVideoResponse] = []

    class Config:
        from_attributes = True
