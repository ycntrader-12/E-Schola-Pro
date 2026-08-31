import app.models
from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User

db = SessionLocal()
email = 'admin'
password = 'Abc1234'

# Check if user exists
user = db.query(User).filter(User.email == email).first()

if user:
    # Update password and role if it already exists
    user.hashed_password = get_password_hash(password)
    user.role = 'admin'
    db.commit()
    print(f"Updated existing user '{email}' with role admin and new password.")
else:
    # Create new admin user
    new_admin = User(
        email=email,
        hashed_password=get_password_hash(password),
        role='admin'
    )
    db.add(new_admin)
    db.commit()
    print(f"Created new admin account '{email}'.")

db.close()
