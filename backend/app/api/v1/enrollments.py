from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.schemas.enrollment import EnrollmentCreate, EnrollmentResponse

router = APIRouter()


@router.post("/", response_model=EnrollmentResponse)
def enroll_in_course(
    *,
    session: SessionDep,
    enrollment_in: EnrollmentCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Enroll the current user in a course.
    """
    course = session.query(Course).filter(Course.id == enrollment_in.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing_enrollment = (
        session.query(Enrollment)
        .filter(
            Enrollment.course_id == enrollment_in.course_id,
            Enrollment.user_id == current_user.id,
        )
        .first()
    )

    if existing_enrollment:
        raise HTTPException(status_code=400, detail="Already enrolled in this course")

    enrollment = Enrollment(user_id=current_user.id, course_id=enrollment_in.course_id)
    session.add(enrollment)
    session.commit()
    session.refresh(enrollment)
    return enrollment


@router.get("/me", response_model=list[EnrollmentResponse])
def get_my_enrollments(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get all enrollments for the current user.
    """
    enrollments = (
        session.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()
    )
    return enrollments
