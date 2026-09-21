from fastapi import APIRouter

from app.api.v1 import (
    admin,
    attendance,
    classrooms,
    courses,
    email,
    enrollments,
    events,
    groups,
    health,
    login,
    messages,
    quizzes,
    assessments,
    tasks,
    upload,
    users,
    password_reset,
)

api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(login.router, tags=["login"])
api_router.include_router(password_reset.router, prefix="/password-reset", tags=["password-reset"])
api_router.include_router(password_reset.router, prefix="/auth", tags=["auth"])
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
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(email.router, prefix="/email", tags=["email"])
api_router.include_router(email.router, prefix="/emails", tags=["emails"])

