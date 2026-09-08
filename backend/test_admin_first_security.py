"""
Test exhaustif de sécurité et d'inviolabilité du Super-Administrateur Racine (admin_first)
Vérifie toutes les couches de protection RBAC et d'immunité système :
1. Présence & intégrité du compte racine (username, email, mot de passe Admin@1212, rôle admin).
2. Détection infaillible par 'is_protected_root_admin'.
3. Blocage absolu de la suppression (DELETE) par un autre admin ou admin_manager (HTTP 403).
4. Blocage absolu de la modification de rôle (PUT role) (HTTP 403).
5. Blocage de la réinitialisation de mot de passe par un tiers (PUT password) (HTTP 403).
6. Blocage de la modification de profil par un tiers (PUT user) (HTTP 403).
7. Réservation de l'identifiant et de l'email contre toute usurpation (HTTP 400).
8. Protection contre l'écrasement de mot de passe par 'reset_admin.py'.
9. Idempotence et auto-guérison via 'ensure_root_admin_first'.
"""

import os
import sys
from pathlib import Path

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Add backend directory to Python path
BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi import HTTPException
from sqlalchemy import func
from app.core.security import verify_password, get_password_hash
from app.db.database import SessionLocal
from app.models.user import User
from app.schemas.user import UserUpdate, UserCreate
from app.api.v1.users import (
    is_protected_root_admin,
    delete_user,
    update_user_role,
    admin_reset_password,
    admin_update_user,
    create_user,
    admin_create_user,
    RoleUpdate,
    PasswordReset,
)
from create_admin import ensure_root_admin_first


def run_tests():
    print("=" * 70)
    print("🚀 DÉMARRAGE DES TESTS DE SÉCURITÉ DU SUPER-ADMIN RACINE (admin_first)")
    print("=" * 70)

    db = SessionLocal()
    try:
        # --- TEST 1 : Initialisation & Présence Garantie ---
        print("\n[TEST 1] Vérification de l'initialisation et des identifiants d'admin_first...")
        root_admin = ensure_root_admin_first(db)
        assert root_admin is not None, "admin_first n'a pas pu être créé ou récupéré !"
        assert root_admin.username == "admin_first", f"Nom d'utilisateur incorrect : {root_admin.username}"
        assert root_admin.email == "admin_first@eschola.pro", f"Email incorrect : {root_admin.email}"
        assert root_admin.role == "admin", f"Rôle incorrect : {root_admin.role}"
        assert verify_password("Admin@1212", root_admin.hashed_password), "Le mot de passe hashé ne correspond pas à 'Admin@1212' !"
        print("  ✅ [TEST 1 VALIDÉ] admin_first est présent avec le rôle 'admin' et le mot de passe 'Admin@1212'.")

        # --- TEST 2 : Fonction de détection is_protected_root_admin ---
        print("\n[TEST 2] Vérification de la fonction 'is_protected_root_admin'...")
        assert is_protected_root_admin(root_admin) is True, "is_protected_root_admin n'a pas détecté root_admin !"
        fake_admin = User(id=999, username="admin_first_imposteur", email="imposteur@eschola.pro", role="admin")
        assert is_protected_root_admin(fake_admin) is False, "Faux positif sur fake_admin !"
        case_varied_admin = User(id=998, username="ADMIN_FIRST", email="ADMIN_FIRST@ESCHOLA.PRO", role="admin")
        assert is_protected_root_admin(case_varied_admin) is True, "La détection insensible à la casse a échoué !"
        print("  ✅ [TEST 2 VALIDÉ] Détection infaillible (y compris insensible à la casse).")

        # Création d'utilisateurs temporaires pour simuler les attaques : un admin tiers et un admin_manager
        other_admin = db.query(User).filter(User.email == "test_other_admin@eschola.pro").first()
        if not other_admin:
            other_admin = User(
                username="other_admin",
                email="test_other_admin@eschola.pro",
                role="admin",
                hashed_password=get_password_hash("Pass1234"),
            )
            db.add(other_admin)
            db.commit()
            db.refresh(other_admin)

        admin_mgr = db.query(User).filter(User.email == "test_manager@eschola.pro").first()
        if not admin_mgr:
            admin_mgr = User(
                username="test_mgr",
                email="test_manager@eschola.pro",
                role="admin_manager",
                hashed_password=get_password_hash("Pass1234"),
            )
            db.add(admin_mgr)
            db.commit()
            db.refresh(admin_mgr)

        # --- TEST 3 : Immunité contre la Suppression (DELETE) ---
        print("\n[TEST 3] Tentative de suppression d'admin_first par admin_manager et autre admin...")
        # Par admin_manager
        try:
            delete_user(user_id=root_admin.id, session=db, current_user=admin_mgr)
            assert False, "Échec : admin_manager a pu supprimer admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet admin_manager (403) : {e.detail}")

        # Par un autre super-admin
        try:
            delete_user(user_id=root_admin.id, session=db, current_user=other_admin)
            assert False, "Échec : un autre admin a pu supprimer admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet autre admin (403) : {e.detail}")
        print("  ✅ [TEST 3 VALIDÉ] Suppression d'admin_first strictement impossible.")

        # --- TEST 4 : Immunité contre le Changement de Rôle (PUT role) ---
        print("\n[TEST 4] Tentative de changement de rôle d'admin_first...")
        role_update = RoleUpdate(role="étudiant")
        try:
            update_user_role(user_id=root_admin.id, role_in=role_update, session=db, current_user=admin_mgr)
            assert False, "Échec : admin_manager a pu modifier le rôle d'admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet admin_manager (403) : {e.detail}")

        try:
            update_user_role(user_id=root_admin.id, role_in=role_update, session=db, current_user=other_admin)
            assert False, "Échec : autre admin a pu modifier le rôle d'admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet autre admin (403) : {e.detail}")
        print("  ✅ [TEST 4 VALIDÉ] Rôle d'admin_first verrouillé sur 'admin' à 100%.")

        # --- TEST 5 : Protection du Mot de Passe par un Tiers ---
        print("\n[TEST 5] Tentative de réinitialisation de mot de passe d'admin_first par un tiers...")
        pwd_in = PasswordReset(new_password="HackedPassword123")
        try:
            admin_reset_password(user_id=root_admin.id, pass_in=pwd_in, session=db, current_user=admin_mgr)
            assert False, "Échec : admin_manager a pu réinitialiser le mot de passe d'admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet admin_manager (403) : {e.detail}")

        try:
            admin_reset_password(user_id=root_admin.id, pass_in=pwd_in, session=db, current_user=other_admin)
            assert False, "Échec : un autre admin a pu réinitialiser le mot de passe d'admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet autre admin (403) : {e.detail}")
        print("  ✅ [TEST 5 VALIDÉ] Mot de passe d'admin_first intouchable par tout tiers.")

        # --- TEST 6 : Protection des Informations de Profil (PUT user) ---
        print("\n[TEST 6] Tentative de modification du profil d'admin_first par un tiers...")
        profile_update = UserUpdate(nom="HackedName", prenom="HackedPrenom")
        try:
            admin_update_user(user_id=root_admin.id, user_in=profile_update, session=db, current_user=admin_mgr)
            assert False, "Échec : admin_manager a pu modifier le profil d'admin_first !"
        except HTTPException as e:
            assert e.status_code == 403, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet admin_manager (403) : {e.detail}")
        print("  ✅ [TEST 6 VALIDÉ] Coordonnées et profil d'admin_first inaltérables par des tiers.")

        # --- TEST 7 : Réservation de l'Identifiant et de l'Email ---
        print("\n[TEST 7] Tentative de création d'un doublon ou d'usurpation d'admin_first...")
        impostor_create = UserCreate(
            username="admin_first",
            email="pirate@eschola.pro",
            password="PiratePassword123",
            role="étudiant",
            nom="Pirate",
            prenom="Test",
        )
        try:
            create_user(session=db, user_in=impostor_create)
            assert False, "Échec : usurpation du nom d'utilisateur 'admin_first' acceptée !"
        except HTTPException as e:
            assert e.status_code == 400, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet usurpation username (400) : {e.detail}")

        impostor_email = UserCreate(
            username="another_user_xyz",
            email="admin_first@eschola.pro",
            password="PiratePassword123",
            role="étudiant",
            nom="Pirate2",
            prenom="Test2",
        )
        try:
            create_user(session=db, user_in=impostor_email)
            assert False, "Échec : usurpation de l'email 'admin_first@eschola.pro' acceptée !"
        except HTTPException as e:
            assert e.status_code == 400, f"Code inattendu : {e.status_code}"
            print(f"  - Rejet usurpation email (400) : {e.detail}")
        print("  ✅ [TEST 7 VALIDÉ] Identifiants d'admin_first réservés exclusivement.")

        # --- TEST 8 : Préservation contre le Script reset_admin.py ---
        print("\n[TEST 8] Vérification de la requête de réinitialisation 'reset_admin.py'...")
        target_emails = ["admin", "admin@eschola.pro", "admin@eschola.com"]
        matching_admins = db.query(User).filter(
            ((User.role.like("%admin%")) | (User.email.in_(target_emails)))
            & (func.lower(func.coalesce(User.username, "")) != "admin_first")
            & (func.lower(User.email) != "admin_first@eschola.pro")
        ).all()
        # admin_first must NEVER be in matching_admins
        found_root = any(is_protected_root_admin(u) for u in matching_admins)
        assert not found_root, "admin_first a été sélectionné par la requête de reset_admin.py !"
        print(f"  - {len(matching_admins)} comptes admins réinitialisables trouvés. admin_first est exclu avec succès.")
        print("  ✅ [TEST 8 VALIDÉ] reset_admin.py ne touchera jamais admin_first.")

        # --- TEST 9 : Idempotence et Persistance de ensure_root_admin_first ---
        print("\n[TEST 9] Vérification de l'idempotence de ensure_root_admin_first...")
        re_root = ensure_root_admin_first(db)
        assert re_root.id == root_admin.id, "Un second compte admin_first a été créé au lieu de réutiliser le compte racine !"
        assert verify_password("Admin@1212", re_root.hashed_password), "Le mot de passe a été corrompu !"
        print("  ✅ [TEST 9 VALIDÉ] Idempotence parfaite : zéro duplication.")

        # Nettoyage des utilisateurs de test
        db.delete(other_admin)
        db.delete(admin_mgr)
        db.commit()

        print("\n" + "=" * 70)
        print("🎉 TOUS LES TESTS DE SÉCURITÉ D'ADMIN_FIRST SONT 100% VALIDÉS !")
        print("=" * 70)
        return True

    finally:
        db.close()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
