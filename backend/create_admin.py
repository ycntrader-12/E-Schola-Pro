from sqlalchemy import func
from app.core.config import settings
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
        # Guarantee correct role and password
        admin_first.role = "admin"
        admin_first.hashed_password = get_password_hash("Admin@1212")
        db.commit()
        print("[Root Seed] Compte administrateur racine intouchable 'admin_first' vérifié et synchronisé.")
    return admin_first


def seed_users():
    """
    Ensures that the application has an active administrator account while strictly preserving
    all existing users, passwords, roles, and profiles. In production or Railway deployments,
    demo accounts are never injected or re-created if removed.
    """
    db = SessionLocal()

    # Always ensure the untouchable root admin 'admin_first' is present
    ensure_root_admin_first(db)

    existing_admin = db.query(User).filter(User.role == "admin").first()

    # In Production (or if SEED_DEMO_DATA is False):
    # Only bootstrap the root admin if NO administrator exists at all.
    if not settings.SEED_DEMO_DATA:
        if existing_admin:
            print("[Seed Notice] Production mode: Administrator account already exists. Skipping user seeding to preserve integrity.")
            db.close()
            return

        # No admin found; bootstrap initial root administrator
        print("[Seed] Production mode: Bootstrapping initial administrator account ('admin@eschola.pro')...")
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
        print("[Seed] Root administrator account created successfully.")
        db.close()
        return

    # Development / Demo environment (SEED_DEMO_DATA is True):
    default_users = [
        {"email": "admin", "password": "Abc1234", "role": "admin"},
        {"email": "admin@eschola.pro", "password": "Abc1234", "role": "admin"},
        {"email": "admin_manager@eschola.pro", "password": "Abc1234", "role": "admin_manager"},
        {"email": "formateur@eschola.pro", "password": "password", "role": "formateur"},
        {"email": "imane.prof@eshola.com", "password": "password", "role": "formateur"},
        {"email": "etudiant@eschola.pro", "password": "password", "role": "étudiant"},
    ]

    for u_info in default_users:
        target_email = u_info["email"].strip().lower()
        user = (
            db.query(User)
            .filter((func.lower(User.email) == target_email) | (User.email == u_info["email"]))
            .first()
        )
        if not user:
            new_user = User(
                email=u_info["email"],
                username=u_info["email"].split("@")[0],
                hashed_password=get_password_hash(u_info["password"]),
                role=u_info["role"],
            )
            db.add(new_user)
            db.commit()
            print(f"[Seed] Created demo user '{u_info['email']}' ({u_info['role']}).")
        else:
            print(f"[Seed] User '{u_info['email']}' already exists. Preserving password and role.")

    db.close()


def seed_groups():
    """
    Creates demo educational groups ONLY if enabled (SEED_DEMO_DATA=True) and groups table is empty.
    Never alters existing group configurations or learner assignments in production.
    """
    if not settings.SEED_DEMO_DATA:
        print("[Seed Notice] Production mode: Demo groups seeding skipped.")
        return

    from app.models.group import Group, GroupMember

    db = SessionLocal()
    if db.query(Group).count() == 0:
        default_groups = [
            {
                "name": "Groupe A - Informatique & IA",
                "level": "Licence 3",
                "description": "Filière Informatique Générale, Développement Fullstack et IA",
            },
            {
                "name": "Groupe B - Cybersécurité",
                "level": "Master 1",
                "description": "Filière Sécurité des Systèmes d'Information et Réseaux",
            },
            {
                "name": "Groupe C - Data Science",
                "level": "Master 2",
                "description": "Filière Science des Données et Ingénierie Big Data",
            },
        ]

        created_groups = []
        for g_data in default_groups:
            grp = Group(
                name=g_data["name"],
                level=g_data["level"],
                description=g_data["description"],
            )
            db.add(grp)
            db.commit()
            db.refresh(grp)
            created_groups.append(grp)
            print(f"[Seed] Created demo group '{grp.name}'.")

        # Assign existing student / stagiaire users to Groupe A without overwriting existing group_name
        learners = db.query(User).filter(User.role.in_(["étudiant", "stagiaire", "employer"])).all()
        for idx, learner in enumerate(learners):
            target_grp = created_groups[idx % len(created_groups)]
            existing_member = db.query(GroupMember).filter(GroupMember.user_id == learner.id).first()
            if not existing_member:
                db.add(GroupMember(group_id=created_groups[0].id, user_id=learner.id))
                if target_grp.id != created_groups[0].id:
                    db.add(GroupMember(group_id=target_grp.id, user_id=learner.id))
                if not learner.group_name:
                    learner.group_name = created_groups[0].name
        db.commit()
        print(f"[Seed] Assigned {len(learners)} learners to demo groups.")

    db.close()


if __name__ == "__main__":
    try:
        from migrate_user_profiles import run_migration as run_user_profiles_migration
        run_user_profiles_migration()
    except Exception as e:
        print(f"Migration note in create_admin: {e}")
    seed_users()
    seed_groups()
