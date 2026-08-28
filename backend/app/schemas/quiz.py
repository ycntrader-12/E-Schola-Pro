from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class QuizQuestionCreate(BaseModel):
    question_text: str
    options: List[str]
    correct_option_index: int
    points: int = 1

class QuizQuestionResponse(BaseModel):
    id: int
    question_text: str
    options: List[str]
    points: int
    correct_option_index: Optional[int] = None  # None for students taking the test

class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: Optional[int] = None
    target_roles: Optional[str] = "étudiant,stagiaire,employer"
    time_limit_minutes: int = 15
    questions: List[QuizQuestionCreate]

class QuizResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    course_id: Optional[int] = None
    created_by_id: int
    creator_email: Optional[str] = None
    target_roles: str
    time_limit_minutes: int
    created_at: datetime
    question_count: int = 0
    total_points: int = 0
    is_completed: bool = False
    best_percentage: Optional[float] = None

    class Config:
        from_attributes = True

class QuizDetailResponse(QuizResponse):
    questions: List[QuizQuestionResponse] = []

class QuizSubmit(BaseModel):
    answers: Dict[int, int]  # question_id -> selected_option_index (0..3)

class QuizAttemptResponse(BaseModel):
    id: int
    quiz_id: int
    quiz_title: Optional[str] = None
    user_id: int
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    score: int
    max_score: int
    percentage: float
    completed_at: datetime

    class Config:
        from_attributes = True
