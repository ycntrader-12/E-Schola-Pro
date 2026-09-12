import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings, is_production

db_url = settings.DATABASE_URL

if not db_url or not str(db_url).strip():
    raise ValueError(
        "[ERREUR CRITIQUE BASE DE DONNÉES] Aucune variable d'environnement DATABASE_URL n'a été détectée."
    )

if str(db_url).startswith("sqlite"):
    if is_production():
        raise ValueError(
            "[ERREUR CRITIQUE BASE DE DONNÉES] Configuration SQLite interdite en production Railway."
        )
    connect_args = {"check_same_thread": False}
    engine = create_engine(
        db_url,
        connect_args=connect_args,
    )
    print(f"[Database] Connecté au moteur SQLite local ({db_url})")
else:
    # Normalisation du pilote PostgreSQL pour SQLAlchemy
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    connect_args = {"connect_timeout": 15}
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        connect_args=connect_args,
    )
    try:
        masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
        print(f"[Database] Connecté au moteur PostgreSQL de production (hôte: {masked_url})")
    except Exception:
        print("[Database] Connecté au moteur PostgreSQL de production")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


