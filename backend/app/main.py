from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from app.api.main import api_router
from app.core.config import settings

from sqladmin import Admin
from app.db.database import engine
from app.db.base import Base
from app.admin import (
    UserAdmin, CourseAdmin, CourseVideoAdmin, EnrollmentAdmin, 
    ClassroomAdmin, MessageAdmin, EventAdmin, EventDeliverableAdmin,
    QuizAdmin, QuizQuestionAdmin, QuizAttemptAdmin, AttendanceAdmin,
    GroupAdmin, GroupMemberAdmin
)

# Ensure all tables exist in SQLite
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
cors_origins_str = os.getenv("BACKEND_CORS_ORIGINS")
if cors_origins_str:
    allow_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]
else:
    allow_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

admin = Admin(app, engine)
admin.add_view(UserAdmin)
admin.add_view(CourseAdmin)
admin.add_view(CourseVideoAdmin)
admin.add_view(EnrollmentAdmin)
admin.add_view(ClassroomAdmin)
admin.add_view(MessageAdmin)
admin.add_view(EventAdmin)
admin.add_view(EventDeliverableAdmin)
admin.add_view(QuizAdmin)
admin.add_view(QuizQuestionAdmin)
admin.add_view(QuizAttemptAdmin)
admin.add_view(AttendanceAdmin)
admin.add_view(GroupAdmin)
admin.add_view(GroupMemberAdmin)


@app.get("/")
def read_root():
    return {"message": "Welcome to E-Schola Pro API"}

# Mount uploads directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
