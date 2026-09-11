import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

db_url = settings.DATABASE_URL

# 1. Validation stricte de la détection de DATABASE_URL
if not db_url or not str(db_url).strip():
    raise ValueError(
        "[ERREUR CRITIQUE BASE DE DONNÉES] Aucune variable d'environnement DATABASE_URL n'a été détectée. "
        "Le système exige obligatoirement une connexion à la base de données PostgreSQL de production."
    )

# 2. Rejet catégorique de toute tentative d'utiliser SQLite ou un fichier .db
if str(db_url).startswith("sqlite") or ".db" in str(db_url):
    raise ValueError(
        f"[ERREUR CRITIQUE BASE DE DONNÉES] Configuration SQLite interdite détectée ('{db_url}'). "
        "Toutes les configurations de secours (fallbacks) vers une base locale SQLite ont été définitivement supprimées. "
        "Le système doit se connecter obligatoirement à la base de données PostgreSQL de production."
    )

# 3. Normalisation du pilote PostgreSQL pour SQLAlchemy
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# 4. Configuration exclusive du moteur PostgreSQL avec pool résilient pour la production
connect_args = {"connect_timeout": 15}
engine = create_engine(
    db_url,
    pool_pre_ping=True,      # Reconnexion automatique en cas de rupture de socket ou d'inactivité
    pool_recycle=300,        # Recyclage des connexions toutes les 5 min (évite les timeouts pare-feu/cloud)
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
)

# Masquage des identifiants dans les logs pour la sécurité
try:
    masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
    print(f"[Database] Connecté au moteur PostgreSQL de production (hôte: {masked_url})")
except Exception:
    print("[Database] Connecté au moteur PostgreSQL de production")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


