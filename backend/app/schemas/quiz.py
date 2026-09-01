from datetime import datetime

from pydantic import BaseModel


class QuizQuestionCreate(BaseModel):
    question_text: str
    options: list[str]
    correct_option_index: int
    points: int = 1


class QuizQuestionResponse(BaseModel):
    id: int
    question_text: str
    options: list[str]
    points: int
    correct_option_index: int | None = None  # None for students taking the test


class QuizCreate(BaseModel):
    title: str
    description: str | None = None
    course_id: int | None = None
    target_roles: str | None = "étudiant,stagiaire,employer"
    time_limit_minutes: int = 15
    questions: list[QuizQuestionCreate]


class QuizResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    course_id: int | None = None
    created_by_id: int
    creator_email: str | None = None
    target_roles: str
    time_limit_minutes: int
    created_at: datetime
    question_count: int = 0
    total_points: int = 0
    is_completed: bool = False
    best_percentage: float | None = None

    class Config:
        from_attributes = True


class QuizDetailResponse(QuizResponse):
    questions: list[QuizQuestionResponse] = []


class QuizSubmit(BaseModel):
    answers: dict[int, int]  # question_id -> selected_option_index (0..3)


class QuizAttemptResponse(BaseModel):
    id: int
    quiz_id: int
    quiz_title: str | None = None
    user_id: int
    user_email: str | None = None
    user_role: str | None = None
    score: int
    max_score: int
    percentage: float
    completed_at: datetime

    class Config:
        from_attributes = True
