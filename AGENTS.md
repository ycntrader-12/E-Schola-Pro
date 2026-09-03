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

## 3. Contraintes Techniques Strictes & Qualité Industrielle

- **Performance & Zéro blocage :** Assurer une fluidité absolue à 60 FPS. Utiliser exclusivement l'accélération GPU (`transform`, `opacity`) pour les transitions. Découper le code avec *lazy loading* et virtualisation des longues listes. Éviter tout gel du thread principal (requêtes asynchrones non bloquantes, web workers si nécessaire).
- **Stabilité & Robustesse :** Zéro plantage. Isoler les composants dans des gestionnaires d'erreurs (*Error Boundaries* / `try-catch`) et nettoyer systématiquement les écouteurs/timers (`useEffect cleanup`) pour éliminer toute fuite de mémoire.
- **Compatibilité universelle :** Rendu et fonctionnement 100 % identiques sur tous les navigateurs (Chrome, Safari, Firefox, Edge) et OS (iOS, Android, Windows, macOS, Linux), y compris sur versions antérieures (polyfills / préfixes CSS).
- **Responsive total :** Affichage adaptatif et ergonomique sur Desktop, Tablette et Mobile sans altérer l'architecture actuelle, avec support complet du tactile (cibles tactiles $\ge$ 44 px) et de la souris/clavier.
