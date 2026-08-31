import app.models
from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User

db = SessionLocal()
admin = db.query(User).filter(User.email == 'admin@eschola.com').first()
if admin:
    admin.hashed_password = get_password_hash('admin123')
    db.commit()
    print("Password reset successfully.")
else:
    print("Admin not found.")
db.close()
