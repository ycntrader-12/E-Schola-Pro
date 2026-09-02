from datetime import datetime

from pydantic import BaseModel


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    course_name: str = "Général"
    target_role: str = "all"
    target_group: str = "all"
    due_date: str
    points: int = 20
    priority: str = "moyenne"
    attachment_url: str | None = None


class TaskCreate(TaskBase):
    pass


class TaskSubmissionBase(BaseModel):
    content_link: str


class TaskSubmissionCreate(TaskSubmissionBase):
    pass


class TaskSubmissionGrade(BaseModel):
    grade: float
    feedback: str | None = None


class TaskSubmissionResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    content_link: str
    status: str
    grade: float | None = None
    feedback: str | None = None
    submitted_at: datetime
    user_email: str | None = None
    user_role: str | None = None

    class Config:
        from_attributes = True


class TaskResponse(TaskBase):
    id: int
    assigned_by_id: int
    created_at: datetime
    assigned_by_email: str | None = None
    my_submission: TaskSubmissionResponse | None = None
    total_submissions: int | None = 0

    class Config:
        from_attributes = True
