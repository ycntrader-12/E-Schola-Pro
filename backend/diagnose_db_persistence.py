import os
import sys
import time
import socket
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

print("==================================================================")
print("  E-SCHOLA PRO — DATABASE PERSISTENCE & MUTATION DIAGNOSTIC SUITE")
print("==================================================================")

# 1. Environment & Variable Inspection
print("\n[STEP 1/5] Inspecting Environment Variables & Connection Routing...")
raw_db_url = os.getenv("DATABASE_URL", "")
db_public_url = os.getenv("DATABASE_PUBLIC_URL", "")
railway_env = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID")

print(f" - RAILWAY_ENVIRONMENT:   {'Detected (Cloud)' if railway_env else 'None (Local execution)'}")
print(f" - DATABASE_URL (raw):    {raw_db_url[:25]}... (length: {len(raw_db_url)})" if raw_db_url else " - DATABASE_URL: (not set)")
print(f" - DATABASE_PUBLIC_URL:   {'Configured' if db_public_url else 'Not set'}")

from app.core.config import settings
active_url = settings.DATABASE_URL
masked_url = active_url
if "@" in masked_url:
    parts = masked_url.split("@")
    masked_url = f"{parts[0].split('://')[0]}://*****:*****@{parts[1]}"
print(f" - Active Resolved URL:   {masked_url}")

# 2. Network / DNS Host Reachability
print("\n[STEP 2/5] Testing Host Connectivity & DNS Resolution...")
if "railway.internal" in active_url:
    print(" ! Notice: Target is 'postgres.railway.internal' (Railway Private Mesh Network).")
    try:
        host = active_url.split("@")[-1].split("/")[0].split(":")[0]
        ip = socket.gethostbyname(host)
        print(f" [OK] Host '{host}' successfully resolved to IP: {ip}")
    except Exception as dns_err:
        print(f" [X] DNS Resolution failed for '{host}': {dns_err}")
        print("   -> Running outside Railway? You must set DATABASE_PUBLIC_URL with the Railway TCP Proxy.")
elif "sqlite" in active_url:
    print(" [INFO] Active dialect is SQLite. Running local file-backed persistence.")
    sqlite_file = active_url.replace("sqlite:///", "")
    print(f" - Database file path:    {sqlite_file}")
    print(f" - File exists:           {os.path.exists(sqlite_file)}")
    print(f" - File write access:     {os.access(os.path.dirname(sqlite_file) or '.', os.W_OK)}")

# 3. Connection & Permissions Check
print("\n[STEP 3/5] Testing Engine Connection & User Permissions...")
from app.db.database import engine, SessionLocal
dialect = engine.dialect.name
print(f" - Dialect:               {dialect}")

try:
    with engine.connect() as conn:
        res = conn.execute(text("SELECT 1")).scalar()
        print(f" [OK] Basic Query Execution: Successful (Result: {res})")
        
        if dialect == "postgresql":
            # Check user table privileges
            priv_query = text("""
                SELECT 
                    has_table_privilege(current_user, 'users', 'SELECT') AS can_select,
                    has_table_privilege(current_user, 'users', 'INSERT') AS can_insert,
                    has_table_privilege(current_user, 'users', 'UPDATE') AS can_update,
                    has_table_privilege(current_user, 'users', 'DELETE') AS can_delete;
            """)
            privs = conn.execute(priv_query).mappings().first()
            print(f" [OK] PostgreSQL Permissions on 'users' table:")
            print(f"    - SELECT: {privs['can_select']}")
            print(f"    - INSERT: {privs['can_insert']}")
            print(f"    - UPDATE: {privs['can_update']}")
            print(f"    - DELETE: {privs['can_delete']}")
            
            if not all(privs.values()):
                print(" [X] WARNING: Missing necessary write permissions on 'users' table!")
except Exception as conn_err:
    print(f" [X] Database Connection / Permission Check Failed: {conn_err}")
    sys.exit(1)

# 4. End-to-End User Mutation Persistence Canary (Create -> Commit -> Query -> Update -> Commit -> Delete -> Commit)
print("\n[STEP 4/5] Executing Transactional Mutation Canary Cycle on 'User' Model...")
from app.models.user import User
from app.core.security import get_password_hash, verify_password

session = SessionLocal()
test_email = f"canary_{int(time.time())}@eschola.test"
initial_pwd = "CanaryInitialPassword123!"
updated_pwd = "CanaryUpdatedPassword456!"

try:
    # 4.1 Creation
    print(f" -> 1. Creating Canary User ({test_email})...")
    canary_user = User(
        email=test_email,
        username=f"canary_{int(time.time())}",
        hashed_password=get_password_hash(initial_pwd),
        role="etudiant",
        nom="CanaryNom",
        prenom="CanaryPrenom",
    )
    session.add(canary_user)
    session.commit()
    canary_id = canary_user.id
    print(f"    [OK] Committed to DB (Assigned ID: {canary_id})")

    # 4.2 Re-query from completely fresh session to verify physical persistence
    session.close()
    fresh_session = SessionLocal()
    persisted_user = fresh_session.query(User).filter(User.id == canary_id).first()
    assert persisted_user is not None, "FATAL: Canary user was NOT found after commit and session refresh!"
    assert verify_password(initial_pwd, persisted_user.hashed_password), "FATAL: Initial password hash mismatch!"
    print(f"    [OK] Query in fresh DB session confirmed record persistence in database.")

    # 4.3 Update (Profile + Password Change)
    print(f" -> 2. Testing Mutation Update (Profile fields + Password Change)...")
    persisted_user.nom = "CanaryNomUpdated"
    persisted_user.ville = "Casablanca"
    persisted_user.hashed_password = get_password_hash(updated_pwd)
    fresh_session.add(persisted_user)
    fresh_session.commit()
    print(f"    [OK] Committed update transaction to DB.")

    # 4.4 Verify Update in another separate session
    fresh_session.close()
    verify_session = SessionLocal()
    updated_user = verify_session.query(User).filter(User.id == canary_id).first()
    assert updated_user.nom == "CanaryNomUpdated", "FATAL: Profile update failed to persist!"
    assert updated_user.ville == "Casablanca", "FATAL: Profile city update failed to persist!"
    assert verify_password(updated_pwd, updated_user.hashed_password), "FATAL: Updated password failed to persist!"
    assert not verify_password(initial_pwd, updated_user.hashed_password), "FATAL: Old password unexpectedly accepted!"
    print(f"    [OK] Confirmed updated profile & new password hash persisted in fresh session.")

    # 4.5 Deletion
    print(f" -> 3. Testing Deletion Mutation...")
    verify_session.delete(updated_user)
    verify_session.commit()
    verify_session.close()

    # 4.6 Verify Deletion
    check_session = SessionLocal()
    deleted_check = check_session.query(User).filter(User.id == canary_id).first()
    assert deleted_check is None, "FATAL: User record remained in DB after delete commit!"
    print(f"    [OK] Confirmed deletion persisted (Record zeroed).")
    check_session.close()

    print("\n [OK] ALL TRANSACTION MUTATION CANARY TESTS PASSED SUCCESSFULLY!")

except Exception as canary_err:
    print(f"\n [X] TRANSACTION FAILURE DURING MUTATION CANARY: {canary_err}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# 5. Diagnostic Summary
print("\n[STEP 5/5] Diagnostic Summary & Verdict:")
print("------------------------------------------------------------------")
print(f" Active Database:      {dialect.upper()} ({masked_url})")
print(f" Transaction Mode:     Explicit Commit (autocommit=False)")
print(f" Write Access:         OPERATIONAL & PERSISTENT")
print(" Root Cause Checklist:")
print(" 1. If changes aren't visible in Railway Dashboard:")
print("    -> Backend is running locally on SQLite (eschola.db) because postgres.railway.internal")
print("       is private. Configure Railway TCP Proxy (DATABASE_PUBLIC_URL) for local-to-cloud sync.")
print(" 2. If changes aren't visible after container reboot on Railway:")
print("    -> Railway web service is missing DATABASE_URL variable or persistent volume.")
print(" 3. If API mutations failed silently:")
print("    -> Sub-operations now guarded with begin_nested() savepoints & rollback.")
print("==================================================================")
