"""
Automated Test for Permanent User Data Persistence
Tests account creation, password modification, role change, seed idempotency across server restarts,
and SQLite WAL mode durability.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token
from app.db.database import SessionLocal, engine
from app.models.user import User
from app.models.group import Group, GroupMember
from create_admin import seed_users
from jose import jwt
from sqlalchemy import text


def test_persistence_flow():
    print("=" * 60)
    print("1. VERIFYING DATABASE CONFIGURATION & WAL MODE")
    print("=" * 60)
    print(f"DATABASE_URL configured: {settings.DATABASE_URL}")

    with engine.connect() as conn:
        if "sqlite" in str(engine.url):
            result = conn.execute(text("PRAGMA journal_mode;")).scalar()
            print(f"SQLite PRAGMA journal_mode: {result}")
            assert str(result).lower() == "wal", f"Expected WAL mode, got {result}"
            print("  -> PASSED: SQLite WAL mode is actively enabled!")
        else:
            result = conn.execute(text("SELECT version();")).scalar()
            print(f"PostgreSQL Version: {str(result)[:50]}...")
            print("  -> PASSED: PostgreSQL connection is active and responsive!")

    print("\n" + "=" * 60)
    print("2. TESTING USER ACCOUNT CREATION")
    print("=" * 60)
    test_email = "tester_permanent_persist@eschola.pro"
    initial_pass = "InitialSecret123!"
    updated_pass = "UpdatedSecret456!"

    db = SessionLocal()
    # Clean up any leftover test user
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.query(GroupMember).filter(GroupMember.user_id == existing.id).delete()
        db.delete(existing)
        db.commit()

    # Create new user
    new_user = User(
        email=test_email,
        hashed_password=get_password_hash(initial_pass),
        role="étudiant",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    user_id = new_user.id
    print(f"Created user ID {user_id}: email={new_user.email}, role={new_user.role}")

    # Check password verification
    assert verify_password(initial_pass, new_user.hashed_password), "Initial password must verify"
    print("  -> PASSED: Account created with correct password hash.")

    print("\n" + "=" * 60)
    print("3. TESTING JWT ACCESS TOKEN WITH EMBEDDED CLAIMS")
    print("=" * 60)
    token = create_access_token(subject=new_user.id, role=new_user.role, email=new_user.email)
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    print(f"Decoded token payload: {payload}")
    assert payload.get("sub") == str(new_user.id)
    assert payload.get("role") == "étudiant"
    assert payload.get("email") == test_email
    print("  -> PASSED: Token contains sub, role, and email claims for frontend sync.")

    print("\n" + "=" * 60)
    print("4. TESTING PASSWORD UPDATE")
    print("=" * 60)
    # Simulate PUT /me/password
    new_user.hashed_password = get_password_hash(updated_pass)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Close DB session to simulate disconnect
    db.close()

    # Re-open session from scratch (simulating new request / reconnect)
    db = SessionLocal()
    refreshed_user = db.query(User).filter(User.id == user_id).first()
    assert refreshed_user is not None
    assert not verify_password(initial_pass, refreshed_user.hashed_password), "Old password must fail"
    assert verify_password(updated_pass, refreshed_user.hashed_password), "New password must succeed"
    print("  -> PASSED: Password changed in database and old password rejected after session reconnect!")

    print("\n" + "=" * 60)
    print("5. TESTING ROLE UPDATE")
    print("=" * 60)
    # Simulate PUT /{id}/role (admin changing role to formateur)
    refreshed_user.role = "formateur"
    db.add(refreshed_user)
    db.commit()
    db.refresh(refreshed_user)
    db.close()

    # Re-open session and verify role
    db = SessionLocal()
    user_after_role = db.query(User).filter(User.id == user_id).first()
    assert user_after_role.role == "formateur", f"Expected formateur, got {user_after_role.role}"
    print(f"  -> PASSED: Role successfully changed to '{user_after_role.role}' in database.")

    print("\n" + "=" * 60)
    print("6. TESTING SERVER RESTART SIMULATION & SEED IDEMPOTENCY")
    print("=" * 60)
    # Also modify the default user 'etudiant@eschola.pro' password and role to test standard seed protection
    std_student = db.query(User).filter(User.email == "etudiant@eschola.pro").first()
    if std_student:
        std_student.hashed_password = get_password_hash("CustomStudentPass789!")
        std_student.role = "stagiaire"
        db.add(std_student)
        db.commit()
        db.refresh(std_student)
        print("Set custom password and role 'stagiaire' on default 'etudiant@eschola.pro'.")
    db.close()

    print("Simulating server startup: Executing seed_users()...")
    seed_users()

    # Re-open session and verify that seed_users DID NOT overwrite user modifications!
    db = SessionLocal()
    user_after_restart = db.query(User).filter(User.id == user_id).first()
    assert user_after_restart is not None, "User must still exist after seed/restart"
    assert user_after_restart.role == "formateur", f"Role was lost! Got {user_after_restart.role}"
    assert verify_password(updated_pass, user_after_restart.hashed_password), "Password was overwritten by seed!"
    print("  -> PASSED: Custom user password & role remain perfectly intact after seed_users() run!")

    if std_student:
        check_std = db.query(User).filter(User.email == "etudiant@eschola.pro").first()
        assert check_std.role == "stagiaire", f"Default account role reset! Got {check_std.role}"
        assert verify_password("CustomStudentPass789!", check_std.hashed_password), "Default account password reset!"
        print("  -> PASSED: Default account changes were NOT wiped by seed_users()!")
        # Reset back for clean state
        check_std.hashed_password = get_password_hash("password")
        check_std.role = "étudiant"
        db.add(check_std)
        db.commit()

    # Cleanup test user
    db.query(GroupMember).filter(GroupMember.user_id == user_id).delete()
    db.delete(user_after_restart)
    db.commit()
    db.close()
    print("Cleaned up temporary test user.")

    print("\n" + "=" * 60)
    print("SUCCESS: ALL PERSISTENCE AND SYNCHRONIZATION TESTS PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    test_persistence_flow()
