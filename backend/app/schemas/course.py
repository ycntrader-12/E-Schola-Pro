from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from .user import UserResponse

class CourseVideoBase(BaseModel):
    title: str
    description: Optional[str] = None
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
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    document_url: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: int
    instructor_id: int
    instructor: Optional[UserResponse] = None
    videos: List[CourseVideoResponse] = []
    
    class Config:
        from_attributes = True
