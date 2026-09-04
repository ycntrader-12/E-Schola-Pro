import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False, "timeout": 30}
    # Ensure parent directory of SQLite db file exists
    raw_path = db_url.replace("sqlite:///", "").split("?")[0]
    # On Windows, raw_path can be 'D:/...' or '/app/...' on Linux
    parent_dir = os.path.dirname(raw_path)
    if parent_dir and not os.path.exists(parent_dir):
        try:
            os.makedirs(parent_dir, exist_ok=True)
        except Exception:
            pass

    engine = create_engine(db_url, connect_args=connect_args)

    # SQLite durability and concurrency configuration (WAL Mode)
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
        except Exception:
            pass

    print(f"[Database] Connected using SQLite engine: {raw_path}")
else:
    # PostgreSQL Configuration with resilient pool settings for Railway / Cloud
    connect_args = {"connect_timeout": 15}
    engine = create_engine(
        db_url,
        pool_pre_ping=True,      # Automatically reconnects dropped or idle connections
        pool_recycle=300,        # Recycle connections every 5 minutes to prevent stale TCP sockets
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )
    # Mask password for safe logging
    try:
        masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
        print(f"[Database] Connected using PostgreSQL engine (host: {masked_url})")
    except Exception:
        print("[Database] Connected using PostgreSQL engine")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

