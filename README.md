# 🎓 E-Schola Pro — Plateforme de Gestion Éducative Intégrée

**E-Schola Pro** est une plateforme de gestion éducative moderne, complète et intégrée. Elle a été conçue pour unifier les flux de travail des administrateurs, des formateurs et des apprenants (étudiants, stagiaires, employés) au sein d'un écosystème numérique unique, fluide et performant.

---

## 🚀 Démarrage Rapide

Si vous êtes sur **Windows**, vous pouvez lancer simultanément le backend et le frontend en double-cliquant sur le script de démarrage global :
👉 [`start_all.bat`](file:///d:/my%20projet/E-Schola%20Pro/start_all.bat)

- **Backend API (Swagger) :** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Frontend App :** [http://localhost:3000](http://localhost:3000)
- **Console SQLAdmin (Admin uniquement) :** [http://localhost:8000/admin](http://localhost:8000/admin)

---

## 🛠️ Stack Technologique

### Frontend
- **Framework :** [Next.js 15 / 16](file:///d:/my%20projet/E-Schola%20Pro/frontend) (App Router, Server Components)
- **Bibliothèque UI :** React 19 & [Lucide Icons](https://lucide.dev)
- **Langage :** TypeScript
- **Stylisation :** CSS Vanilla personnalisé (Glassmorphism, thèmes Adaptatifs Sombre/Clair)
- **Internationalisation :** `next-intl` (Français, Anglais, Arabe)
- **Client HTTP :** Axios

### Backend
- **Framework :** FastAPI (Python 3.11+)
- **ORM :** SQLAlchemy 2.0 & Migrations avec Alembic
- **Validation :** Pydantic v2
- **Base de données :** SQLite (`eschola.db`)
- **Sécurité :** Authentification JWT (JSON Web Tokens) & Passlib (Bcrypt)
- **Uploads :** Intégration Cloudinary (images, vidéos)
- **Console d'Administration :** SQLAdmin (Panel d'administration web auto-généré)

---

## 📦 Structure du Projet

```text
E-Schola Pro/
├── backend/                  # API REST FastAPI & Base de données
│   ├── app/                  # Logique applicative (models, schemas, api...)
│   │   ├── api/              # Endpoints REST (v1) et Dépendances
│   │   ├── core/             # Sécurité, JWT et Configurations
│   │   ├── db/               # Configuration Session et Engine
│   │   ├── models/           # Modèles SQLAlchemy (ORM)
│   │   ├── schemas/          # Schémas Pydantic (validation)
│   │   └── admin.py          # Configuration SQLAdmin
│   ├── alembic/              # Fichiers de migration de base de données
│   ├── requirements.txt      # Dépendances Python
│   └── .env                  # Variables d'environnement du backend
├── frontend/                 # Client Next.js (App Router)
│   ├── src/                  # Composants, hooks, lib et pages Next.js
│   │   └── app/[locale]/     # Routage internationalisé (fr, en, ar)
│   ├── messages/             # Traductions JSON (FR, EN, AR)
│   └── package.json          # Scripts et dépendances Node.js
├── start_all.bat             # Batch de démarrage rapide (Windows)
└── Documentation_Technique_E-Schola_Pro.html # Documentation technique complète
```

---

## 🌟 Fonctionnalités Principales

* 📚 **Gestion des Cours :** Création, édition et suppression de cours avec support de vidéos, documents PDF et images de couverture. Inscription automatique des étudiants.
* 🏆 **Quiz & Évaluations :** Système de QCM avec timer configurable, correction automatique, calcul du score en pourcentage et tableau de classement.
* ✅ **Présences & Émargement :** Suivi des présences par session avec statuts (Présent, En retard, Absent, Excusé), filtrage par groupe et par date.
* 📅 **Calendrier & Planning :** Planification des cours et événements, navigation mensuelle, ciblage par rôle, et dépôt de livrables (fichiers/liens).
* 💬 **Messagerie Interne :** Système de messagerie complet avec boîte de réception, messages envoyés, brouillons, corbeille et pièces jointes.
* 🎥 **Classe Virtuelle :** Salles de visioconférence intégrées avec identifiant unique, accessibles par tous les utilisateurs inscrits.
* 👥 **Gestion des Groupes & Classes :** Création de classes et niveaux avec affectation dynamique des étudiants aux groupes.
* ⚙️ **Panel d'Administration (SQLAdmin) :** Gestion de 14 tables de base de données en direct via une interface web intégrée.

---

## ⚙️ Guide d'Installation & Configuration

### 1. Prérequis
Assurez-vous d'avoir installé **Python 3.11+**, **Node.js 18+** et **Git**.

### 2. Configuration du Backend

1. Allez dans le dossier backend :
   ```bash
   cd backend
   ```
2. Créez et activez un environnement virtuel :
   ```bash
   # Windows :
   python -m venv venv
   venv\Scripts\activate

   # Linux/Mac :
   python -m venv venv
   source venv/bin/activate
   ```
3. Installez les dépendances :
   ```bash
   pip install -r requirements.txt
   ```
4. Configurez le fichier `.env` :
   Créez un fichier `.env` dans le dossier `backend` sur le modèle suivant :
   ```env
   SECRET_KEY=votre_cle_secrete_jwt
   DATABASE_URL=sqlite:///./eschola.db
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   CLOUDINARY_CLOUD_NAME=votre_cloud_name
   CLOUDINARY_API_KEY=votre_api_key
   CLOUDINARY_API_SECRET=votre_api_secret
   ```
5. Appliquez les migrations de base de données :
   ```bash
   alembic upgrade head
   ```
6. (Optionnel) Créez ou réinitialisez le compte administrateur par défaut :
   ```bash
   python create_admin.py
   ```
7. Lancez le serveur de développement backend :
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 3. Configuration du Frontend

1. Allez dans le dossier frontend :
   ```bash
   cd ../frontend
   ```
2. Installez les dépendances Node.js :
   ```bash
   npm install
   ```
3. Lancez le serveur de développement frontend :
   ```bash
   npm run dev
   ```

---

## 🛡️ Rôles & Permissions

L'application intègre un contrôle d'accès basé sur les rôles (RBAC) :
- **Admin :** Accès complet à l'application, panel d'administration SQLAdmin et portail de debug.
- **Formateur :** Création de cours, gestion de groupes, notation des quiz, suivi des présences, création d'événements.
- **Étudiant / Stagiaire / Employé :** Consultation des cours, passage des quiz, consultation du calendrier et dépôt des devoirs/livrables.

---

## 📖 Documentation Technique

Pour plus de détails sur le schéma détaillé de la base de données, la liste des 16 endpoints de l'API REST, les permissions précises ou le fonctionnement interne des modules, consultez la documentation HTML incluse :
👉 [Documentation_Technique_E-Schola_Pro.html](file:///d:/my%20projet/E-Schola%20Pro/Documentation_Technique_E-Schola_Pro.html)
