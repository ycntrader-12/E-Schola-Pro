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
    ClassroomInvitationAdmin,
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
    TaskAdmin,
    TaskSubmissionAdmin,
    UserAdmin,
)
from app.api.main import api_router
from app.core.config import is_in_railway, is_production, settings
from app.core.security import verify_password
from app.db.base import Base
from app.db.database import engine
import app.models  # noqa: F401 - Garantit que tous les modèles ORM sont enregistrés dans Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Cycle de vie de l'application FastAPI (Démarrage et Arrêt).
    Garantit une persistance stricte des données :
    - AUCUNE suppression ni vidage de table au démarrage (Base.metadata.drop_all est formellement banni).
    - Exécute Base.metadata.create_all(bind=engine) pour créer uniquement les tables manquantes (checkfirst=True).
    - Préserve l'intégralité des données existantes à chaque redémarrage.
    """
    dialect = engine.dialect.name
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[Database Health] Connexion vérifiée avec succès sur le moteur : {dialect}")
    except Exception as db_err:
        print(f"[Database Warning] Note de vérification de connectivité : {db_err}")

    # Création sécurisée et non destructive des tables manquantes uniquement
    # SQLAlchemy create_all vérifie l'existence des tables (checkfirst=True par défaut)
    # et n'altère, ne vide ni ne supprime jamais les tables et données existantes.
    try:
        Base.metadata.create_all(bind=engine)
        print(
            f"[Database Persistence] Vérification et création des tables manquantes effectuée (moteur: {dialect}). "
            "Données existantes 100% préservées (aucun drop_all, aucun vidage)."
        )
        from app.db.database import SessionLocal
        from app.db.init_db import init_db
        with SessionLocal() as db_session:
            init_db(db_session)

        # Safe non-destructive column check for quizzes.target_group
        with engine.connect() as conn:
            try:
                if dialect == "sqlite":
                    cols = [row[1] for row in conn.execute(text("PRAGMA table_info(quizzes)")).fetchall()]
                    if cols and "target_group" not in cols:
                        conn.execute(text("ALTER TABLE quizzes ADD COLUMN target_group VARCHAR DEFAULT 'all'"))
                        conn.commit()
                        print("[Database Migration] Colonne target_group ajoutée avec succès sur la table quizzes.")
                elif dialect == "postgresql":
                    conn.execute(text("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS target_group VARCHAR DEFAULT 'all'"))
                    conn.commit()
            except Exception as mig_err:
                print(f"[Database Migration Notice] {mig_err}")
    except Exception as e:
        print(f"[Database Notice] Note d'initialisation des métadonnées/comptes : {e}")

    yield
    print("[FastAPI Lifespan] Arrêt propre de l'application.")


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
admin.add_view(ClassroomInvitationAdmin)
admin.add_view(MessageAdmin)
admin.add_view(EventAdmin)
admin.add_view(EventDeliverableAdmin)
admin.add_view(QuizAdmin)
admin.add_view(QuizQuestionAdmin)
admin.add_view(QuizAttemptAdmin)
admin.add_view(AttendanceAdmin)
admin.add_view(GroupAdmin)
admin.add_view(GroupMemberAdmin)
admin.add_view(TaskAdmin)
admin.add_view(TaskSubmissionAdmin)


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
