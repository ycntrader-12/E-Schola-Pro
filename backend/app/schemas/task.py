from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    course_name: str = "Général"
    target_role: str = "all"
    target_group: str = "all"
    due_date: str
    points: int = 20
    priority: str = "moyenne"

class TaskCreate(TaskBase):
    pass

class TaskSubmissionBase(BaseModel):
    content_link: str

class TaskSubmissionCreate(TaskSubmissionBase):
    pass

class TaskSubmissionGrade(BaseModel):
    grade: float
    feedback: Optional[str] = None

class TaskSubmissionResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    content_link: str
    status: str
    grade: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: datetime
    user_email: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True

class TaskResponse(TaskBase):
    id: int
    assigned_by_id: int
    created_at: datetime
    assigned_by_email: Optional[str] = None
    my_submission: Optional[TaskSubmissionResponse] = None
    total_submissions: Optional[int] = 0

    class Config:
        from_attributes = True
