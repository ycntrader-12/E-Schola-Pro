import os
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def get_default_database_url() -> str:
    # 1. Environment variable if provided
    env_db = os.getenv("DATABASE_URL")
    if env_db:
        if env_db.startswith("postgres://"):
            return env_db.replace("postgres://", "postgresql://", 1)
        return env_db

    # 2. Railway Persistent Volume auto-detection
    railway_vol = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if railway_vol:
        vol_path = Path(railway_vol)
        vol_path.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{ (vol_path / 'eschola.db').as_posix() }"

    # 3. Known persistent mount directories in container
    for mount_dir in ["/data", "/app/backend/data", "/app/data"]:
        if os.path.exists(mount_dir) and os.path.isdir(mount_dir):
            return f"sqlite:///{ (Path(mount_dir) / 'eschola.db').as_posix() }"

    # 4. Canonical local SQLite path anchored to backend/eschola.db
    canonical_db = BACKEND_DIR / "eschola.db"
    return f"sqlite:///{canonical_db.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Schola Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Canonical default pointing to eschola.db
    DATABASE_URL: str = get_default_database_url()

    # Cloudinary Config
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    model_config = SettingsConfigDict(
        env_file=[str(BACKEND_DIR / ".env"), ".env"],
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if not v:
            return get_default_database_url()
        # Fix Railway / Supabase postgres:// prefix for SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        # Normalize relative sqlite:///./ to canonical backend directory
        elif v.startswith("sqlite:///./"):
            relative_filename = v[len("sqlite:///./") :]
            v = f"sqlite:///{(BACKEND_DIR / relative_filename).as_posix()}"
        return v


settings = Settings()

