import os
import socket
from pathlib import Path
from typing import Any
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def is_in_railway() -> bool:
    """Detects if code is executing inside Railway cloud infrastructure."""
    return bool(
        os.getenv("RAILWAY_ENVIRONMENT")
        or os.getenv("RAILWAY_ENVIRONMENT_ID")
        or os.getenv("RAILWAY_PROJECT_ID")
        or os.getenv("RAILWAY_SERVICE_ID")
        or os.getenv("RAILWAY_PRIVATE_DOMAIN")
        or os.getenv("RAILWAY_PUBLIC_DOMAIN")
    )


def is_production() -> bool:
    """Detects if app is in production mode (Railway cloud or explicit PRODUCTION env)."""
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").strip().lower()
    return is_in_railway() or env in ["production", "prod"]


def expand_railway_template_variables(url: str) -> str:
    """
    Expands Railway template tokens like ${{PGUSER}}, ${{POSTGRES_PASSWORD}}, ${{RAILWAY_PRIVATE_DOMAIN}}, etc.
    even if passed literally in DATABASE_URL or .env file.
    """
    if not url or ("${{" not in url and "${" not in url):
        return url

    replacements = {
        "PGUSER": os.getenv("PGUSER") or os.getenv("POSTGRES_USER") or "postgres",
        "POSTGRES_USER": os.getenv("POSTGRES_USER") or os.getenv("PGUSER") or "postgres",
        "POSTGRES_PASSWORD": os.getenv("POSTGRES_PASSWORD") or os.getenv("PGPASSWORD") or "",
        "PGPASSWORD": os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD") or "",
        "RAILWAY_PRIVATE_DOMAIN": os.getenv("RAILWAY_PRIVATE_DOMAIN") or os.getenv("PGHOST") or os.getenv("POSTGRES_HOST") or "postgres.railway.internal",
        "PGHOST": os.getenv("PGHOST") or os.getenv("RAILWAY_PRIVATE_DOMAIN") or os.getenv("POSTGRES_HOST") or "postgres.railway.internal",
        "POSTGRES_HOST": os.getenv("POSTGRES_HOST") or os.getenv("RAILWAY_PRIVATE_DOMAIN") or os.getenv("PGHOST") or "postgres.railway.internal",
        "PGDATABASE": os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or "railway",
        "POSTGRES_DB": os.getenv("POSTGRES_DB") or os.getenv("PGDATABASE") or "railway",
        "PGPORT": os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432",
        "POSTGRES_PORT": os.getenv("POSTGRES_PORT") or os.getenv("PGPORT") or "5432",
    }

    result = url
    for k, v in replacements.items():
        result = result.replace(f"${{{{ {k} }}}}", v)
        result = result.replace(f"${{{{{k}}}}}", v)
        result = result.replace(f"${{{k}}}", v)
        result = result.replace(f"${k}", v)
    return result


def is_postgres_url_resolvable(url: str) -> bool:
    if not url or ("postgresql" not in url and "postgres" not in url):
        return True
    # Fast path: railway.internal is private cloud networking and NEVER resolvable outside Railway
    if not is_in_railway() and "railway.internal" in url:
        return False
    try:
        if "@" in url:
            host_port_part = url.split("@")[-1].split("/")[0].split("?")[0]
            host = host_port_part.split(":")[0]
            # Fast 1.0s timeout to prevent freezing the server/requests on DNS failures
            orig_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(1.0)
            try:
                socket.gethostbyname(host)
                return True
            finally:
                socket.setdefaulttimeout(orig_timeout)
    except Exception:
        return False
    return True


def get_default_database_url() -> str:
    # 1. Direct environment variable (DATABASE_URL, POSTGRES_URL, DATABASE_PUBLIC_URL, or DATABASE_URL_UNPOOLED)
    for env_var in ["DATABASE_URL", "POSTGRES_URL", "DATABASE_PUBLIC_URL", "DATABASE_URL_UNPOOLED"]:
        val = os.getenv(env_var)
        if val and val.strip():
            db_val = expand_railway_template_variables(val.strip().strip("'\""))
            if db_val.startswith("postgres://"):
                return db_val.replace("postgres://", "postgresql+psycopg2://", 1)
            elif db_val.startswith("postgresql://") and not db_val.startswith("postgresql+"):
                return db_val.replace("postgresql://", "postgresql+psycopg2://", 1)
            return db_val

    # 2. Individual Railway / PostgreSQL variables (PGHOST, RAILWAY_PRIVATE_DOMAIN, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
    pghost = (
        os.getenv("RAILWAY_PRIVATE_DOMAIN")
        or os.getenv("PGHOST")
        or os.getenv("POSTGRES_HOST")
    )
    pguser = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    pgpassword = os.getenv("POSTGRES_PASSWORD") or os.getenv("PGPASSWORD", "")
    pgdatabase = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB")
    pgport = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432"
    if pghost and pguser and pgdatabase:
        auth = f"{pguser}:{pgpassword}@" if pgpassword else f"{pguser}@"
        return f"postgresql+psycopg2://{auth}{pghost}:{pgport}/{pgdatabase}"

    # 3. Railway Persistent Volume auto-detection for SQLite fallback
    railway_vol = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if railway_vol:
        vol_path = Path(railway_vol)
        vol_path.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(vol_path / 'eschola.db').as_posix()}"

    # 4. In Railway without a volume: prevent silent ephemeral SQLite fallback unless explicitly opted in
    if is_in_railway():
        allow_ephemeral = os.getenv("ALLOW_EPHEMERAL_SQLITE", "false").strip().lower() in ("true", "1", "yes")
        if not allow_ephemeral:
            print("[CRITICAL RAILWAY WARNING] Railway container detected without DATABASE_URL or persistent volume!")
            print("To prevent accidental data loss on redeployment, link a PostgreSQL database in Railway.")

    # 5. Known persistent mount directories in container
    for mount_dir in ["/data", "/app/backend/data", "/app/data"]:
        if os.path.exists(mount_dir) and os.path.isdir(mount_dir):
            return f"sqlite:///{(Path(mount_dir) / 'eschola.db').as_posix()}"

    # 6. Canonical local SQLite path anchored to backend/eschola.db
    canonical_db = BACKEND_DIR / "eschola.db"
    return f"sqlite:///{canonical_db.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Schola Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Environment & Deployment Control
    ENVIRONMENT: str = "production" if is_in_railway() else "development"
    # Seed demo accounts only in local development by default; NEVER overwrite or reseed demo data in production
    SEED_DEMO_DATA: bool = False if is_in_railway() else True
    ALLOW_EPHEMERAL_SQLITE: bool = False
    # Disable automatic ORM schema synchronization in production (Railway or explicit production env)
    AUTO_SYNC_SCHEMA: bool = False if (is_in_railway() or is_production()) else True

    # Canonical default pointing to PostgreSQL or eschola.db
    DATABASE_URL: str = get_default_database_url()

    # Cloudinary Config
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Email / SMTP Configuration
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "E-Schola Pro"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    EMAILS_ENABLED: bool = False

    model_config = SettingsConfigDict(
        env_file=[str(BACKEND_DIR / ".env"), ".env"],
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v or not str(v).strip():
            return get_default_database_url()
        v = expand_railway_template_variables(str(v).strip().strip("'\""))

        # Fallback to local SQLite ONLY when running locally (outside Railway) and Railway internal host is unresolvable
        if not is_in_railway() and "railway.internal" in v and not is_postgres_url_resolvable(v):
            print("[Database Notice] 'postgres.railway.internal' est un réseau privé Railway inaccessible hors du cloud.")
            print("                 Pour le dev local : configurez le TCP Proxy Railway (DATABASE_PUBLIC_URL) ou utilisez la base SQLite.")
            print("                 Basculement automatique sur la base SQLite locale pour garantir la stabilité.")
            canonical_db = (BACKEND_DIR / "eschola.db").resolve()
            return f"sqlite:///{canonical_db.as_posix()}"

        # Fix Railway / Supabase postgres:// prefix for SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        # Normalize relative sqlite paths to canonical backend directory
        elif v.startswith("sqlite:///./"):
            relative_filename = v[len("sqlite:///./") :]
            v = f"sqlite:///{(BACKEND_DIR / relative_filename).resolve().as_posix()}"
        elif v.startswith("sqlite:///") and not v.startswith("sqlite:////") and ":" not in v[10:14] and not v[10:].startswith("/"):
            # Relative sqlite:///eschola.db without drive letter or root
            relative_filename = v[len("sqlite:///") :]
            v = f"sqlite:///{(BACKEND_DIR / relative_filename).resolve().as_posix()}"
        return v

    @model_validator(mode="after")
    def compute_environment_defaults(self) -> "Settings":
        env = (self.ENVIRONMENT or os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").strip().lower()
        is_prod = is_in_railway() or env in ["production", "prod"]

        # If running in production mode, auto-sync schema is disabled by default
        explicit_sync_env = os.getenv("AUTO_SYNC_SCHEMA") or os.getenv("DB_AUTO_SYNC")
        if explicit_sync_env is not None and explicit_sync_env.strip() != "":
            self.AUTO_SYNC_SCHEMA = explicit_sync_env.strip().lower() in ("true", "1", "yes", "on")
        elif is_prod:
            self.AUTO_SYNC_SCHEMA = False
        return self

    @field_validator("EMAILS_ENABLED", mode="before")
    @classmethod
    def validate_emails_enabled(cls, v: Any, info: Any) -> bool:
        if v is not None and str(v).strip() != "":
            return str(v).strip().lower() in ("true", "1", "yes", "on")
        return False

    @field_validator("SMTP_FROM_EMAIL", mode="before")
    @classmethod
    def default_from_email(cls, v: str, info: Any) -> str:
        if v and str(v).strip():
            return str(v).strip()
        # Fallback to SMTP_USER if user looks like an email
        return ""


settings = Settings()

# Automatically enable EMAILS_ENABLED if SMTP_HOST and SMTP_FROM_EMAIL or SMTP_USER are provided and EMAILS_ENABLED wasn't explicitly disabled
if not settings.EMAILS_ENABLED and settings.SMTP_HOST and (settings.SMTP_USER or settings.SMTP_FROM_EMAIL):
    settings.EMAILS_ENABLED = True

