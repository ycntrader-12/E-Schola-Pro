/**
 * Module Centralisé des Rôles & Permissions (RBAC) - E-Schola Pro Frontend
 * Assure la cohérence des clauses de rôle, la normalisation des accents et
 * des variantes (dg/rh, dg-rh, etudiant, etc.) sur l'ensemble de l'interface utilisateur.
 */

export const SUPER_ADMIN_ROLES = ["admin"] as const;
export const ADMIN_ROLES = ["admin", "admin_manager"] as const;
export const PEDAGOGIC_ROLES = ["formateur", "pedagogique", "dg_rh"] as const;
export const STAFF_ROLES = ["admin", "admin_manager", "formateur", "pedagogique", "dg_rh"] as const;
export const LEARNER_ROLES = ["étudiant", "stagiaire", "employer"] as const;

export type ValidRole =
  | "admin"
  | "admin_manager"
  | "formateur"
  | "pedagogique"
  | "dg_rh"
  | "étudiant"
  | "stagiaire"
  | "employer";

/**
 * Normalise une chaîne de rôle pour garantir un matching fiable sans faille de casse ou d'accent.
 */
export function normalizeRole(role?: string | null): string {
  if (!role) return "étudiant";
  const r = role.trim().toLowerCase();

  if (r === "dg/rh" || r === "dgrh" || r === "dg rh" || r === "dg-rh") {
    return "dg_rh";
  }
  if (r === "etudiant") {
    return "étudiant";
  }
  if (r === "employé" || r === "employe") {
    return "employer";
  }
  return r;
}

/**
 * Vérifie si le rôle est Super-Administrateur racine (admin).
 */
export function isSuperAdmin(role?: string | null): boolean {
  const r = normalizeRole(role);
  return (SUPER_ADMIN_ROLES as readonly string[]).includes(r);
}

/**
 * Vérifie si le rôle est Administrateur (admin ou admin_manager).
 */
export function isAdmin(role?: string | null): boolean {
  const r = normalizeRole(role);
  return (ADMIN_ROLES as readonly string[]).includes(r);
}

/**
 * Vérifie si le rôle est Staff encadrant (admin, admin_manager, formateur, pedagogique, dg_rh).
 */
export function isStaff(role?: string | null): boolean {
  const r = normalizeRole(role);
  return (STAFF_ROLES as readonly string[]).includes(r);
}

/**
 * Vérifie si le rôle est Apprenant (étudiant, stagiaire, employer).
 */
export function isLearner(role?: string | null): boolean {
  const r = normalizeRole(role);
  return (LEARNER_ROLES as readonly string[]).includes(r) || r === "etudiant" || r === "employé";
}

/**
 * Vérifie si un rôle apprenant correspond aux rôles cibles spécifiés.
 */
export function matchesTargetRole(userRole?: string | null, targetRole?: string | null): boolean {
  if (!targetRole || targetRole.trim().toLowerCase() === "all" || targetRole.trim() === "") {
    return true;
  }
  const normUser = normalizeRole(userRole);
  const targets = targetRole
    .split(",")
    .map((t) => normalizeRole(t))
    .filter(Boolean);

  return targets.includes("all") || targets.includes(normUser);
}
