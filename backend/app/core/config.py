import os
import re
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
        or os.getenv("RAILWAY_ENVIRONMENT_NAME")
        or os.getenv("RAILWAY_ENVIRONMENT_ID")
        or os.getenv("RAILWAY_PROJECT_ID")
        or os.getenv("RAILWAY_SERVICE_ID")
        or os.getenv("RAILWAY_SERVICE_NAME")
        or os.getenv("RAILWAY_DEPLOYMENT_ID")
        or os.getenv("RAILWAY_PRIVATE_DOMAIN")
        or os.getenv("RAILWAY_PUBLIC_DOMAIN")
        or os.getenv("RAILWAY_TCP_PROXY_DOMAIN")
    )


def is_production() -> bool:
    """Detects if app is in production mode (Railway cloud or explicit PRODUCTION env)."""
    env = (os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or "").strip().lower()
    return is_in_railway() or env in ["production", "prod"]


def expand_railway_template_variables(url: str) -> str:
    """
    Expands Railway template tokens like ${{PGUSER}}, ${{Postgres.DATABASE_URL}}, ${{POSTGRES_PASSWORD}}, etc.
    even if passed literally in DATABASE_URL or .env file.
    """
    if not url or ("${{" not in url and "${" not in url):
        return url

    # Extract single token if whole url is a reference like ${{Postgres.DATABASE_URL}}
    cleaned = url.strip()
    if (cleaned.startswith("${{") and cleaned.endswith("}}")) or (cleaned.startswith("${") and cleaned.endswith("}")):
        inner = cleaned.lstrip("${").rstrip("}").strip()
        # Direct lookup in environment (e.g. Postgres.DATABASE_URL, DATABASE_URL)
        if os.getenv(inner):
            return os.getenv(inner).strip().strip("'\"")
        # Suffix lookup (e.g. DATABASE_URL)
        suffix = inner.split(".")[-1]
        if os.getenv(suffix):
            return os.getenv(suffix).strip().strip("'\"")

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
        # Handle service-scoped references e.g. ${{Postgres.PGHOST}} or ${{postgresql.PGHOST}}
        for prefix in ["Postgres.", "postgres.", "PostgreSQL.", "postgresql."]:
            result = result.replace(f"${{{{ {prefix}{k} }}}}", v)
            result = result.replace(f"${{{{{prefix}{k}}}}}", v)
            result = result.replace(f"${{{prefix}{k}}}", v)
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
            # 3.0s timeout to allow DNS resolution in cloud container networking
            orig_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(3.0)
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

    # 3. Railway / Cloud Persistent Volume auto-detection for file-backed storage
    railway_vol = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if railway_vol:
        vol_path = Path(railway_vol)
        vol_path.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(vol_path / 'eschola.db').as_posix()}"

    # 4. Known persistent mount directories outside ephemeral container root
    for mount_dir in ["/data", "/app/data", "/app/backend/data"]:
        if os.path.exists(mount_dir) and os.path.isdir(mount_dir):
            return f"sqlite:///{(Path(mount_dir) / 'eschola.db').as_posix()}"

    # 5. Fail-Fast in Production (Railway or ENVIRONMENT=production) without persistent database:
    # Strictly prevent silent fallback to ephemeral container disk which destroys users on every deployment!
    if is_production():
        require_postgres = os.getenv("REQUIRE_POSTGRES_IN_RAILWAY", "true").strip().lower() in ("true", "1", "yes")
        allow_ephemeral = os.getenv("ALLOW_EPHEMERAL_SQLITE", "false").strip().lower() in ("true", "1", "yes")
        if require_postgres and not allow_ephemeral:
            raise RuntimeError(
                "\n" + "!" * 78 + "\n"
                "[ERREUR CRITIQUE PERSISTANCE — DÉPLOIEMENT BLOQUÉ]\n"
                "L'application est exécutée en environnement de PRODUCTION sans base de données permanente !\n"
                "Aucune variable DATABASE_URL (PostgreSQL) n'est configurée et aucun volume persistant n'est monté.\n"
                "L'utilisation d'une base SQLite éphémère dans le conteneur provoquerait la SUPPRESSION DE TOUS\n"
                "LES UTILISATEURS et données au prochain déploiement.\n\n"
                "Pour résoudre cette erreur :\n"
                "1. Si vous utilisez PostgreSQL (Recommandé) : dans le tableau de bord Railway/Cloud, configurez la variable :\n"
                "   DATABASE_URL = ${{Postgres.DATABASE_URL}}\n"
                "2. Si vous utilisez un volume persistant : montez-le sur /data ou /app/backend/data.\n"
                "3. Pour tests temporaires uniquement (non persistant, déconseillé) : définissez ALLOW_EPHEMERAL_SQLITE=true.\n"
                + "!" * 78 + "\n"
            )
        print(
            "\n" + "=" * 76 + "\n"
            "[AVERTISSEMENT PERSISTANCE] Démarrage en mode SQLite éphémère (ALLOW_EPHEMERAL_SQLITE=true).\n"
            "Attention : toutes les modifications d'utilisateurs seront perdues au prochain déploiement.\n"
            + "=" * 76 + "\n"
        )

    # 6. Canonical local SQLite path anchored to backend/eschola.db for local dev
    canonical_db = BACKEND_DIR / "eschola.db"
    return f"sqlite:///{canonical_db.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Schola Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Environment & Deployment Control
    ENVIRONMENT: str = "production" if is_production() else "development"
    # Strictly disable artificial demo data across all environments
    SEED_DEMO_DATA: bool = False
    ALLOW_EPHEMERAL_SQLITE: bool = False
    # Disable automatic ORM schema synchronization in production (Railway or explicit production env)
    AUTO_SYNC_SCHEMA: bool = False if is_production() else True

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

        # Fallback to local SQLite ONLY when running locally in development (strictly outside Railway and outside production)
        if not is_in_railway() and not is_production() and "railway.internal" in v and not is_postgres_url_resolvable(v):
            print("[Database Notice] 'postgres.railway.internal' est un réseau privé Railway inaccessible hors du cloud.")
            print("                 Pour le dev local : configurez le TCP Proxy Railway (DATABASE_PUBLIC_URL) ou utilisez la base SQLite.")
            print("                 Basculement automatique sur la base SQLite locale pour garantir la stabilité en développement.")
            canonical_db = (BACKEND_DIR / "eschola.db").resolve()
            return f"sqlite:///{canonical_db.as_posix()}"

        # Fix Railway / Supabase postgres:// prefix for SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not db_has_driver(v):
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

        if is_prod:
            self.ENVIRONMENT = "production"
            self.SEED_DEMO_DATA = False
            self.AUTO_SYNC_SCHEMA = False

        # If running in production mode, auto-sync schema is disabled by default
        explicit_sync_env = os.getenv("AUTO_SYNC_SCHEMA") or os.getenv("DB_AUTO_SYNC")
        if explicit_sync_env is not None and explicit_sync_env.strip() != "":
            self.AUTO_SYNC_SCHEMA = explicit_sync_env.strip().lower() in ("true", "1", "yes", "on")

        explicit_seed_env = os.getenv("SEED_DEMO_DATA")
        if explicit_seed_env is not None and explicit_seed_env.strip() != "":
            self.SEED_DEMO_DATA = explicit_seed_env.strip().lower() in ("true", "1", "yes", "on")

        return self

    @field_validator("SMTP_PORT", mode="before")
    @classmethod
    def validate_smtp_port(cls, v: Any) -> int:
        if v is not None and str(v).strip():
            try:
                return int(str(v).strip())
            except Exception:
                return 587
        return 587

    @field_validator("SMTP_TLS", "SMTP_SSL", mode="before")
    @classmethod
    def validate_smtp_bools(cls, v: Any) -> bool:
        if v is not None and str(v).strip():
            return str(v).strip().lower() in ("true", "1", "yes", "on")
        return False

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
        return ""


def db_has_driver(url: str) -> bool:
    return bool(re.match(r"^postgresql\+[a-zA-Z0-9_]+://", url))


settings = Settings()

# Automatically enable EMAILS_ENABLED if SMTP_HOST and SMTP_FROM_EMAIL or SMTP_USER are provided and EMAILS_ENABLED wasn't explicitly disabled
if not settings.EMAILS_ENABLED and settings.SMTP_HOST and (settings.SMTP_USER or settings.SMTP_FROM_EMAIL):
    settings.EMAILS_ENABLED = True


