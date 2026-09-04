# 🎓 E-Schola Pro — Plateforme de Gestion Éducative Intégrée & Sécurisée

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%26%20SQLite-336791?logo=postgresql)](https://postgresql.org)
[![Railway](https://img.shields.io/badge/Deploy-Railway%20Cloud-0B0D0E?logo=railway)](https://railway.app)
[![OWASP](https://img.shields.io/badge/Security-OWASP%20Hardened-blue?logo=owasp)](https://owasp.org)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

**E-Schola Pro** est une plateforme éducative industrielle complète, conçue pour unifier les flux de travail des administrateurs, des formateurs et des apprenants (étudiants, stagiaires, employés) au sein d'un écosystème numérique rapide, esthétique et hautement sécurisé.

---

## 🚀 Démarrage Rapide

### Lancement en un clic (Windows)
Pour démarrer simultanément le backend FastAPI et le frontend Next.js en développement local :
👉 Double-cliquez sur [`start_all.bat`](file:///d:/my%20projet/E-Schola%20Pro/start_all.bat)

- **Application Web (Frontend) :** [http://localhost:3000](http://localhost:3000)
- **Documentation API Interactive (Swagger) :** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Console d'Administration SQLAdmin :** [http://localhost:8000/admin](http://localhost:8000/admin)
- **Portail de Documentation Technique Complète :** [Documentation_Technique_E-Schola_Pro.html](file:///d:/my%20projet/E-Schola%20Pro/Documentation_Technique_E-Schola_Pro.html)

---

## 🛡️ Sécurité Industrielle & Protection Anti-Menaces (Local & Railway)

Le système de messagerie et les endpoints de la plateforme intègrent un blindage multicouche conforme aux recommandations **OWASP** :

| Vecteur d'Attaque / Menace | Risque | Protection Déployée |
| :--- | :--- | :--- |
| **XSS Stocké & Injections HTML** | Injection de `<script>`, `<iframe>` ou d'événements JS (`onerror=`, `onclick=`) dans les messages | **Désinfection systématique** (`app/core/sanitizer.py`). Éradication de toutes les balises et attributs dangereux avant persistance. |
| **Attaque XSS via Pièces Jointes** | Exécution de JavaScript via `attachment_url` (`javascript:...`, `data:text/html;base64,...`) | **Validation stricte de protocole** : Seuls `http://`, `https://`, `/uploads/` et images Base64 sont autorisés. Rejet immédiat avec code **HTTP 400**. Vérification défensive additionnelle dans l'interface React. |
| **Malware, WebShells & DoS Fichier** | Upload de fichiers exécutables (`.exe`, `.bat`, `.sh`, `.php`, `.js`, etc.) ou saturation de disque | **Liste noire stricte** dans `app/api/v1/upload.py`, assainissement contre les traversées de répertoires (*Path Traversal* `../`), et **limite streaming de 25 Mo** (rejet **HTTP 413**). |
| **IDOR & Fuite de Messages Privés** | Exfiltration de messages confidentiels via `POST /{id}/report` ou suppression frauduleuse | **Vérification d'accès stricte** : un utilisateur ne peut consulter, supprimer ou signaler qu'un message dont il est le destinataire direct ou l'expéditeur (**HTTP 403**). |
| **Spam, Flooding & Déni de Service (DoS)** | Scripts automatisés bombardant la base PostgreSQL pour épuiser les connexions | **Limiteur de débit par fenêtre glissante** (`app/core/rate_limiter.py`) : max **25 messages/min** et **5 signalements/min** par utilisateur (**HTTP 429** avec `Retry-After`). |
| **Spam Broadcast / Envoi Massif** | Envois massifs non autorisés à tous les membres par des étudiants | Rôle restreint sur `is_broadcast` et **plafond anti-spam de 10 destinataires max** pour les rôles étudiants et employés. |
| **Clickjacking & Sécurité Réseau Railway** | Reniflage MIME, détournement d'iframe, requêtes cross-origin non autorisées | Middleware FastAPI injectant les **en-têtes de sécurité OWASP** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `Referrer-Policy`) et support CORS regex Railway. |

---

## 🗄️ Persistance Hybride PostgreSQL (Railway) & SQLite (Local)

E-Schola Pro supporte nativement deux modes de persistance sans modification de code :

1. **Production Cloud (Railway PostgreSQL) :**
   - Support complet de l'URL template Railway avec résolution automatique des variables d'environnement :
     ```text
     DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}
     ```
   - Protection contre les bascules silencieuses vers SQLite éphémère sur Railway (`is_in_railway()`).
   - Gestion automatique des rollbacks de transaction (`db.rollback()`) pour préserver l'intégrité du pool de connexions PostgreSQL.
   - Suppression en cascade intégrale (`delete_user`) évitant toute violation de clé étrangère (*Foreign Key Violation*).
2. **Développement Local (SQLite Fallback) :**
   - Bascule automatique et transparente vers `backend/eschola.db` en environnement local hors-ligne.
3. **Optimisation Automatique des Avatars (WebP Base64) :**
   - Auto-orientation EXIF, recadrage centré carré 256×256 et compression WebP ultra-haute performance (>98 % d'économie d'espace).
   - Stockage direct sous forme de Data URI Base64 dans la colonne `avatar_url` de PostgreSQL : **zéro perte de données lors des redéploiements de conteneurs Railway**.
   - Endpoint de streaming direct : `GET /api/v1/users/{id}/avatar`.

---

## 🛠️ Stack Technologique

### Frontend
- **Framework :** [Next.js 15](https://nextjs.org) (App Router, Server & Client Components)
- **UI & Icônes :** React 19, [Lucide React](https://lucide.dev)
- **Langage :** TypeScript (mode strict, validation 100 % sans erreur)
- **Design System :** CSS Vanilla moderne (Glassmorphism, thèmes Sombre/Clair, animations GPU 60 FPS)
- **Internationalisation :** `next-intl` (Français, Anglais, Arabe avec support RTL complet)
- **Formulaires & Validation :** `react-hook-form`
- **Client HTTP :** Axios configuré avec intercepteurs JWT

### Backend
- **Framework :** [FastAPI 0.111+](https://fastapi.tiangolo.com) (Python 3.11+)
- **ORM :** SQLAlchemy 2.0 avec migrations automatiques au démarrage
- **Moteur Base de Données :** PostgreSQL (Railway Production) & SQLite (Local Dev)
- **Validation & Schémas :** Pydantic v2
- **Sécurité & Auth :** JWT Bearer Tokens (python-jose), Passlib (Bcrypt)
- **Traitement d'Images :** Pillow (PIL) avec algorithme Lanczos & encodage WebP
- **Administration :** SQLAdmin (Panel web connecté en direct à la base de données)

---

## 📦 Structure du Projet

```text
E-Schola Pro/
├── backend/                             # API REST FastAPI & Persistance
│   ├── app/
│   │   ├── api/                         # Endpoints REST (v1) et Dépendances
│   │   │   ├── v1/
│   │   │   │   ├── messages.py          # Messagerie sécurisée, inbox, favoris, signalement
│   │   │   │   ├── users.py             # CRUD Utilisateurs, profil, avatar WebP
│   │   │   │   ├── upload.py            # Upload sécurisé anti-malware, limite 25 Mo
│   │   │   │   └── ...                  # Cours, Quiz, Présences, Devoirs, Groupes
│   │   │   └── deps.py                  # Injection de dépendances et gestion de session DB
│   │   ├── core/
│   │   │   ├── config.py                # Résolution variables d'environnement & Railway
│   │   │   ├── rate_limiter.py          # Limiteur de débit à fenêtre glissante (HTTP 429)
│   │   │   ├── sanitizer.py             # Désinfection XSS, validation URL & extensions
│   │   │   └── security.py              # Hachage bcrypt et création de jetons JWT
│   │   ├── models/                      # Modèles ORM SQLAlchemy (User, Message, etc.)
│   │   ├── schemas/                     # Schémas de validation Pydantic v2
│   │   └── main.py                      # Application FastAPI, headers OWASP et CORS
│   ├── migrate_messages_schema.py       # Synchronisation dynamique du schéma messages
│   ├── migrate_user_profiles.py         # Migration des colonnes de profils étendus
│   ├── test_messaging_security.py       # Suite de tests de sécurité OWASP (XSS, IDOR, DoS)
│   ├── test_railway_persistence.py      # Suite de tests de persistance Railway PostgreSQL
│   ├── requirements.txt                 # Dépendances Python
│   └── start.sh                         # Script de démarrage pour conteneur Docker/Railway
├── frontend/                            # Client Next.js 15 (App Router)
│   ├── src/
│   │   ├── app/[locale]/
│   │   │   ├── inbox/                   # Boîte de messagerie Gmail-style sécurisée
│   │   │   ├── profile/                 # Profil utilisateur & portail admin
│   │   │   ├── classroom/               # Classes virtuelles visioconférence HD
│   │   │   └── ...                      # Cours, Quiz, Devoirs, Présences, Groupes
│   │   ├── components/                  # Composants réutilisables
│   │   └── lib/api.ts                   # Client Axios configuré
│   ├── messages/                        # Dictionnaires i18n (fr.json, en.json, ar.json)
│   └── package.json                     # Dépendances Node.js
├── start_all.bat                        # Script de lancement global pour Windows
└── Documentation_Technique_E-Schola_Pro.html # Documentation technique complète synchronisée
```

---

## 🌟 Fonctionnalités Principales

* 💬 **Messagerie Inbox Sécurisée :** Boîte de réception inspirée de Gmail, multi-destinataires, copie carbone (CC), brouillons, corbeille, favoris (⭐), recherche multi-modes (Interne, Google Web, Assistant IA Gemini), signalement de sécurité immédiat aux administrateurs/formateurs et protection anti-spam.
* 👤 **Gestion des Utilisateurs & Avatars :** Profil complet par rôle (Admin, Formateur, Étudiant, Stagiaire, Employé), téléversement et optimisation instantanée des photos en WebP 256×256 stockées en Base64 dans Railway PostgreSQL.
* 📚 **Gestion des Cours & Vidéos :** Organisation des cours par catégories, chapitres vidéo avec lecteur HD, documents PDF et suivi de progression des apprenants.
* 🏆 **Quiz & Évaluations :** Création de QCM chronométrés, notation automatique, calcul du score sur 20 et publication instantanée des résultats.
* 📋 **Feuille de Présences & Émargement :** Pointage d'assiduité par séance avec statuts détaillés (Présent, Retard, Absent, Excusé) et statistiques personnelles pour les apprenants.
* 📅 **Agenda & Calendrier :** Planification des sessions et échéances avec filtrage mensuel et soumission de livrables liés.
* 📹 **Classes Virtuelles HD :** Visioconférence interactive avec salle d'attente sécurisée, contrôle d'accès par l'hôte, partage d'écran et messagerie de salle.
* 👥 **Groupes & Promotions :** Gestion des promotions et affectation ciblée des étudiants avec contrôle d'accès strict.
* ⚙️ **Panel SQLAdmin Intégré :** Visualisation et manipulation sécurisée des 14 tables de données réservée aux administrateurs.

---

## 🧪 Tests & Validation

La plateforme intègre des suites de tests automatisées assurant la robustesse et la non-régression :

### 1. Tests de Sécurité (XSS, IDOR, Flooding, Uploads)
```bash
python backend/test_messaging_security.py
```
*Validation : Nettoyage XSS, blocage `javascript:`, rejet des web shells `.exe/.php`, contrôle IDOR sur signalement, et limitation HTTP 429.*

### 2. Tests de Persistance Railway PostgreSQL
```bash
python backend/test_railway_persistence.py
```
*Validation : Résolution de template Railway `${{...}}`, CRUD utilisateur, persistance messagerie et suppression en cascade.*

### 3. Vérification TypeScript Frontend
```bash
cd frontend && npx tsc --noEmit
```
*Validation : Zéro erreur de typage sur l'ensemble du projet Next.js.*

---

## ⚙️ Variables d'Environnement

### Backend (`backend/.env` ou Dashboard Railway)
```env
SECRET_KEY=votre_cle_secrete_jwt_super_robuste
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# En local :
DATABASE_URL=sqlite:///./eschola.db

# Sur Railway (l'une ou l'autre syntaxe est acceptée automatiquement) :
DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}
# Ou variables directes : PGUSER, POSTGRES_PASSWORD, RAILWAY_PRIVATE_DOMAIN, PGDATABASE
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
# Sur Railway/Production :
# NEXT_PUBLIC_API_URL=https://votre-app-backend.up.railway.app/api/v1
```

---

## 📖 Documentation Technique

Pour consulter l'architecture complète, la liste des tables, la matrice des rôles et l'ensemble des endpoints REST :
👉 Ouvrez [Documentation_Technique_E-Schola_Pro.html](file:///d:/my%20projet/E-Schola%20Pro/Documentation_Technique_E-Schola_Pro.html) dans votre navigateur.
