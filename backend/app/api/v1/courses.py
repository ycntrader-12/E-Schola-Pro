from typing import Any, List
from fastapi import APIRouter, HTTPException
from app.api.deps import SessionDep, CurrentUser
from app.models.course import Course
from app.models.course_video import CourseVideo
from app.schemas.course import CourseCreate, CourseResponse, CourseVideoCreate, CourseVideoResponse

router = APIRouter()

@router.get("/", response_model=List[CourseResponse])
def read_courses(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve all courses.
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
    if current_user.role not in ["formateur", "admin", "pedagogique"]:
        raise HTTPException(status_code=403, detail="Not enough permissions to upload courses")
        
    course = Course(
        title=course_in.title,
        description=course_in.description,
        cover_image_url=course_in.cover_image_url,
        document_url=course_in.document_url,
        instructor_id=current_user.id
    )
    session.add(course)
    session.commit()
    session.refresh(course)
    return course

@router.get("/{course_id}", response_model=CourseResponse)
def read_course(
    course_id: int,
    session: SessionDep,
) -> Any:
    """
    Get course by ID.
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
    Delete a course. (Admin or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if current_user.role != "admin" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this course")
        
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
    Add a video to a course playlist. (Admin or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if current_user.role != "admin" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to add videos to this course")
        
    video = CourseVideo(
        course_id=course.id,
        title=video_in.title,
        description=video_in.description,
        video_url=video_in.video_url,
        order_index=video_in.order_index
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
    Delete a video from a course playlist. (Admin or course instructor)
    """
    course = session.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if current_user.role != "admin" and course.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    video = session.query(CourseVideo).filter(CourseVideo.id == video_id, CourseVideo.course_id == course_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    session.delete(video)
    session.commit()
    return {"message": "Video deleted successfully", "id": video_id}


