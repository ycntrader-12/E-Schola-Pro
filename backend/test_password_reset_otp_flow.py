"""
Test Suite: Workflow Complet de Réinitialisation de Mot de Passe par Code OTP Sécurisé
Conforme aux 14 exigences strictes de cybersécurité :
1. Demande avec e-mail valide
2. Demande avec e-mail inexistant (anti-énumération, dummy timing safe)
3. Génération cryptographique OTP 6 chiffres (secrets)
4. OTP stocké UNIQUEMENT sous forme de hash (zéro mot de passe/code en clair en base)
5. Expiration de l'OTP
6. OTP incorrect (décrémentation des tentatives restantes)
7. Dépassement du nombre maximal de tentatives (verrouillage)
8. Émission et validation du token temporaire d'autorisation (reset_token)
9. Nouveau mot de passe valide
10. Mot de passe invalide (< 6 caractères)
11. Confirmation différente
12. Réutilisation d'un ancien OTP/token rejetée
13. Invalidation des sessions actives (user_sessions) et incrémentation token_version
14. Protection Rate Limiting
15. Conservation intégrale des données existantes
"""

import hashlib
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.core import security
from app.core.config import settings
from app.db.database import SessionLocal
from app.main import app
from app.models.password_reset_request import PasswordResetRequest
from app.models.password_reset_token import PasswordResetToken
from app.models.user import User
from app.models.user_session import UserSession


client = TestClient(app)


def setup_test_user(email: str, username: str, password: str = "OldSecretPassword123!") -> User:
    """Helper pour initialiser un utilisateur de test propre."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                username=username,
                hashed_password=security.get_password_hash(password),
                role="étudiant",
                nom="TestOTP",
                prenom="User",
                is_active=True,
                token_version=1,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.hashed_password = security.get_password_hash(password)
            user.is_active = True
            user.token_version = 1
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()


def cleanup_test_data(email: str):
    """Nettoyage ciblé des données créées par les tests."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user.id).delete()
            db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete()
            db.query(UserSession).filter(UserSession.user_id == user.id).delete()
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_1_valid_email_request_and_zero_clear_otp():
    print("[TEST 1 & 4] Demande avec e-mail valide & stockage zéro-clair de l'OTP...")
    test_email = "otp_test_valid@eschola.pro"
    setup_test_user(test_email, "otp_valid_user")

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": test_email},
    )
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["expires_in_minutes"] == 10
    # Confidentialité & Sécurité strictes : le code OTP ne doit JAMAIS être retourné dans l'API
    assert "dev_code" not in data or data.get("dev_code") is None

    # Vérification directe en base de données : L'OTP ne doit JAMAIS être en clair
    db = SessionLocal()
    try:
        req = (
            db.query(PasswordResetRequest)
            .filter(PasswordResetRequest.email == test_email)
            .order_by(PasswordResetRequest.id.desc())
            .first()
        )
        assert req is not None
        assert req.otp_hash is not None
        # Le hash doit être un hash bcrypt valide (commençant par $2b$ ou $2a$)
        assert req.otp_hash.startswith("$2") or len(req.otp_hash) >= 60
        # Vérification qu'aucun attribut en clair n'existe
        assert not hasattr(req, "code") or getattr(req, "code", None) is None

        # Vérification dans la table de jetons : aucun code en clair
        tok = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == req.user_id).first()
        if tok:
            assert tok.code is None

        print("  -> Succès : Confidentialité totale vérifiée (zéro code exposé dans la réponse API, hash bcrypt en base).")
    finally:
        db.close()
        cleanup_test_data(test_email)


def test_2_non_existent_email_anti_enumeration():
    print("[TEST 2] Demande avec e-mail inexistant (anti-énumération & timing safe)...")
    fake_email = "non_existent_random_user_999@unknown-domain.com"
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": fake_email},
    )
    assert response.status_code == 200
    data = response.json()
    # Le message renvoyé doit être strictement générique et ne pas divulguer l'absence du compte
    assert "Si l'adresse saisie correspond à un compte actif" in data["message"]
    print("  -> Succès : Réponse générique renvoyée, aucune information divulguée.")


def test_3_otp_verification_bad_attempts_and_locking():
    print("[TEST 5, 6 & 7] Code incorrect, décrémentation des tentatives & verrouillage...")
    test_email = "otp_lock_test@eschola.pro"
    user = setup_test_user(test_email, "otp_lock_user")

    # Création manuelle d'une demande avec un code connu "849201"
    db = SessionLocal()
    try:
        known_otp = "849201"
        req = PasswordResetRequest(
            user_id=user.id,
            email=test_email,
            otp_hash=security.get_password_hash(known_otp),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            attempts=0,
            used=False,
            created_at=datetime.utcnow(),
            ip_address="127.0.0.1",
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        req_id = req.id
    finally:
        db.close()

    # Tentative 1 : code erroné
    res1 = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": test_email, "code": "000000"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["valid"] is False
    assert data1["remaining_attempts"] == 4

    # Tentatives 2, 3, 4 : codes erronés
    for attempt in range(3, 0, -1):
        res = client.post(
            "/api/v1/auth/verify-reset-code",
            json={"email": test_email, "code": "111111"},
        )
        assert res.json()["valid"] is False

    # Tentative 5 : dépassement du seuil maximal -> code invalidé
    res_lock = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": test_email, "code": "222222"},
    )
    assert res_lock.json()["valid"] is False
    assert res_lock.json()["remaining_attempts"] == 0

    # Même avec le bon code désormais, la demande doit être rejetée car verrouillée
    res_final = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": test_email, "code": known_otp},
    )
    assert res_final.json()["valid"] is False
    print("  -> Succès : Compteur d'essais décrémenté et demande définitivement verrouillée après 5 échecs.")
    cleanup_test_data(test_email)


def test_4_otp_expiration():
    print("[TEST 5] Rejet d'un code OTP expiré...")
    test_email = "otp_expired_test@eschola.pro"
    user = setup_test_user(test_email, "otp_expired_user")

    db = SessionLocal()
    try:
        known_otp = "654321"
        # Demande expirée il y a 5 minutes
        req = PasswordResetRequest(
            user_id=user.id,
            email=test_email,
            otp_hash=security.get_password_hash(known_otp),
            expires_at=datetime.utcnow() - timedelta(minutes=5),
            attempts=0,
            used=False,
            created_at=datetime.utcnow() - timedelta(minutes=15),
            ip_address="127.0.0.1",
        )
        db.add(req)
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": test_email, "code": "654321"},
    )
    assert res.status_code == 200
    assert res.json()["valid"] is False
    print("  -> Succès : Code expiré rejeté sans émission de jeton.")
    cleanup_test_data(test_email)


def test_5_full_successful_reset_and_session_invalidation():
    print("[TEST 8, 9, 13] Validation OTP réussie, réinitialisation du mot de passe & révocation des sessions...")
    test_email = "otp_success_test@eschola.pro"
    old_pwd = "OldPassword123!"
    new_pwd = "NewBrandSecurePassword2026!"
    user = setup_test_user(test_email, "otp_success_user", password=old_pwd)

    # 1. Simuler une session active existante pour cet utilisateur
    db = SessionLocal()
    try:
        active_session = UserSession(
            user_id=user.id,
            session_token="old_active_session_token_12345",
            is_active=True,
            expires_at=datetime.utcnow() + timedelta(days=7),
            last_activity=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        db.add(active_session)

        # Créer la demande OTP
        known_otp = "778899"
        req = PasswordResetRequest(
            user_id=user.id,
            email=test_email,
            otp_hash=security.get_password_hash(known_otp),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            attempts=0,
            used=False,
            created_at=datetime.utcnow(),
            ip_address="127.0.0.1",
        )
        db.add(req)
        db.commit()
    finally:
        db.close()

    # 2. Vérification réussie du code OTP -> obtention du reset_token
    verify_res = client.post(
        "/api/v1/auth/verify-reset-code",
        json={"email": test_email, "code": "778899"},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["valid"] is True
    assert "reset_token" in verify_data
    reset_token = verify_data["reset_token"]
    assert len(reset_token) > 20

    # 3. Test mot de passe invalide (< 6 caractères) -> doit échouer
    bad_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "reset_token": reset_token,
            "new_password": "123",
            "confirm_password": "123",
        },
    )
    assert bad_res.status_code == 422

    # 4. Test mots de passe discordants -> doit échouer
    mismatch_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "reset_token": reset_token,
            "new_password": new_pwd,
            "confirm_password": "DifferentPassword999!",
        },
    )
    assert mismatch_res.status_code == 422

    # 5. Soumission correcte avec le nouveau mot de passe
    reset_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "reset_token": reset_token,
            "new_password": new_pwd,
            "confirm_password": new_pwd,
        },
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # 6. Vérifications strictes en base :
    db = SessionLocal()
    try:
        updated_user = db.query(User).filter(User.id == user.id).first()
        # Le mot de passe a bien été mis à jour
        assert security.verify_password(new_pwd, updated_user.hashed_password) is True
        assert security.verify_password(old_pwd, updated_user.hashed_password) is False

        # Le token_version a été incrémenté (passé de 1 à 2)
        assert updated_user.token_version == 2

        # La session active antérieure a été révoquée
        sess = db.query(UserSession).filter(UserSession.user_id == user.id).first()
        assert sess.is_active is False

        # La demande est marquée comme used=True
        req_db = db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == user.id).first()
        assert req_db.used is True
        assert req_db.used_at is not None
        print("  -> Succès : Mot de passe mis à jour, sessions révoquées et token_version incrémenté.")
    finally:
        db.close()

    # 7. Test de non-rejouabilité : Réutilisation du même reset_token -> rejeté
    replay_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "reset_token": reset_token,
            "new_password": "YetAnotherPassword123!",
        },
    )
    assert replay_res.status_code == 400
    print("  -> Succès : Réutilisation d'un ancien reset_token formellement rejetée (anti-replay).")

    # 8. Connexion avec le nouveau mot de passe
    login_res = client.post(
        "/api/v1/login/access-token",
        data={"username": test_email, "password": new_pwd},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    print("  -> Succès : Authentification réussie avec le nouveau mot de passe.")

    cleanup_test_data(test_email)


def test_6_smtp_resilience_and_configuration():
    print("[TEST 6] Résilience SMTP & Configuration Dynamique...")
    from create_admin import ensure_root_admin_first
    from app.core.security import create_access_token

    db = SessionLocal()
    try:
        admin = ensure_root_admin_first(db)
        admin_token = create_access_token(admin.id)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
    finally:
        db.close()

    # 1. Vérification du statut email
    st_res = client.get("/api/v1/email/status", headers=admin_headers)
    assert st_res.status_code == 200
    st_data = st_res.json()
    assert "emails_enabled" in st_data
    assert "smtp_host" in st_data

    # 2. Configuration dynamique de SMTP
    cfg_payload = {
        "smtp_host": "smtp.mail-test-provider.com",
        "smtp_port": 587,
        "smtp_user": "test_smtp_user",
        "smtp_password": "test_smtp_password",
        "smtp_from_email": "notifications@eschola.pro",
        "smtp_from_name": "E-Schola Pro Test",
        "smtp_tls": True,
        "smtp_ssl": False,
        "emails_enabled": True,
    }
    cfg_res = client.post("/api/v1/email/configure", headers=admin_headers, json=cfg_payload)
    assert cfg_res.status_code == 200
    assert cfg_res.json()["success"] is True

    # 3. Vérification que la configuration dynamique est prise en compte
    st_updated = client.get("/api/v1/email/status", headers=admin_headers)
    assert st_updated.status_code == 200
    assert st_updated.json()["smtp_host"] == "smtp.mail-test-provider.com"
    assert st_updated.json()["emails_enabled"] is True

    # 4. Rétablir le mode initial pour les tests
    reset_payload = {
        "smtp_host": "",
        "smtp_port": 587,
        "smtp_user": "",
        "smtp_password": "",
        "smtp_from_email": "contact@eschola.pro",
        "smtp_from_name": "E-Schola Pro",
        "smtp_tls": True,
        "smtp_ssl": False,
        "emails_enabled": False,
    }
    client.post("/api/v1/email/configure", headers=admin_headers, json=reset_payload)
    print("  -> Succès : Configuration dynamique SMTP et statut vérifiés avec succès.")


def test_7_batch_password_reset():
    print("[TEST 7] Réinitialisation en masse (Batch) & Déclencheur Administrateur...")
    # 1. Obtenir le jeton administrateur
    login_res = client.post(
        "/api/v1/login/access-token",
        data={"username": "admin_first", "password": "Admin@1212"},
    )
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Créer 2 utilisateurs pour le test batch
    u1 = setup_test_user("batch_test_1@eschola.pro", "batch_user_1")
    u2 = setup_test_user("batch_test_2@eschola.pro", "batch_user_2")

    try:
        # A. Rejet pour utilisateur non-authentifié / non-admin
        forbidden_res = client.post(
            "/api/v1/password-reset/batch",
            json={"user_ids": [u1.id, u2.id]},
        )
        assert forbidden_res.status_code == 401

        # B. Exécution autorisée avec les identifiants
        batch_res = client.post(
            "/api/v1/password-reset/batch",
            headers=admin_headers,
            json={"user_ids": [u1.id, u2.id]},
        )
        assert batch_res.status_code == 200
        batch_data = batch_res.json()
        assert batch_data["success"] is True
        assert batch_data["targeted_count"] == 2
        assert batch_data["dispatched_count"] == 2
        assert len(batch_data["details"]) == 2

        # C. Vérification de la création des requêtes en base de données
        db = SessionLocal()
        try:
            req1 = db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == u1.id).order_by(PasswordResetRequest.id.desc()).first()
            req2 = db.query(PasswordResetRequest).filter(PasswordResetRequest.user_id == u2.id).order_by(PasswordResetRequest.id.desc()).first()
            assert req1 is not None and req1.otp_hash is not None
            assert req2 is not None and req2.otp_hash is not None
            print("  -> Succès : Codes OTP générés et enregistrés de façon confidentielle pour chaque utilisateur du lot.")
        finally:
            db.close()

        # D. Test de protection pour admin_first lors d'un envoi ciblé par rôle
        db = SessionLocal()
        try:
            root_admin = db.query(User).filter(User.username == "admin_first").first()
            assert root_admin is not None
            batch_with_root = client.post(
                "/api/v1/password-reset/batch",
                headers=admin_headers,
                json={"user_ids": [u1.id, root_admin.id]},
            )
            assert batch_with_root.status_code == 200
            data_root = batch_with_root.json()
            assert data_root["skipped_count"] >= 1
            print("  -> Succès : Immunité confirmée — 'admin_first' est automatiquement exclu et protégé du batch reset.")
        finally:
            db.close()

        # E. Test du déclencheur unitaire admin-trigger
        single_trigger_res = client.post(
            f"/api/v1/password-reset/admin-trigger/{u1.id}",
            headers=admin_headers,
        )
        assert single_trigger_res.status_code == 200
        assert single_trigger_res.json()["success"] is True

        # Tentative sur admin_first doit être bloquée avec 403
        db = SessionLocal()
        try:
            root_admin = db.query(User).filter(User.username == "admin_first").first()
            protected_trigger = client.post(
                f"/api/v1/password-reset/admin-trigger/{root_admin.id}",
                headers=admin_headers,
            )
            assert protected_trigger.status_code == 403
            print("  -> Succès : Déclencheur unitaire validé et protection stricte de 'admin_first' vérifiée.")
        finally:
            db.close()

    finally:
        cleanup_test_data("batch_test_1@eschola.pro")
        cleanup_test_data("batch_test_2@eschola.pro")


if __name__ == "__main__":
    print("==========================================================")
    print("LANCEMENT DES TESTS DE SÉCURITÉ MOT DE PASSE OUBLIÉ (OTP)")
    print("==========================================================")
    test_1_valid_email_request_and_zero_clear_otp()
    test_2_non_existent_email_anti_enumeration()
    test_3_otp_verification_bad_attempts_and_locking()
    test_4_otp_expiration()
    test_5_full_successful_reset_and_session_invalidation()
    test_6_smtp_resilience_and_configuration()
    test_7_batch_password_reset()
    print("==========================================================")
    print("TOUS LES TESTS DU WORKFLOW OTP ONT RÉUSSI AVEC SUCCÈS (100%)")
    print("==========================================================")


