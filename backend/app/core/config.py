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
    """
    Résout l'URL de connexion PostgreSQL obligatoire.
    Lève une exception explicite si aucune variable d'environnement valide n'est détectée.
    Toute configuration de secours (fallback) vers SQLite (fichiers .db) est strictement supprimée.
    """
    # 1. Variable d'environnement directe (DATABASE_URL, POSTGRES_URL, DATABASE_PUBLIC_URL, DATABASE_URL_UNPOOLED)
    for env_var in ["DATABASE_URL", "POSTGRES_URL", "DATABASE_PUBLIC_URL", "DATABASE_URL_UNPOOLED"]:
        val = os.getenv(env_var)
        if val and val.strip():
            db_val = expand_railway_template_variables(val.strip().strip("'\""))
            if db_val.startswith("sqlite") or ".db" in db_val:
                raise ValueError(
                    f"[ERREUR CRITIQUE BASE DE DONNÉES] Configuration SQLite interdite détectée dans {env_var} ('{db_val}'). "
                    "Toutes les configurations de secours (fallbacks) vers SQLite ou des fichiers .db ont été définitivement supprimées. "
                    "Le système exige obligatoirement une connexion à la base de données PostgreSQL de production."
                )
            if db_val.startswith("postgres://"):
                return db_val.replace("postgres://", "postgresql+psycopg2://", 1)
            elif db_val.startswith("postgresql://") and not db_val.startswith("postgresql+"):
                return db_val.replace("postgresql://", "postgresql+psycopg2://", 1)
            return db_val

    # 2. Paramètres PostgreSQL individuels (PGHOST, RAILWAY_PRIVATE_DOMAIN, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
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

    # 3. Échec strict : Aucune base PostgreSQL détectée -> Exception claire
    raise ValueError(
        "\n" + "!" * 80 + "\n"
        "[ERREUR CRITIQUE CONFIGURATION] La variable d'environnement 'DATABASE_URL' n'a pas été détectée.\n"
        "Le système exige obligatoirement une connexion à la base de données PostgreSQL de production.\n"
        "Toute configuration de secours (fallback) vers une base locale SQLite (ex: sqlite:///./app.db ou fichier .db) a été définitivement supprimée.\n\n"
        "Pour corriger cette erreur :\n"
        "  - Configurez la variable d'environnement DATABASE_URL avec une URL PostgreSQL valide.\n"
        "    Exemple : DATABASE_URL=\"postgresql://postgres:motdepasse@hote:5432/nom_base\"\n"
        + "!" * 80 + "\n"
    )


class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Schola Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Environment & Deployment Control
    ENVIRONMENT: str = "production" if is_production() else "development"
    # Strictly disable artificial demo data across all environments
    SEED_DEMO_DATA: bool = False
    # Disable automatic ORM schema synchronization in production (Railway or explicit production env)
    AUTO_SYNC_SCHEMA: bool = False if is_production() else True

    # URL PostgreSQL obligatoire (validée à l'instanciation par normalize_database_url)
    DATABASE_URL: str = ""

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

        # Rejet formel de toute configuration SQLite ou fichier .db
        if v.startswith("sqlite") or ".db" in v:
            raise ValueError(
                f"[ERREUR CRITIQUE BASE DE DONNÉES] Configuration SQLite interdite détectée ('{v}'). "
                "Toute configuration de secours vers une base de données locale SQLite (fichiers .db) a été définitivement supprimée. "
                "Le système exige obligatoirement une connexion à la base de données PostgreSQL de production."
            )

        # Fix Railway / Supabase postgres:// prefix for SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not db_has_driver(v):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)

        if not v.startswith("postgresql"):
            raise ValueError(
                f"[ERREUR CRITIQUE BASE DE DONNÉES] Protocole de base de données non supporté ('{v}'). "
                "Le système exige obligatoirement une connexion PostgreSQL de production (ex: postgresql://utilisateur:motdepasse@hote:5432/nom_base)."
            )

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


