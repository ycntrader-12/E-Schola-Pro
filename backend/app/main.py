import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqladmin import Admin
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from contextlib import asynccontextmanager
from sqlalchemy import text

from app.admin import (
    AttendanceAdmin,
    ClassroomAdmin,
    CourseAdmin,
    CourseVideoAdmin,
    EnrollmentAdmin,
    EventAdmin,
    EventDeliverableAdmin,
    GroupAdmin,
    GroupMemberAdmin,
    MessageAdmin,
    QuizAdmin,
    QuizAttemptAdmin,
    QuizQuestionAdmin,
    UserAdmin,
)
from app.api.main import api_router
from app.core.config import is_in_railway, settings
from app.core.security import verify_password
from app.db.base import Base
from app.db.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Non-blocking, non-destructive startup & shutdown lifecycle.
    Verifies database connectivity without running concurrent or destructive DDL on production.
    """
    dialect = engine.dialect.name
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[Database Health] Connection established successfully on engine: {dialect}")
    except Exception as db_err:
        print(f"[Database Warning] Startup database connectivity check note: {db_err}")

    # In local development only (outside Railway), safely ensure schema exists
    if not is_in_railway():
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"[Database Notice] Local development metadata init note: {e}")

    yield
    print("[FastAPI Lifespan] Shutting down application cleanly.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Set all CORS enabled origins
cors_origins_str = os.getenv("BACKEND_CORS_ORIGINS")
if cors_origins_str:
    allow_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]
else:
    allow_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://e-schola-pro-production.up.railway.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"^https://.*\.up\.railway\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # OWASP Recommended Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


app.include_router(api_router, prefix=settings.API_V1_STR)


# --- SQLAdmin Authentication Backend ---
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")

        from app.db.database import SessionLocal
        from app.models.user import User as UserModel

        db = SessionLocal()
        try:
            uname = str(username).strip() if username else ""
            user = (
                db.query(UserModel)
                .filter((UserModel.email == uname) | (UserModel.email == uname.lower()))
                .first()
            )
            if (
                user
                and user.role in ["admin", "admin_manager"]
                and verify_password(str(password), user.hashed_password)
            ):
                request.session.update({"admin_token": settings.SECRET_KEY})
                return True
        finally:
            db.close()
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("admin_token")
        return token == settings.SECRET_KEY


TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")

authentication_backend = AdminAuth(secret_key=settings.SECRET_KEY)
admin = Admin(
    app,
    engine,
    title="E-Schola Pro Admin",
    templates_dir=TEMPLATES_DIR,
    authentication_backend=authentication_backend,
)
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


@app.get("/api/v1/debug-users")
def debug_users():
    from app.core.config import settings
    from app.db.database import SessionLocal
    from app.models.user import User

    db = SessionLocal()
    try:
        users = db.query(User).all()
        user_list = [{"email": u.email, "role": u.role} for u in users]
        return {"database_url": settings.DATABASE_URL, "users": user_list}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"message": "Welcome to E-Schola Pro API"}


# Mount uploads directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
