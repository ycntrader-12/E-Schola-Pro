import sys
from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User

new_password = sys.argv[1] if len(sys.argv) > 1 else "Abc1234"
db = SessionLocal()

target_emails = ["admin", "admin@eschola.pro", "admin@eschola.com"]
admins = db.query(User).filter(
    (User.role.like("%admin%")) | (User.email.in_(target_emails))
).all()

if admins:
    for admin in admins:
        admin.hashed_password = get_password_hash(new_password)
        print(f"Password for '{admin.email}' (role: {admin.role}) reset to: {new_password}")
    db.commit()
    print("All admin accounts updated successfully.")
else:
    new_admin = User(
        email="admin",
        hashed_password=get_password_hash(new_password),
        role="admin",
    )
    db.add(new_admin)
    db.commit()
    print(f"Created default admin account 'admin' with password: {new_password}")

db.close()

