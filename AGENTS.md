# Directives du Projet E-Schola Pro

## 1. Règle Fondamentale : Synchronisation Continue de la Documentation

> [!IMPORTANT]
> **Mise à jour obligatoire de la documentation technique pour CHAQUE modification :**
> À chaque fois qu'une modification ou une nouveauté est apportée au projet (backend, frontend, base de données, API, interface, permissions) :
> 1. **Mettre à jour le fichier `Documentation_Technique_E-Schola_Pro.html`** immédiatement pour refléter les changements :
>    - Si un modèle ou une table change : mettre à jour la section **04 — Modèles de Base de Données**.
>    - Si un endpoint API est créé, modifié ou supprimé : mettre à jour la section **05 — API Endpoints (REST)**.
>    - Si les rôles ou accès changent : mettre à jour la section **06 — Rôles & Permissions**.
>    - Si une interface ou des options de module changent : mettre à jour la section **07 — Modules Fonctionnels** et la description des fonctionnalités.
>    - Si de nouvelles pages ou composants de navigation sont ajoutés : mettre à jour la section **08 — Architecture Frontend**.
> 2. **Captures d'écran :**
>    - Si une interface visuelle majeure est modifiée ou ajoutée, mettre à jour le screenshot correspondant dans le dossier `docs_screenshots/` et son intégration dans le mockup du document.
> 3. **Export PDF :**
>    - Veiller à ce que la feuille de style `@media print` reste toujours propre et que l'exportation PDF conserve la couverture tech, la mise en page et les captures d'écran.

## 2. Standards de Développement

- **Frontend :** Next.js 15 (App Router, Tailwind/Vanilla CSS, Lucide React, next-intl).
- **Backend :** FastAPI, SQLAlchemy, SQLite (`eschola.db`), Pydantic v2.
- **Sécurité :** Authentification JWT Bearer Token, contrôle strict des rôles (admin, formateur, étudiant, stagiaire, employer).
