from fastapi import APIRouter

from app.api.v1 import (
    attendance,
    classrooms,
    courses,
    enrollments,
    events,
    groups,
    login,
    messages,
    quizzes,
    tasks,
    upload,
    users,
)

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(
    enrollments.router, prefix="/enrollments", tags=["enrollments"]
)
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(classrooms.router, prefix="/classrooms", tags=["classrooms"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
