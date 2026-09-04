import os
import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import expand_railway_template_variables
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models.user import User
from app.models.message import Message

client = TestClient(app)

print("--- 1. Testing Railway template expansion ---")
raw_railway_template = "postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}"
os.environ["PGUSER"] = "myuser"
os.environ["POSTGRES_PASSWORD"] = "mypassword"
os.environ["RAILWAY_PRIVATE_DOMAIN"] = "pg.railway.internal"
os.environ["PGDATABASE"] = "railway_db"

expanded = expand_railway_template_variables(raw_railway_template)
print("Template Input:   ", raw_railway_template)
print("Expanded Result:  ", expanded)
assert expanded == "postgresql://myuser:mypassword@pg.railway.internal:5432/railway_db", f"Unexpected expanded: {expanded}"
print("Template expansion verified successfully!\n")

print("--- 2. Testing User CRUD operations ---")
db = SessionLocal()
admin_user = db.query(User).filter(User.role == "admin").first()
assert admin_user is not None, "Admin user must exist"
token = create_access_token(subject=str(admin_user.id))
headers = {"Authorization": f"Bearer {token}"}

# Create User
test_email = "test_persistence@eschola.pro"
# Clean up if exists
existing = db.query(User).filter(User.email == test_email).first()
if existing:
    db.delete(existing)
    db.commit()

create_payload = {
    "username": "persistence.test",
    "email": test_email,
    "password": "Password123!",
    "role": "étudiant",
    "nom": "Dupont",
    "prenom": "Jean",
    "date_naissance": "1998-05-12",
    "pays": "France",
    "ville": "Paris",
    "specialisation": "Informatique",
}
resp = client.post("/api/v1/users/admin-create", headers=headers, json=create_payload)
assert resp.status_code == 200, f"Create user failed: {resp.status_code} - {resp.text}"
new_user_id = resp.json()["id"]
print(f"Created user successfully (id={new_user_id})")

# Modify User
update_payload = {
    "nom": "Dupont-Modifié",
    "ville": "Lyon",
    "specialisation": "Intelligence Artificielle",
}
resp_update = client.put(f"/api/v1/users/{new_user_id}", headers=headers, json=update_payload)
assert resp_update.status_code == 200, f"Update user failed: {resp_update.status_code} - {resp_update.text}"
assert resp_update.json()["nom"] == "Dupont-Modifié"
assert resp_update.json()["ville"] == "Lyon"
print("Modified user successfully and verified in response")

# Role Update
resp_role = client.put(f"/api/v1/users/{new_user_id}/role", headers=headers, json={"role": "stagiaire"})
assert resp_role.status_code == 200, f"Role update failed: {resp_role.status_code} - {resp_role.text}"
assert resp_role.json()["role"] == "stagiaire"
print("Updated user role to stagiaire successfully")

# Password Reset
resp_pw = client.put(f"/api/v1/users/{new_user_id}/password", headers=headers, json={"new_password": "NewSecretPassword123!"})
assert resp_pw.status_code == 200, f"Password reset failed: {resp_pw.status_code} - {resp_pw.text}"
print("Reset password successfully")

print("\n--- 3. Testing Messaging CRUD operations ---")
# Send Message from Admin to Test User
msg_payload = {
    "recipient_id": new_user_id,
    "subject": "Bienvenue sur E-Schola",
    "body": "Ceci est un message de test pour valider la messagerie.",
    "is_draft": False,
}
resp_msg = client.post("/api/v1/messages/", headers=headers, json=msg_payload)
assert resp_msg.status_code == 200, f"Send message failed: {resp_msg.status_code} - {resp_msg.text}"
msg_id = resp_msg.json()["id"]
print(f"Sent message #{msg_id} successfully")

# Star message
resp_star = client.put(f"/api/v1/messages/{msg_id}/star", headers=headers)
assert resp_star.status_code == 200, f"Star message failed: {resp_star.status_code} - {resp_star.text}"
print(f"Starred message #{msg_id} successfully")

# User token for recipient
user_token = create_access_token(subject=str(new_user_id))
user_headers = {"Authorization": f"Bearer {user_token}"}

# Recipient reads inbox
resp_inbox = client.get("/api/v1/messages/inbox", headers=user_headers)
assert resp_inbox.status_code == 200, f"Get inbox failed: {resp_inbox.status_code} - {resp_inbox.text}"
inbox_list = resp_inbox.json()
assert any(m["id"] == msg_id for m in inbox_list), "Sent message not found in recipient inbox"
print("Recipient received message in inbox successfully")

# Recipient reads message detail (marks as read)
resp_detail = client.get(f"/api/v1/messages/{msg_id}", headers=user_headers)
assert resp_detail.status_code == 200, f"Get message detail failed: {resp_detail.status_code} - {resp_detail.text}"
assert resp_detail.json()["is_read"] is True, "Message not marked as read"
print("Recipient read message and marked as read successfully")

# Recipient moves to trash
resp_trash = client.delete(f"/api/v1/messages/{msg_id}", headers=user_headers)
assert resp_trash.status_code == 200, f"Move to trash failed: {resp_trash.status_code} - {resp_trash.text}"
assert resp_trash.json()["action"] == "trash"
print("Message moved to trash successfully")

# Recipient restores from trash
resp_restore = client.put(f"/api/v1/messages/{msg_id}/restore", headers=user_headers)
assert resp_restore.status_code == 200, f"Restore message failed: {resp_restore.status_code} - {resp_restore.text}"
print("Message restored from trash successfully")

# Permanently delete message
client.delete(f"/api/v1/messages/{msg_id}", headers=user_headers) # trash
resp_perm = client.delete(f"/api/v1/messages/{msg_id}", headers=user_headers) # permanent
assert resp_perm.status_code == 200, f"Permanent delete failed: {resp_perm.status_code} - {resp_perm.text}"
assert resp_perm.json()["action"] == "permanent_delete"
print("Message permanently deleted successfully")

print("\n--- 4. Testing User Deletion with Cascade ---")
# Delete User
resp_del = client.delete(f"/api/v1/users/{new_user_id}", headers=headers)
assert resp_del.status_code == 200, f"Delete user failed: {resp_del.status_code} - {resp_del.text}"
print(f"Deleted user #{new_user_id} successfully (cascade verified)")

# Verify user no longer in DB
db.expire_all()
deleted_user = db.query(User).filter(User.id == new_user_id).first()
assert deleted_user is None, "Deleted user still found in DB"
print("Verified user is completely deleted from database")

print("\n============================================")
print("ALL RAILWAY PERSISTENCE & CRUD TESTS PASSED!")
print("============================================")
db.close()
