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
        {"email": "etudiant@eschola.pro", "password": "password", "role": "étudiant"},
    ]

    for u_info in default_users:
        user = db.query(User).filter(User.email == u_info["email"]).first()
        if user:
            user.hashed_password = get_password_hash(u_info["password"])
            user.role = u_info["role"]
            db.commit()
            print(f"Updated user '{u_info['email']}' ({u_info['role']}).")
        else:
            new_user = User(
                email=u_info["email"],
                hashed_password=get_password_hash(u_info["password"]),
                role=u_info["role"],
            )
            db.add(new_user)
            db.commit()
            print(f"Created user '{u_info['email']}' ({u_info['role']}).")

    db.close()


if __name__ == "__main__":
    seed_users()
