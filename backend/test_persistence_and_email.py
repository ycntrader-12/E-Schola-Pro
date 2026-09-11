import os
import sys
from pathlib import Path

# Ensure backend directory is in path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings, BACKEND_DIR as CFG_BACKEND_DIR
from app.db.database import SessionLocal, engine
from app.models.user import User
from app.services.email_service import (
    is_valid_email,
    send_email,
    send_welcome_email,
    test_smtp_connection,
)
from create_admin import seed_users


def test_database_url_postgresql():
    print("[TEST 1] Verifying PostgreSQL production URL resolution...")
    assert "postgresql" in settings.DATABASE_URL
    print("  -> Passed. PostgreSQL DB URL:", settings.DATABASE_URL)


def test_email_validation():
    print("[TEST 2] Verifying email address validation...")
    assert is_valid_email("admin@eschola.pro") is True
    assert is_valid_email("user.test+extra@domain.co.uk") is True
    assert is_valid_email("invalid-email") is False
    assert is_valid_email("") is False
    print("  -> Passed. Email validation works correctly.")


def test_email_mock_fallback():
    print("[TEST 3] Verifying email mock fallback in dev mode...")
    # Should safely return True and log to console without crashing
    res = send_welcome_email("test.learner@eschola.pro", "Jean Dupont", "étudiant")
    assert res is True
    diag = test_smtp_connection()
    assert "status" in diag
    print(f"  -> Passed. Diagnostic status: {diag['status']}")


def test_user_persistence_across_seed():
    print("[TEST 4] Verifying user modifications are never overwritten by seed_users()...")
    db = SessionLocal()
    
    # 1. Create or retrieve test user
    test_email = "persistence_test_user@eschola.pro"
    user = db.query(User).filter(User.email == test_email).first()
    if not user:
        from app.core.security import get_password_hash
        user = User(
            email=test_email,
            username="persistence_test",
            hashed_password=get_password_hash("Secret123!"),
            role="étudiant",
            nom="TestNom",
            prenom="TestPrenom",
            telephone="+33612345678",
            adresse="Original Address Value",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Modify user adresse
    updated_address = "Persistent Address Modified by User at runtime"
    user.adresse = updated_address
    db.commit()
    db.refresh(user)
    user_id = user.id

    # 3. Re-run seed_users() as if application restarted
    seed_users()

    # 4. Verify adresse is still the modified value
    user_reloaded = db.query(User).filter(User.id == user_id).first()
    assert user_reloaded is not None
    assert user_reloaded.adresse == updated_address
    print(f"  -> Passed. User ID {user_id} preserved adresse '{user_reloaded.adresse}' across server restarts & seeding.")
    
    # Clean up test user
    db.delete(user_reloaded)
    db.commit()
    db.close()


if __name__ == "__main__":
    print("========================================")
    print("RUNNING PERSISTENCE & EMAIL VERIFICATION")
    print("========================================")
    test_database_url_postgresql()
    test_email_validation()
    test_email_mock_fallback()
    test_user_persistence_across_seed()
    print("========================================")
    print("ALL 4 INTEGRITY TESTS PASSED CLEANLY!")
    print("========================================")
