from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User


def init_db(db: Session) -> None:
    """
    Initialise les comptes administrateurs essentiels au démarrage du système
    sans jamais modifier ni effacer les données existantes.
    - Compte racine intouchable : 'admin_first' (email: admin_first@eschola.pro, mdp: Admin@1212)
    - Compte administrateur standard : 'admin' (email: admin@eschola.pro, mdp: Abc1234)
    """
    try:
        # 1. Compte racine intouchable admin_first
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
            print("[Init DB] Compte super administrateur racine 'admin_first' initialisé avec succès.")
        else:
            if admin_first.role != "admin":
                admin_first.role = "admin"
                db.commit()

        # 2. Compte administrateur standard admin
        admin_standard = (
            db.query(User)
            .filter(
                (func.lower(User.username) == "admin")
                | (func.lower(User.email) == "admin@eschola.pro")
            )
            .first()
        )
        if not admin_standard:
            admin_standard = User(
                email="admin@eschola.pro",
                username="admin",
                hashed_password=get_password_hash("Abc1234"),
                role="admin",
                nom="Administrateur",
                prenom="Système",
            )
            db.add(admin_standard)
            db.commit()
            print("[Init DB] Compte administrateur standard 'admin' initialisé avec succès.")
    except Exception as e:
        db.rollback()
        print(f"[Init DB Notice] Erreur lors de l'initialisation des administrateurs : {e}")
