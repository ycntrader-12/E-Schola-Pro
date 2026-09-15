from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.assessment import AssessmentType, AttemptStatus


# ==============================================================================
# CHOICES SCHEMAS
# ==============================================================================
class ChoiceIn(BaseModel):
    content: str
    is_correct: bool = False


class ChoiceOut(BaseModel):
    """
    Sécurisé pour la passation de l'évaluation :
    is_correct N'EST JAMAIS EXPOSÉ à l'apprenant pendant l'examen.
    """
    id: str
    question_id: str
    content: str

    model_config = ConfigDict(from_attributes=True)


class ChoiceReviewOut(BaseModel):
    """
    Utilisé uniquement lors de la revue post-soumission (feedback).
    """
    id: str
    question_id: str
    content: str
    is_correct: bool

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# QUESTIONS SCHEMAS
# ==============================================================================
class QuestionIn(BaseModel):
    content: str
    points: int = 1
    choices: List[ChoiceIn] = []


class QuestionOut(BaseModel):
    id: str
    assessment_id: str
    content: str
    points: int = 1
    order_index: int = 0
    choices: List[ChoiceOut] = []

    model_config = ConfigDict(from_attributes=True)


class QuestionReviewOut(BaseModel):
    id: str
    assessment_id: str
    content: str
    points: int = 1
    order_index: int = 0
    choices: List[ChoiceReviewOut] = []
    user_selected_choice_id: Optional[str] = None
    is_user_correct: bool = False
    points_earned: int = 0

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# GROUPS
# ==============================================================================
class AssignedGroupOut(BaseModel):
    id: int
    name: str
    level: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ASSESSMENTS SCHEMAS
# ==============================================================================
class AssessmentCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    type: AssessmentType = AssessmentType.QUIZ
    is_standard_recommended: bool = False
    time_limit_minutes: Optional[int] = 30
    passing_score_percentage: float = 70.00
    show_corrections_after: bool = True
    certificate_template_url: Optional[str] = None
    assigned_group_ids: List[int] = []
    questions: List[QuestionIn] = []


class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[AssessmentType] = None
    is_standard_recommended: Optional[bool] = None
    time_limit_minutes: Optional[int] = None
    passing_score_percentage: Optional[float] = None
    show_corrections_after: Optional[bool] = None
    certificate_template_url: Optional[str] = None
    assigned_group_ids: Optional[List[int]] = None


class AssessmentOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    type: AssessmentType
    is_standard_recommended: bool = False
    time_limit_minutes: Optional[int] = 30
    passing_score_percentage: float = 70.00
    show_corrections_after: bool = True
    certificate_template_url: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    question_count: int = 0
    total_points: int = 0
    assigned_groups: List[AssignedGroupOut] = []
    has_completed: bool = False
    best_score: Optional[float] = None
    is_passed: bool = False
    latest_attempt_id: Optional[str] = None
    certificate_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssessmentDetailOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    type: AssessmentType
    is_standard_recommended: bool = False
    time_limit_minutes: Optional[int] = 30
    passing_score_percentage: float = 70.00
    show_corrections_after: bool = True
    certificate_template_url: Optional[str] = None
    created_by: int
    creator_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    question_count: int = 0
    total_points: int = 0
    assigned_groups: List[AssignedGroupOut] = []
    questions: List[QuestionOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# ATTEMPTS & SUBMISSIONS
# ==============================================================================
class StartAttemptResponse(BaseModel):
    attempt_id: str
    assessment: AssessmentDetailOut
    started_at: datetime
    time_limit_minutes: Optional[int] = 30


class SubmitAnswersRequest(BaseModel):
    answers: Dict[str, str] = {}  # {question_id: selected_choice_id}


class AttemptReviewOut(BaseModel):
    attempt_id: str
    assessment_id: str
    assessment_title: str
    assessment_type: str
    passing_score_percentage: float
    score_percentage: float
    is_passed: bool
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_points_earned: int
    total_points_possible: int
    show_corrections: bool
    certificate_url: Optional[str] = None
    questions: List[QuestionReviewOut] = []

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# CERTIFICATES
# ==============================================================================
class UserCertificateOut(BaseModel):
    id: str
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    assessment_id: str
    assessment_title: str
    attempt_id: str
    score_percentage: float
    certificate_file_url: str
    issued_at: datetime

    model_config = ConfigDict(from_attributes=True)
