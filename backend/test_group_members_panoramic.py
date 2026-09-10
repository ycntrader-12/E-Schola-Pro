from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_backend_groups():
    # 1. Login as staff (dgrh@eschola.pro)
    login_res = client.post("/api/v1/login/access-token", data={
        "username": "dgrh@eschola.pro",
        "password": "password"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Staff login OK (dgrh@eschola.pro)")

    # 2. Get available users
    avail_res = client.get("/api/v1/groups/available-users", headers=headers)
    assert avail_res.status_code == 200, f"Failed to get available users: {avail_res.text}"
    users = avail_res.json()
    assert len(users) > 0, "No available users found"
    print(f"[2] Available users fetched: {len(users)} users. Sample: {users[0]}")
    user_ids = [u["id"] for u in users[:2]]

    # 3. Create group with member_ids (Testing route without trailing slash)
    group_name = "Test Promo AI Panoramique 2026"
    create_payload = {
        "name": group_name,
        "level": "Master 2",
        "description": "Promotion d'excellence en intelligence artificielle pour test panoramique",
        "member_ids": user_ids
    }
    create_res = client.post("/api/v1/groups", json=create_payload, headers=headers)
    assert create_res.status_code == 200, f"Group creation failed: {create_res.text}"
    group_data = create_res.json()
    group_id = group_data["id"]
    print(f"[3] Group created successfully: ID {group_id}, members_count = {group_data.get('members_count')}")
    assert group_data["members_count"] == len(user_ids), f"Expected {len(user_ids)} members, got {group_data.get('members_count')}"

    # 4. Verify members list and enriched fields
    members_res = client.get(f"/api/v1/groups/{group_id}/members", headers=headers)
    assert members_res.status_code == 200, f"Get members failed: {members_res.text}"
    members = members_res.json()
    assert len(members) == len(user_ids), f"Expected {len(user_ids)} members, got {len(members)}"
    print(f"[4] Group members validated: {len(members)} members. Enriched sample: {members[0]}")
    assert "user_nom" in members[0], "user_nom missing in member response"
    assert "user_prenom" in members[0], "user_prenom missing in member response"

    # 5. Batch add another member if available
    remaining_users = [u["id"] for u in users if u["id"] not in user_ids]
    if remaining_users:
        batch_uid = [remaining_users[0]]
        batch_res = client.post(f"/api/v1/groups/{group_id}/members/batch", json={"user_ids": batch_uid}, headers=headers)
        assert batch_res.status_code == 200, f"Batch add failed: {batch_res.text}"
        batch_data = batch_res.json()
        print(f"[5] Batch add OK: {batch_data}")
        assert batch_data["added_count"] == 1

    # 6. Test GET /groups and GET /groups/
    get_res1 = client.get("/api/v1/groups", headers=headers)
    assert get_res1.status_code == 200
    get_res2 = client.get("/api/v1/groups/", headers=headers)
    assert get_res2.status_code == 200
    print("[6] Both /groups and /groups/ return 200 OK without 307 redirect")

    # 7. Clean up test group
    del_res = client.delete(f"/api/v1/groups/{group_id}", headers=headers)
    assert del_res.status_code == 200, f"Delete group failed: {del_res.text}"
    print(f"[7] Test group {group_id} cleaned up successfully")

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    test_backend_groups()
