"""
E-Schola Pro - Script de Synchronisation & Vérification de Base de Données
Permet de synchroniser les comptes utilisateurs entre SQLite et PostgreSQL (Railway/Cloud)
et de valider l'intégrité de toutes les opérations CRUD.
"""

import argparse
import sys
from pathlib import Path

# Add backend directory to Python path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.group import Group, GroupMember
from app.models.user import User


def get_sqlite_engine():
    sqlite_path = BACKEND_DIR / "eschola.db"
    return create_engine(f"sqlite:///{sqlite_path.as_posix()}", connect_args={"check_same_thread": False})


def check_db_connection(target_engine=None):
    from app.db.database import engine
    eng = target_engine or engine
    db_type = "PostgreSQL" if "postgresql" in str(eng.url) else "SQLite"
    try:
        with eng.connect() as conn:
            inspector = inspect(conn)
            tables = inspector.get_table_names()
            print(f"[OK] Connexion réussie à la base ({db_type}).")
            print(f"     Tables détectées ({len(tables)}) : {', '.join(tables[:8])}{'...' if len(tables) > 8 else ''}")
            return True, tables
    except Exception as e:
        print(f"[ERREUR] Échec de connexion à la base ({db_type}) : {e}")
        return False, []


def list_users(target_engine=None):
    from app.db.database import engine
    eng = target_engine or engine
    Session = sessionmaker(bind=eng)
    session = Session()
    try:
        users = session.query(User).order_by(User.id.asc()).all()
        print(f"\n--- Liste des Utilisateurs ({len(users)} trouvés) ---")
        print(f"{'ID':<5} | {'Email / Identifiant':<32} | {'Rôle':<15} | {'Nom Complet':<25}")
        print("-" * 85)
        for u in users:
            name = f"{u.prenom or ''} {u.nom or ''}".strip() or "-"
            print(f"{u.id:<5} | {u.email:<32} | {u.role:<15} | {name:<25}")
        return users
    finally:
        session.close()


def sync_sqlite_to_target(target_engine=None):
    """
    Copie tous les utilisateurs de la base SQLite locale vers la base cible (PostgreSQL).
    Préserve les mots de passe hachés, les rôles et toutes les informations de profil.
    """
    from app.db.database import engine
    dest_engine = target_engine or engine
    src_engine = get_sqlite_engine()

    print("\n--- Synchronisation SQLite -> Base Cible ---")
    
    # 1. S'assurer que les tables existent dans la base cible
    Base.metadata.create_all(bind=dest_engine)

    SrcSession = sessionmaker(bind=src_engine)
    DestSession = sessionmaker(bind=dest_engine)

    src_session = SrcSession()
    dest_session = DestSession()

    imported_count = 0
    updated_count = 0
    skipped_count = 0

    try:
        src_users = src_session.query(User).all()
        print(f"Source SQLite : {len(src_users)} utilisateurs à vérifier/synchroniser.")

        for su in src_users:
            # Recherche par email ou username
            existing = (
                dest_session.query(User)
                .filter(
                    (User.email == su.email)
                    | (User.username == su.username and su.username is not None)
                )
                .first()
            )

            if not existing:
                new_user = User(
                    username=su.username,
                    email=su.email,
                    hashed_password=su.hashed_password,
                    role=su.role,
                    nom=su.nom,
                    prenom=su.prenom,
                    date_naissance=su.date_naissance,
                    cin=su.cin,
                    telephone=su.telephone,
                    adresse=su.adresse,
                    ville=su.ville,
                    pays=su.pays,
                    departement=su.departement,
                    specialisation=su.specialisation,
                    avatar_url=su.avatar_url,
                    group_name=su.group_name,
                )
                dest_session.add(new_user)
                dest_session.commit()
                dest_session.refresh(new_user)
                print(f"[+] Créé : {su.email} ({su.role})")
                imported_count += 1
            else:
                # Met à jour les informations de profil si nécessaire
                changed = False
                for field in [
                    "nom", "prenom", "role", "hashed_password",
                    "telephone", "ville", "pays", "departement", "specialisation"
                ]:
                    src_val = getattr(su, field, None)
                    dest_val = getattr(existing, field, None)
                    if src_val and src_val != dest_val:
                        setattr(existing, field, src_val)
                        changed = True
                
                if changed:
                    dest_session.commit()
                    print(f"[*] Mis à jour : {existing.email}")
                    updated_count += 1
                else:
                    skipped_count += 1

        print(f"\nBilan : {imported_count} créés, {updated_count} mis à jour, {skipped_count} identiques.")
    finally:
        src_session.close()
        dest_session.close()


def main():
    parser = argparse.ArgumentParser(description="Synchronisation et Gestion de Base de Données E-Schola Pro")
    parser.add_argument("--check", action="store_true", help="Vérifier la connexion à la base configurée")
    parser.add_argument("--list", action="store_true", help="Lister les utilisateurs de la base configurée")
    parser.add_argument("--import-sqlite", action="store_true", help="Importer/Synchroniser les utilisateurs depuis SQLite vers PostgreSQL")
    parser.add_argument("--seed", action="store_true", help="Générer les utilisateurs et groupes par défaut")

    args = parser.parse_args()

    print(f"URL de base active : {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

    if args.check:
        check_db_connection()
    elif args.list:
        list_users()
    elif args.import_sqlite:
        sync_sqlite_to_target()
    elif args.seed:
        from create_admin import seed_groups, seed_users
        seed_users()
        seed_groups()
    else:
        # Par défaut, vérifie et liste
        ok, _ = check_db_connection()
        if ok:
            list_users()


if __name__ == "__main__":
    main()
