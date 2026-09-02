from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User


def seed_users():
    db = SessionLocal()
    default_users = [
        {"email": "admin", "password": "password", "role": "admin"},
        {"email": "admin@eschola.pro", "password": "password", "role": "admin"},
        {"email": "admin_manager@eschola.pro", "password": "password", "role": "admin_manager"},
        {"email": "formateur@eschola.pro", "password": "password", "role": "formateur"},
        {"email": "imane.prof@eshola.com", "password": "password", "role": "formateur"},
        {"email": "etudiant@eschola.pro", "password": "password", "role": "étudiant"},
    ]

    for u_info in default_users:
        user = db.query(User).filter(User.email == u_info["email"]).first()
        if not user:
            new_user = User(
                email=u_info["email"],
                hashed_password=get_password_hash(u_info["password"]),
                role=u_info["role"],
            )
            db.add(new_user)
            db.commit()
            print(f"Created default user '{u_info['email']}' ({u_info['role']}).")
        else:
            print(f"User '{u_info['email']}' already exists. Preserving password and role.")

    db.close()


def seed_groups():
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
            print(f"Created group '{grp.name}'.")

        # Assign existing student / stagiaire users to Groupe A (and others)
        learners = db.query(User).filter(User.role.in_(["étudiant", "stagiaire", "employer"])).all()
        for idx, learner in enumerate(learners):
            target_grp = created_groups[idx % len(created_groups)]
            # Also ensure all learners are at least in Groupe A for comprehensive tests
            db.add(GroupMember(group_id=created_groups[0].id, user_id=learner.id))
            if target_grp.id != created_groups[0].id:
                db.add(GroupMember(group_id=target_grp.id, user_id=learner.id))
            learner.group_name = created_groups[0].name
        db.commit()
        print(f"Assigned {len(learners)} learners to default groups.")

    db.close()


if __name__ == "__main__":
    seed_users()
    seed_groups()
