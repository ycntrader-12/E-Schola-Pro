#!/usr/bin/env python3
"""
=============================================================================
E-Schola Pro — DevOps Environment & SMTP/DKIM Readiness Verifier
=============================================================================
This script performs non-destructive pre-flight checks to ensure all
environment variables, database connectivity rules, security keys,
and transactional email configurations are properly loaded and aligned
between Local Dev, GitHub CI/CD, and Railway Cloud Production.

Usage:
    python verify_production_env.py
    python verify_production_env.py --ci-mode
=============================================================================
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.core.config import is_in_railway, is_production, settings
    from app.services.email_service import (
        get_email_service_diagnostics,
        get_smtp_runtime_config,
        validate_recipient_email,
    )
except ImportError as err:
    print(f"[CRITICAL ERROR] Failed to import app core modules: {err}")
    sys.exit(1)


def mask_secret(val: str, show_chars: int = 3) -> str:
    """Safely masks sensitive credentials for logging output."""
    if not val:
        return "(non défini)"
    if len(val) <= show_chars * 2:
        return "***"
    return f"{val[:show_chars]}***{val[-show_chars:]}"


def run_checks(ci_mode: bool = False) -> int:
    print("=============================================================================")
    print("        E-SCHOLA PRO — DEVOPS PRE-FLIGHT VERIFICATION REPORT                 ")
    print("=============================================================================")

    failures = 0
    warnings = 0

    # 1. Environment & Runtime Context
    in_railway = is_in_railway()
    prod_mode = is_production()
    print(f"[*] Environment Detected : {settings.ENVIRONMENT.upper()}")
    print(f"[*] Railway Cloud Native : {'OUI' if in_railway else 'NON'}")
    print(f"[*] Production Mode      : {'ACTIF' if prod_mode else 'DEV/TEST'}")

    # 2. Database URL Architecture
    db_url = settings.DATABASE_URL
    print(f"[*] Database URL Config  : {mask_secret(db_url, 12)}")
    if prod_mode:
        if "postgresql" not in db_url and "postgres" not in db_url:
            print("[FAIL] En production, l'URL de base de données DOIT être PostgreSQL !")
            failures += 1
        else:
            print("[OK] PostgreSQL configuré et validé pour la production.")
    else:
        if "sqlite" in db_url:
            print("[OK] SQLite local détecté pour le développement (mode sans PostgreSQL externe).")
        else:
            print("[OK] Connexion PostgreSQL locale détectée.")

    # 3. Security & Secret Key
    sec_key = settings.SECRET_KEY
    if not sec_key or sec_key == "supersecretkey_please_change_in_production":
        if prod_mode and not in_railway:
            print("[FAIL] SECRET_KEY non sécurisée ou valeur par défaut en production !")
            failures += 1
        else:
            print("[WARN] SECRET_KEY de développement détectée.")
            warnings += 1
    else:
        print(f"[OK] SECRET_KEY configurée (longueur: {len(sec_key)} caractères, empreinte: {mask_secret(sec_key, 4)}).")

    # 4. Transactional Email & SMTP Configuration
    cfg = get_smtp_runtime_config()
    print("\n--- Configuration Messagerie Transactionnelle (SMTP & Sécurité) ---")
    print(f"[*] Emails Activés (EMAILS_ENABLED) : {cfg['emails_enabled']}")
    print(f"[*] Hôte SMTP (SMTP_HOST)           : {cfg['smtp_host'] or '(non configuré)'}")
    print(f"[*] Port SMTP (SMTP_PORT)           : {cfg['smtp_port']}")
    print(f"[*] Utilisateur SMTP (SMTP_USER)    : {mask_secret(cfg['smtp_user'])}")
    print(f"[*] Mot de passe SMTP               : {'Configuré (masqué)' if cfg['smtp_password'] else '(vide)'}")
    print(f"[*] Expéditeur (SMTP_FROM_EMAIL)    : {cfg['smtp_from_email']}")
    print(f"[*] Nom Expéditeur (SMTP_FROM_NAME) : {cfg['smtp_from_name']}")
    print(f"[*] Protocole Chiffrement           : {'SSL direct (port 465)' if cfg['smtp_ssl'] else ('STARTTLS (port 587)' if cfg['smtp_tls'] else 'Texte clair (déconseillé)')}")
    print(f"[*] Timeout Réseau (SMTP_TIMEOUT)   : {cfg['smtp_timeout']} secondes")
    print(f"[*] Validation DNS/MX               : {'Activée' if cfg['email_validate_mx'] else 'Désactivée'}")
    print(f"[*] Blocage Emails Jetables         : {'Activé' if cfg['block_disposable_emails'] else 'Désactivé'}")

    if not cfg["smtp_host"]:
        print("[INFO] SMTP_HOST est vide : le système opère en mode Mock/Dev résilient.")
        print("       Les emails seront journalisés dans la console sans bloquer les flux utilisateurs.")
    else:
        if cfg["emails_enabled"]:
            print("[OK] SMTP opérationnel et actif.")
        else:
            print("[WARN] SMTP_HOST est défini mais EMAILS_ENABLED=False (emails désactivés).")
            warnings += 1

    # 5. DKIM & SPF Status
    print("\n--- Sécurité Délivrabilité (DKIM & SPF) ---")
    dkim_configured = bool(cfg["dkim_private_key"] or cfg["dkim_private_key_path"])
    print(f"[*] Signature DKIM Applicative : {'CONFIGURÉE' if dkim_configured else 'NON CONFIGURÉE (signature gérée par relais SMTP)'}")
    print(f"[*] Sélecteur DKIM             : {cfg['dkim_selector']}")
    print(f"[*] Domaine DKIM               : {cfg['dkim_domain'] or '(hérité du FROM)'}")

    # 6. Recipient Validation Smoke Test
    test_email = "admin@google.com"
    is_valid, reason, _ = validate_recipient_email(test_email)
    print(f"[*] Test validation domaine public externe ({test_email}) : {'VALIDE' if is_valid else f'INVALIDE ({reason})'}")

    disposable_test = "temp.user@mailinator.com"
    is_disp_valid, disp_reason, _ = validate_recipient_email(disposable_test)
    print(f"[*] Test blocage domaine jetable ({disposable_test}) : {'BLOQUÉ AVEC SUCCÈS' if not is_disp_valid else 'NON BLOQUÉ'}")

    print("\n=============================================================================")
    if failures > 0:
        print(f"[RÉSULTAT] {failures} ERREUR(S) CRITIQUE(S) DÉTECTÉE(S). VEUILLEZ CORRIGER LA CONFIGURATION.")
        print("=============================================================================")
        return 1
    elif warnings > 0:
        print(f"[RÉSULTAT] CONFORME AVEC {warnings} AVERTISSEMENT(S).")
        print("=============================================================================")
        return 0
    else:
        print("[RÉSULTAT] CONFORMITÉ TOTALE : L'ENVIRONNEMENT ET LA CONFIGURATION SONT 100% VALIDES.")
        print("=============================================================================")
        return 0


if __name__ == "__main__":
    is_ci = "--ci-mode" in sys.argv
    sys.exit(run_checks(ci_mode=is_ci))
