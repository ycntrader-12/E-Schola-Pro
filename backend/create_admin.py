from sqlalchemy import func
from app.core.config import is_production, settings
from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User


def ensure_root_admin_first(db):
    """
    Creates and guarantees the protected immutable root administrator 'admin_first'
    with password 'Admin@1212' across both development and production.
    """
    admin_first = (
        db.query(User)
        .filter(
            (func.lower(User.username) == "admin_first")
            | (func.lower(User.email) == "admin_first@eschola.pro")
        )
        .first()
    )
    if not admin_first:
        admin_first = User(
            email="admin_first@eschola.pro",
            username="admin_first",
            hashed_password=get_password_hash("Admin@1212"),
            role="admin",
            nom="Root",
            prenom="Admin First",
        )
        db.add(admin_first)
        db.commit()
        db.refresh(admin_first)
        print("[Root Seed] Compte administrateur racine intouchable 'admin_first' créé avec succès.")
    else:
        # Guarantee correct role without overwriting existing customized password
        if admin_first.role != "admin":
            admin_first.role = "admin"
            db.commit()
        print("[Root Seed] Compte administrateur racine intouchable 'admin_first' vérifié (mot de passe existant préservé).")
    return admin_first


def seed_users():
    """
    Ensures that the application has the essential root administrator accounts
    ('admin_first' and 'admin@eschola.pro') while strictly never injecting
    any artificial demo/dummy users.
    """
    db = SessionLocal()

    # 1. Always ensure the untouchable root admin 'admin_first' is present
    ensure_root_admin_first(db)

    # 2. If no generic administrator account exists at all, bootstrap initial admin
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if not existing_admin:
        print("[Bootstrap] Initializing primary administrator account ('admin@eschola.pro')...")
        new_admin = User(
            email="admin@eschola.pro",
            username="admin",
            hashed_password=get_password_hash("Abc1234"),
            role="admin",
            nom="Administrateur",
            prenom="Système",
        )
        db.add(new_admin)
        db.commit()
        print("[Bootstrap] Primary administrator account created successfully.")
    else:
        print("[Bootstrap] Administrator account already verified. No demo data injected.")

    db.close()


def seed_groups():
    """
    No demo groups are injected into the application. Real educational groups and promotions
    are created organically by authorized staff and administrators through the platform.
    """
    return


if __name__ == "__main__":
    try:
        from migrate_user_profiles import run_migration as run_user_profiles_migration
        run_user_profiles_migration()
    except Exception as e:
        print(f"Migration note in create_admin: {e}")
    seed_users()
    seed_groups()
