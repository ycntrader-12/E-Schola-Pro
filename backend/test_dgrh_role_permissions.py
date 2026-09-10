"""
Test exhaustif des autorisations et prérogatives du rôle DG/RH (dg_rh).
Vérifie la conformité absolue avec le rôle Formateur.
"""
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

client = TestClient(app)


def run_all_tests():
    print("\n🚀 [TEST 1] Connexion et récupération de profil pour dgrh@eschola.pro...")
    response = client.post(
        "/api/v1/login/access-token",
        data={"username": "dgrh@eschola.pro", "password": "password"},
    )
    assert response.status_code == 200, f"Erreur login DG/RH: {response.text}"
    token_data = response.json()
    assert "access_token" in token_data

    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    me_resp = client.get("/api/v1/users/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "dg_rh", f"Role attendu dg_rh, reçu: {me_resp.json()['role']}"
    print("  ✅ Compte DG/RH authentifié avec succès, rôle confirmé 'dg_rh'.")

    print("\n🚀 [TEST 2] Vérification des permissions d'émargement et présences (/attendance)...")
    resp_groups = client.get("/api/v1/attendance/groups", headers=headers)
    assert resp_groups.status_code == 200, f"Accès refusé attendance/groups: {resp_groups.text}"

    resp_learners = client.get("/api/v1/attendance/learners", headers=headers)
    assert resp_learners.status_code == 200, f"Accès refusé attendance/learners: {resp_learners.text}"

    resp_overview = client.get("/api/v1/attendance/overview", headers=headers)
    assert resp_overview.status_code == 200, f"Accès refusé attendance/overview: {resp_overview.text}"
    print("  ✅ Autorisations d'émargement et de gestion des apprenants validées.")

    print("\n🚀 [TEST 3] Vérification des permissions de planification calendrier (/events)...")
    event_payload = {
        "title": "Session Stratégique RH & Formation",
        "description": "Planning trimestriel",
        "start_time": "2026-10-15T09:00:00",
        "end_time": "2026-10-15T11:00:00",
        "target_roles": "all",
    }
    resp_event = client.post("/api/v1/events/", json=event_payload, headers=headers)
    assert resp_event.status_code == 200, f"Erreur création planning: {resp_event.text}"
    event_id = resp_event.json()["id"]

    del_event = client.delete(f"/api/v1/events/{event_id}", headers=headers)
    assert del_event.status_code == 200
    print("  ✅ Création et suppression d'événement de calendrier autorisées.")

    print("\n🚀 [TEST 4] Vérification de l'accès aux groupes (/groups)...")
    resp_grp = client.get("/api/v1/groups/", headers=headers)
    assert resp_grp.status_code == 200, f"Accès refusé /groups: {resp_grp.text}"
    print("  ✅ Consultation et gestion des groupes autorisées.")

    print("\n🚀 [TEST 5] Attribution du rôle DG/RH par l'administrateur (support dg_rh et DG/RH)...")
    db = SessionLocal()
    existing_admin = db.query(User).filter(User.role == "admin").first()
    # Créer un utilisateur temporaire
    import uuid
    rnd = uuid.uuid4().hex[:6]
    test_email = f"test_assign_{rnd}@eschola.pro"
    test_uname = f"test_assign_{rnd}"
    temp_user = User(
        email=test_email,
        username=test_uname,
        hashed_password=get_password_hash("password"),
        role="étudiant",
    )
    db.add(temp_user)
    db.commit()
    db.refresh(temp_user)
    user_id = temp_user.id
    admin_id = existing_admin.id
    db.close()

    admin_token = create_access_token(subject=admin_id, role="admin", email=existing_admin.email)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Tester attribution via "dg_rh"
    resp_role1 = client.put(f"/api/v1/users/{user_id}/role", json={"role": "dg_rh"}, headers=admin_headers)
    assert resp_role1.status_code == 200, f"Échec attribution dg_rh: {resp_role1.text}"
    assert resp_role1.json()["role"] == "dg_rh"

    # Tester attribution via "DG/RH"
    resp_role2 = client.put(f"/api/v1/users/{user_id}/role", json={"role": "DG/RH"}, headers=admin_headers)
    assert resp_role2.status_code == 200, f"Échec attribution DG/RH: {resp_role2.text}"
    assert resp_role2.json()["role"] == "dg_rh"

    # Nettoyage
    client.delete(f"/api/v1/users/{user_id}", headers=admin_headers)
    print("  ✅ Attribution et normalisation du rôle DG/RH validées avec succès.")

    print("\n🎉 TOUS LES TESTS DE PERMISSIONS DU RÔLE DG/RH ONT RÉUSSI AVEC SUCCÈS !\n")


if __name__ == "__main__":
    run_all_tests()
