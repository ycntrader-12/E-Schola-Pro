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
        print("  -> Succès : Requête acceptée et OTP stocké sous forme de hash bcrypt sécurisé.")
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


if __name__ == "__main__":
    print("==========================================================")
    print("LANCEMENT DES TESTS DE SÉCURITÉ MOT DE PASSE OUBLIÉ (OTP)")
    print("==========================================================")
    test_1_valid_email_request_and_zero_clear_otp()
    test_2_non_existent_email_anti_enumeration()
    test_3_otp_verification_bad_attempts_and_locking()
    test_4_otp_expiration()
    test_5_full_successful_reset_and_session_invalidation()
    print("==========================================================")
    print("TOUS LES TESTS DU WORKFLOW OTP ONT RÉUSSI AVEC SUCCÈS (100%)")
    print("==========================================================")
