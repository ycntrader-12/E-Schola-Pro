import os
import socket
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def is_postgres_url_resolvable(url: str) -> bool:
    if not url or ("postgresql" not in url and "postgres" not in url):
        return True
    try:
        if "@" in url:
            host_port_part = url.split("@")[-1].split("/")[0].split("?")[0]
            host = host_port_part.split(":")[0]
            socket.gethostbyname(host)
            return True
    except Exception:
        return False
    return True


def get_default_database_url() -> str:
    # 1. Direct environment variable (DATABASE_URL, POSTGRES_URL, or DATABASE_PUBLIC_URL from Railway)
    for env_var in ["DATABASE_URL", "POSTGRES_URL", "DATABASE_PUBLIC_URL"]:
        val = os.getenv(env_var)
        if val and val.strip():
            db_val = val.strip().strip("'\"")
            if db_val.startswith("postgres://"):
                return db_val.replace("postgres://", "postgresql+psycopg2://", 1)
            elif db_val.startswith("postgresql://") and not db_val.startswith("postgresql+"):
                return db_val.replace("postgresql://", "postgresql+psycopg2://", 1)
            return db_val

    # 2. Individual Railway / PostgreSQL variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
    pghost = os.getenv("PGHOST")
    pguser = os.getenv("PGUSER")
    pgpassword = os.getenv("PGPASSWORD", "")
    pgdatabase = os.getenv("PGDATABASE")
    pgport = os.getenv("PGPORT", "5432")
    if pghost and pguser and pgdatabase:
        auth = f"{pguser}:{pgpassword}@" if pgpassword else f"{pguser}@"
        return f"postgresql+psycopg2://{auth}{pghost}:{pgport}/{pgdatabase}"

    # 3. Railway Persistent Volume auto-detection for SQLite fallback
    railway_vol = os.getenv("RAILWAY_VOLUME_MOUNT_PATH")
    if railway_vol:
        vol_path = Path(railway_vol)
        vol_path.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{(vol_path / 'eschola.db').as_posix()}"

    # 4. Known persistent mount directories in container
    for mount_dir in ["/data", "/app/backend/data", "/app/data"]:
        if os.path.exists(mount_dir) and os.path.isdir(mount_dir):
            return f"sqlite:///{(Path(mount_dir) / 'eschola.db').as_posix()}"

    # 5. Canonical local SQLite path anchored to backend/eschola.db
    canonical_db = BACKEND_DIR / "eschola.db"
    return f"sqlite:///{canonical_db.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "E-Schola Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Canonical default pointing to eschola.db or PostgreSQL
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
        if not v or not str(v).strip():
            return get_default_database_url()
        v = str(v).strip().strip("'\"")

        # Fallback if internal Railway host is configured on a local machine without TCP Proxy
        if "railway.internal" in v and not is_postgres_url_resolvable(v):
            print("[Database Notice] 'postgres.railway.internal' est un réseau privé Railway inaccessible hors du cloud.")
            print("                 Pour le dev local : configurez le TCP Proxy Railway (DATABASE_PUBLIC_URL) ou utilisez la base SQLite.")
            print("                 Basculement automatique sur la base SQLite locale pour garantir la stabilité.")
            canonical_db = BACKEND_DIR / "eschola.db"
            return f"sqlite:///{canonical_db.as_posix()}"

        # Fix Railway / Supabase postgres:// prefix for SQLAlchemy
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        # Normalize relative sqlite:///./ to canonical backend directory
        elif v.startswith("sqlite:///./"):
            relative_filename = v[len("sqlite:///./") :]
            v = f"sqlite:///{(BACKEND_DIR / relative_filename).as_posix()}"
        return v


settings = Settings()

