"""
Module Centralisé de Gestion des Rôles et Permissions (RBAC) - E-Schola Pro
Définit les constantes universelles, la normalisation des chaînes de rôles,
les prédicats d'autorisation et les clauses de contrôle d'accès pour l'ensemble
de l'application FastAPI.
"""

from typing import Any, Optional, Set, Union
from fastapi import HTTPException, status


# ==============================================================================
# 1. CONSTANTES STANDARD DES RÔLES
# ==============================================================================

# Super-Administrateur racine (accès complet universel + SQLAdmin + gestion des admins)
SUPER_ADMIN_ROLES: Set[str] = {"admin"}

# Administrateurs applicatifs (admin et admin_manager)
ADMIN_ROLES: Set[str] = {"admin", "admin_manager"}

# Corps Enseignant & Pédagogique (Formateurs, Pédagogie, Direction RH)
PEDAGOGIC_ROLES: Set[str] = {
    "formateur",
    "pedagogique",
    "dg_rh",
    "dg/rh",
    "dgrh",
}

# Personnel encadrant & Gestionnaires (Staff = Admins + Pédagogie)
STAFF_ROLES: Set[str] = ADMIN_ROLES | PEDAGOGIC_ROLES

# Apprenants (Étudiants, Stagiaires, Employés)
LEARNER_ROLES: Set[str] = {
    "étudiant",
    "etudiant",
    "stagiaire",
    "employer",
    "employé",
    "employe",
}

# Tous les rôles valides reconnus par le système
ALL_VALID_ROLES: Set[str] = STAFF_ROLES | LEARNER_ROLES


# ==============================================================================
# 2. NORMALISATION DU RÔLE
# ==============================================================================

def normalize_role(role: Optional[str]) -> str:
    """
    Normalise une chaîne de rôle :
    - Enlève les espaces périphériques
    - Convertit en minuscules
    - Remplace les séparateurs et variantes (ex: 'dg/rh' -> 'dg_rh', 'dgrh' -> 'dg_rh')
    - Tolère les variantes accentuées ('étudiant' <-> 'etudiant', 'employé' <-> 'employer')
    """
    if not role:
        return "étudiant"

    r = str(role).strip().lower()

    # Remplacement des séparateurs
    if r in {"dg/rh", "dgrh", "dg rh", "dg-rh"}:
        return "dg_rh"
    if r == "etudiant":
        return "étudiant"
    if r in {"employé", "employe"}:
        return "employer"

    return r


def extract_user_role(user_or_role: Any) -> str:
    """Extrait et normalise le rôle à partir d'un modèle User ou d'une chaîne."""
    if hasattr(user_or_role, "role"):
        return normalize_role(getattr(user_or_role, "role"))
    return normalize_role(str(user_or_role))


# ==============================================================================
# 3. PRÉDICATS DE PERMISSION (RBAC)
# ==============================================================================

def is_super_admin(user_or_role: Any) -> bool:
    """Vérifie si l'utilisateur est Super-Administrateur (admin)."""
    return extract_user_role(user_or_role) in SUPER_ADMIN_ROLES


def is_admin(user_or_role: Any) -> bool:
    """Vérifie si l'utilisateur a un rôle administrateur (admin ou admin_manager)."""
    r = extract_user_role(user_or_role)
    return r in ADMIN_ROLES or r in SUPER_ADMIN_ROLES


def is_staff(user_or_role: Any) -> bool:
    """
    Vérifie si l'utilisateur appartient au personnel encadrant :
    Admin, Admin Manager, Formateur, Pédagogique, DG/RH.
    """
    r = extract_user_role(user_or_role)
    return r in STAFF_ROLES or is_admin(r)


def is_learner(user_or_role: Any) -> bool:
    """
    Vérifie si l'utilisateur est un apprenant :
    Étudiant, Stagiaire, Employé.
    """
    return extract_user_role(user_or_role) in LEARNER_ROLES


def matches_target_role(user_role: Optional[str], target_role: Optional[str]) -> bool:
    """
    Vérifie si le rôle d'un utilisateur correspond à un rôle cible (pour les devoirs,
    classes virtuelles ou annonces).
    Prend en compte 'all' et les variantes ('étudiant' / 'etudiant').
    """
    if not target_role or target_role.strip().lower() == "all":
        return True

    norm_user = normalize_role(user_role)
    norm_target = normalize_role(target_role)

    # Vérification directe
    if norm_user == norm_target:
        return True

    # Vérification sous forme de liste délimitée par des virgules (ex: 'étudiant,stagiaire')
    targets = {normalize_role(t) for t in target_role.split(",") if t.strip()}
    return norm_user in targets or "all" in targets


# ==============================================================================
# 4. FONCTIONS DE CONTRÔLE D'ACCÈS AVEC EXCEPTION HTTP
# ==============================================================================

def require_staff(current_user: Any, detail: str = "Accès réservé aux formateurs et à l'administration.") -> Any:
    """Lève HTTP 403 si l'utilisateur n'appartient pas au staff."""
    if not is_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
    return current_user


def require_admin(current_user: Any, detail: str = "Accès réservé aux administrateurs.") -> Any:
    """Lève HTTP 403 si l'utilisateur n'est ni admin ni admin_manager."""
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
    return current_user


def require_super_admin(
    current_user: Any,
    detail: str = "Seul le Super-Administrateur (admin) dispose des privilèges requis pour cette opération.",
) -> Any:
    """Lève HTTP 403 si l'utilisateur n'est pas le Super-Administrateur racine."""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )
    return current_user
