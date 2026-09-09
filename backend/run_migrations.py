"""
E-Schola Pro - Script d'Exécution Explicite des Migrations de Base de Données
Permet d'appliquer de manière contrôlée, synchrone et idempotente les migrations
Alembic sur PostgreSQL (Railway/Cloud) ou SQLite (Développement Local).
"""
import os
import sys
import time
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.core.config import settings, is_production, is_in_railway
from app.db.database import engine
import alembic.config


def wait_for_database(max_retries: int = 30, delay_seconds: float = 2.0) -> bool:
    """Attente active de la disponibilité de la base de données."""
    dialect = engine.dialect.name
    print(f"[Migrations] Vérification de la disponibilité de la base de données ({dialect})...")
    for i in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                print(f"[Migrations] Connexion établie avec succès ({dialect}).")
                return True
        except Exception as err:
            print(f"[Migrations] En attente de la base ({i}/{max_retries}) : {err}")
            time.sleep(delay_seconds)
    print(f"[Migrations ERREUR] Impossible de joindre la base après {max_retries * delay_seconds}s.")
    return False


def apply_migrations() -> bool:
    """Applique explicitement toutes les révisions Alembic jusqu'à head."""
    print("=" * 70)
    print(f"  E-SCHOLA PRO — APPLICATION EXPLICITE DES MIGRATIONS (ALEMBIC)")
    print(f"  Environnement: {settings.ENVIRONMENT} | Moteur: {engine.dialect.name}")
    print(f"  Auto-Sync ORM désactivé en production: {not settings.AUTO_SYNC_SCHEMA or is_production()}")
    print("=" * 70)

    if not wait_for_database():
        return False

    try:
        # Run alembic upgrade head
        print("\n[Migrations] Exécution de 'alembic upgrade head'...")
        alembic_cfg_path = str(backend_dir / "alembic.ini")
        alembic_args = ["-c", alembic_cfg_path, "upgrade", "head"]
        alembic.config.main(argv=alembic_args)
        print("[Migrations] Toutes les migrations de schéma ont été appliquées avec succès !")
        return True
    except Exception as exc:
        print(f"[Migrations ERREUR CRITIQUE] Échec lors de l'application des migrations : {exc}")
        return False


if __name__ == "__main__":
    success = apply_migrations()
    sys.exit(0 if success else 1)
