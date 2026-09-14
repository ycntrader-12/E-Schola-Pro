from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.core.sanitizer import sanitize_attachment_url, sanitize_text
from app.models.course import Course
from app.models.course_video import CourseVideo
from app.schemas.course import (
    CourseCreate,
    CourseResponse,
    CourseVideoCreate,
    CourseVideoResponse,
)

router = APIRouter()
ADMIN_ROLES = ["admin", "admin_manager"]


@router.get("/", response_model=list[CourseResponse])
def read_courses(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all courses. Restricted to authenticated users.
    """
    courses = session.query(Course).offset(skip).limit(limit).all()
    return courses


@router.post("/", response_model=CourseResponse)
def create_course(
    *,
    session: SessionDep,
    course_in: CourseCreate,
    current_user: CurrentUser,
) -> Any:
    """
    Create new course.
    """
    # Verify if current_user.role is authorized
    if current_user.role not in ["formateur", "pedagogique", "dg_rh"] + ADMIN_ROLES:
        raise HTTPException(
            status_code=403, detail="Not enough permissions to upload courses"
        )

    # Sanitize cover image and document URLs against injection/XSS
    clean_cover = sanitize_attachment_url(course_in.cover_image_url) if course_in.cover_image_url else None
    clean_doc = sanitize_attachment_url(course_in.document_url) if course_in.document_url else None

    course = Course(
        title=sanitize_text(course_in.title, max_length=200) or course_in.title,
        description=sanitize_text(course_in.description, max_length=5000) if course_in.description else None,
        cover_image_url=clean_cover,
        document_url=clean_doc,
        instructor_id=current_user.id,
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseResponse)
def read_course(
    course_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Get course by ID. Restricted to authenticated users.
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.delete("/{course_id}")
def delete_course(
    course_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a course. (Admin, Admin Manager or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role not in ADMIN_ROLES and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not enough permissions to delete this course"
        )

    session.delete(course)
    session.commit()
    return {"message": "Course deleted successfully", "id": course_id}


@router.post("/{course_id}/videos", response_model=CourseVideoResponse)
def add_course_video(
    course_id: int,
    video_in: CourseVideoCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Add a video to a course playlist. (Admin, Admin Manager or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role not in ADMIN_ROLES and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions to add videos to this course",
        )

    clean_video_url = sanitize_attachment_url(video_in.video_url) if video_in.video_url else None
    if not clean_video_url:
        raise HTTPException(status_code=400, detail="URL de vidéo invalide ou protocole non autorisé.")

    video = CourseVideo(
        course_id=course.id,
        title=sanitize_text(video_in.title, max_length=200) or video_in.title,
        description=sanitize_text(video_in.description, max_length=5000) if video_in.description else None,
        video_url=clean_video_url,
        order_index=video_in.order_index,
    )
    session.add(video)
    session.commit()
    session.refresh(video)
    return video


@router.delete("/{course_id}/videos/{video_id}")
def delete_course_video(
    course_id: int,
    video_id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Delete a video from a course playlist. (Admin, Admin Manager or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user.role not in ADMIN_ROLES and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    video = (
        session.query(CourseVideo)
        .filter(CourseVideo.id == video_id, CourseVideo.course_id == course_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    session.delete(video)
    session.commit()
    return {"message": "Video deleted successfully", "id": video_id}
