# 📖 Runbook d'Exploitation & Développement — E-Schola Pro

Ce runbook décrit les procédures opérationnelles standards pour le développement, la maintenance, la gestion de base de données et le dépannage de la plateforme **E-Schola Pro**.

---

## 📂 Table des Matières
1. [Démarrage & Arrêt des Services](#1-démarrage--arrêt-des-services)
2. [Gestion de la Base de Données (SQLite & Alembic)](#2-gestion-de-la-base-de-données-sqlite--alembic)
3. [Gestion des Utilisateurs & Comptes Admin](#3-gestion-des-utilisateurs--comptes-admin)
4. [Gestion des Uploads & Médias](#4-gestion-des-uploads--médias)
5. [Internationalisation (i18n)](#5-internationalisation-i18n)
6. [Guide de Déploiement sur Railway](#6-guide-de-déploiement-sur-railway)
7. [Résolution des Problèmes (Troubleshooting)](#7-résolution-des-problèmes-troubleshooting)

---

## 1. Démarrage & Arrêt des Services

### A. Démarrage rapide (Windows)
Double-cliquez sur le script de démarrage global situé à la racine du projet :
👉 [`start_all.bat`](file:///d:/my%20projet/E-Schola%20Pro/start_all.bat)

Ce script ouvre deux invites de commande séparées et lance :
- Le Backend FastAPI sur le port `8000` (avec rechargement automatique)
- Le Frontend Next.js sur le port `3000`

### B. Démarrage manuel
Si vous préférez exécuter les services manuellement ou sur Linux/macOS :

#### 1. Backend FastAPI :
```bash
cd backend
# Activer l'environnement virtuel
# Sur Windows :
venv\Scripts\activate
# Sur Linux/macOS :
source venv/bin/activate

# Lancer FastAPI avec Uvicorn
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Next.js :
```bash
cd frontend
npm run dev
```

### C. Arrêt propre & Libération des ports
Si un service ne s'arrête pas correctement ou si les ports `3000` ou `8000` restent occupés :

#### Sur Windows (PowerShell) :
```powershell
# Trouver et tuer le processus occupant le port 8000 (Backend)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force

# Trouver et tuer le processus occupant le port 3000 (Frontend)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
```

#### Sur Linux/macOS :
```bash
# Tuer le processus sur le port 8000
kill -9 $(lsof -t -i:8000)

# Tuer le processus sur le port 3000
kill -9 $(lsof -t -i:3000)
```

---

## 2. Gestion de la Base de Données (PostgreSQL, SQLite & Alembic)

E-Schola Pro supporte nativement **PostgreSQL** et **SQLite** :
- **En Production / Railway :** Utilisation recommandée de **PostgreSQL** (provisionné via un plugin Railway ou un service externe comme Supabase/Neon).
- **En Développement Local :** Vous pouvez connecter une instance **PostgreSQL** locale (ex: `postgresql+psycopg2://postgres:postgres@localhost:5432/eschola_pro`) ou utiliser la base **SQLite** persistante [`backend/eschola.db`](file:///d:/my%20projet/E-Schola%20Pro/backend/eschola.db).

> [!NOTE]
> Au démarrage du backend, FastAPI exécute automatiquement les vérifications de schéma et `Base.metadata.create_all(bind=engine)`. Pour le versionnement propre et la reproductibilité en équipe ou en production, l'utilisation de la chaîne de migration Alembic est activée et recommandée.

### A. Appliquer les migrations de base de données
Lorsque vous téléchargez des modifications de code ou basculez vers une nouvelle base de données :
```bash
cd backend
# Sur Windows :
venv\Scripts\python.exe -m alembic.config upgrade head
# Ou avec alembic directement :
alembic upgrade head
```

### B. Créer une nouvelle migration de schéma
Si vous modifiez ou ajoutez un modèle SQLAlchemy dans `backend/app/models/` :
1. Assurez-vous d'importer le nouveau modèle dans `backend/app/db/base.py` pour qu'Alembic le détecte.
2. Générez la migration automatique :
   ```bash
   venv\Scripts\python.exe -m alembic.config revision --autogenerate -m "description_de_la_modification"
   ```
3. Vérifiez le fichier généré dans `backend/alembic/versions/`.
4. Appliquez-le :
   ```bash
   venv\Scripts\python.exe -m alembic.config upgrade head
   ```

### C. Persistance et Résilience des Connexions
- **PostgreSQL :** Le pool de connexions SQLAlchemy est doté de `pool_pre_ping=True` et d'un recyclage toutes les 5 minutes (`pool_recycle=300`), évitant toute rupture brutale de socket TCP sur le cloud ou lors d'inactivité prolongée.
- **SQLite :** Activé en mode `PRAGMA journal_mode=WAL` avec un timeout de 30 secondes pour une haute concurrence sans verrouillage intempestif.
- **Mots de Passe & Comptes :** Les modifications de mot de passe utilisateur et de rôles sont **100% persistantes** et ne sont jamais écrasées lors des redémarrages. Le script de peuplement `create_admin.py` vérifie l'existence de façon insensible à la casse (`func.lower(User.email)`) et n'ajoute que les comptes manquants.

### D. Accès Direct & Administration (SQLAdmin)
Le panel d'administration SQLAdmin est accessible sur :
`http://localhost:8000/admin` (ou `/admin` sur votre domaine Railway).
Authentification requise avec un compte administrateur (`admin` ou `admin_manager`).

### E. Synchronisation et Migration des Utilisateurs (`sync_users_db.py`)
Un outil CLI dédié est disponible pour contrôler, inspecter et synchroniser les utilisateurs entre SQLite et PostgreSQL :
```bash
cd backend

# 1. Vérifier la connexion à la base configurée (PostgreSQL ou SQLite)
venv\Scripts\python.exe sync_users_db.py --check

# 2. Lister tous les utilisateurs présents dans la base
venv\Scripts\python.exe sync_users_db.py --list

# 3. Migrer tous les comptes de SQLite vers PostgreSQL (sans écraser les mots de passe)
venv\Scripts\python.exe sync_users_db.py --import-sqlite

# 4. Initialiser les utilisateurs et groupes par défaut si la base est vide
venv\Scripts\python.exe sync_users_db.py --seed
```
- **URL :** [http://localhost:8000/admin](http://localhost:8000/admin)
- **Permissions :** Accessible uniquement si vous êtes connecté en tant qu'utilisateur ayant le rôle `admin`.

---

## 3. Gestion des Utilisateurs & Comptes Admin

### A. Super-Administrateur Racine Intouchable (`admin_first`)
Un compte super-administrateur racine inviolable et intouchable est configuré et maintenu automatiquement dans le système :
* **Identifiants officiels :**
  - **Identifiant / Username :** `admin_first`
  - **Email :** `admin_first@eschola.pro`
  - **Mot de passe :** `Admin@1212`
  - **Rôle système :** `admin` (Super-Administrateur Racine)
* **Garanties de protection & Immunité :**
  - **Suppression impossible :** Aucune suppression n'est acceptée par l'API (`DELETE /api/v1/users/{id}`) même par un autre administrateur (HTTP 403). Le bouton Corbeille est retiré dans l'interface graphique.
  - **Rôle verrouillé :** Le rôle est invariablement fixé sur `admin`. Le menu déroulant de sélection de rôle est verrouillé et désactivé dans le frontend.
  - **Mot de passe sanctuarisé :** Aucun gestionnaire ni `admin_manager` ne peut réinitialiser le mot de passe d'`admin_first`. Le script de maintenance `reset_admin.py` exclut formellement ce compte pour préserver le mot de passe `Admin@1212`.
  - **Profil inaltérable par autrui :** Seul `admin_first` peut modifier ses propres informations personnelles depuis son profil personnel. Pour les autres gestionnaires, les contrôles affichent un cadenas verrouillé `🔒`.
  - **Réservation de l'identité :** L'identifiant `admin_first` et l'email `admin_first@eschola.pro` sont strictement réservés contre toute création publique ou administrative frauduleuse (HTTP 400).
  - **Auto-guérison au démarrage :** Exécuté via `ensure_root_admin_first(db)` à chaque démarrage du backend (en local et sur Railway dans `start.sh`).

### B. Créer le compte administrateur initial de test
Pour initialiser l'administrateur de test par défaut après l'installation de la base de données :
```bash
cd backend
venv\Scripts\activate
python create_admin.py
```
* **Identifiants créés :** 
  - **Email :** `admin`
  - **Mot de passe :** `Abc1234`
  - **Rôle :** `admin`

### C. Réinitialiser le mot de passe des administrateurs de maintenance
Pour réinitialiser les comptes administrateurs génériques (`admin`, `admin@eschola.pro`) en cas d'oubli :
```bash
cd backend
venv\Scripts\activate
python reset_admin.py Abc1234
```
* **Comptes ciblés :** `admin`, `admin@eschola.pro`, `admin@eschola.com`
* **Exclusion de sécurité :** Ce script protège expressément le compte racine `admin_first` et ne modifie **jamais** son mot de passe `Admin@1212`.

---

## 4. Gestion des Uploads & Médias

E-Schola Pro supporte l'upload de médias (images de cours, documents PDF, vidéos de cours, pièces jointes de messagerie).

### A. Stockage local
Par défaut, le backend stocke les fichiers localement dans le dossier [`backend/uploads/`](file:///d:/my%20projet/E-Schola%20Pro/backend/uploads) :
- `uploads/images/` : Images de profil et de couverture de cours.
- `uploads/documents/` : Fichiers PDF et bureautiques pour les ressources de cours.
- `uploads/videos/` : Vidéos associées aux cours.
- `uploads/chat/` : Pièces jointes partagées dans la messagerie et les classes.
- `uploads/files/` : Livrables et devoirs rendus par les étudiants.

Le dossier `uploads` est servi statiquement à l'adresse suivante :
`http://localhost:8000/uploads/`

> [!WARNING]
> En cas de déploiement en production sur des plateformes éphémères (Heroku, etc.), les fichiers locaux seront perdus à chaque redémarrage. Il convient alors de basculer vers un stockage externe.

### B. Intégration Cloudinary
Le service [`backend/app/services/cloudinary_service.py`](file:///d:/my%20projet/E-Schola%20Pro/backend/app/services/cloudinary_service.py) est prêt à être utilisé. Pour l'activer, renseignez vos clés Cloudinary dans le fichier `backend/.env` :
```env
CLOUDINARY_CLOUD_NAME="votre_cloud_name"
CLOUDINARY_API_KEY="votre_api_key"
CLOUDINARY_API_SECRET="votre_api_secret"
```
Si ces variables restent configurées sur `"your_cloud_name"` ou sont vides, le système utilise automatiquement le stockage local pour préserver le bon fonctionnement de l'application en développement.

---

## 5. Internationalisation (i18n)

Le frontend Next.js gère le multilingue (Français `fr`, Anglais `en`, Arabe `ar`) via la bibliothèque `next-intl`.

### Modifier ou Ajouter des Traductions :
Toutes les chaînes de caractères de l'interface utilisateur sont regroupées dans le dossier [`frontend/messages/`](file:///d:/my%20projet/E-Schola%20Pro/frontend/messages) :
- [`fr.json`](file:///d:/my%20projet/E-Schola%20Pro/frontend/messages/fr.json)
- [`en.json`](file:///d:/my%20projet/E-Schola%20Pro/frontend/messages/en.json)
- [`ar.json`](file:///d:/my%20projet/E-Schola%20Pro/frontend/messages/ar.json)

Si vous ajoutez une clé de traduction dans un fichier JSON, **veillez à l'ajouter également** dans les deux autres afin d'éviter les erreurs d'affichage ou les fallbacks de traduction vides.

---

## 6. Guide de Déploiement sur Railway (Intégration Continue GitHub & Isolation Base de Données)

[Railway.com](https://railway.com/) permet de déployer automatiquement l'application à chaque commit poussé sur le dépôt GitHub. Grâce à [`railway.json`](file:///d:/my%20projet/E-Schola%20Pro/railway.json) et au [`Dockerfile`](file:///d:/my%20projet/E-Schola%20Pro/Dockerfile), **E-Schola Pro** est compilé et exécuté dans un conteneur Docker unifié (Next.js 15, FastAPI, Nginx, Supervisor).

### 🛡️ Garantie d'Intégrité de la Base de Données lors des Déploiements UI
Chaque mise à jour de l'interface utilisateur (composants React, CSS, landing page, traductions i18n) poussée sur GitHub déclenche une reconstruction de l'image Docker sur Railway. L'architecture garantit l'isolation absolue des données :
1. **Zéro Écrasement Utilisateur (`SEED_DEMO_DATA=false`) :** Le script de démarrage n'injecte aucun compte de démonstration en production si un administrateur existe déjà. Les comptes, rôles, profils et mots de passe modifiés par les utilisateurs ne sont **jamais réinitialisés**.
2. **Garde-fou Anti-SQLite Éphémère :** Si l'environnement Railway est détecté sans `DATABASE_URL` PostgreSQL ni volume persistant, le backend avertit immédiatement pour empêcher toute utilisation d'une base SQLite temporaire qui disparaîtrait au prochain commit GitHub.
3. **Boucle d'Attente Résiliente (`start.sh`) :** Avant de démarrer Supervisor, le script attend jusqu'à 60 secondes la disponibilité effective de PostgreSQL (`postgres.railway.internal`).
4. **Découplage DDL de FastAPI :** L'import de l'application FastAPI n'exécute aucune modification concurrente de schéma, éliminant tout blocage de table au démarrage des workers.
5. **Healthcheck Natif Railway :** Railway surveille l'endpoint `GET /api/v1/health` configuré dans `railway.json` avant de basculer le trafic sur le nouveau conteneur.

### Étape 1 : Lancer le Déploiement
1. Connectez-vous à votre compte Railway.
2. Cliquez sur **New Project** -> **Deploy from GitHub repo** et choisissez votre dépôt `E-Schola-Pro`.
3. Railway détecte automatiquement `railway.json` et le `Dockerfile` et lance la compilation.

### Étape 2 : Configurer les Variables d'Environnement
1. Dans le tableau de bord Railway, cliquez sur le service `E-Schola-Pro` -> onglet **Variables**.
2. Renseignez les variables suivantes :
   * `DATABASE_URL` = `postgresql://postgres:JiYvfWjZyLzTVMlmlykvqEIIxFqtrnqp@postgres.railway.internal:5432/railway`
     *(Permet à la production sur Railway d'utiliser la base de données PostgreSQL centralisée)*
   * `SEED_DEMO_DATA` = `false` *(Désactive la réinjection de comptes de démo lors des redéploiements)*
   * `SECRET_KEY` = *[Votre clé secrète JWT]* (ex: générée avec `openssl rand -hex 32`)
   * `ACCESS_TOKEN_EXPIRE_MINUTES` = `10080` (7 jours)
   * `CLOUDINARY_CLOUD_NAME` = *[Votre Cloud Name]* (Requis pour médias Cloudinary)
   * `CLOUDINARY_API_KEY` = *[Votre API Key]*
   * `CLOUDINARY_API_SECRET` = *[Votre API Secret]*

3. **Synchronisation Centralisée avec le Développement Local :**
   * **Dans Railway (Postgres Service) :** Cliquez sur le service **Postgres** -> **Settings** -> **Networking** -> Cliquez sur **Add TCP Proxy** (ex: `roundhouse.proxy.rlwy.net:43210`).
   * **Dans votre environnement local (`backend/.env`) :**
     Renseignez cette URL publique :
     ```env
     DATABASE_PUBLIC_URL="postgresql://postgres:JiYvfWjZyLzTVMlmlykvqEIIxFqtrnqp@roundhouse.proxy.rlwy.net:43210/railway"
     ```
     Dès lors, le backend local et le conteneur Railway de production écrivent dans la **même et unique base PostgreSQL** en temps réel.
   * **Alternative Frontend Direct :** Dans `frontend/.env.local`, activez `NEXT_PUBLIC_API_URL="https://e-schola-pro-production.up.railway.app/api/v1"`.

### Étape 3 : Générer le Domaine Public & Vérifier le Healthcheck
1. Allez dans l'onglet **Settings** du service sur Railway.
2. Dans la section **Public Networking**, cliquez sur **Generate Domain**.
3. Vérifiez la santé du déploiement en interrogeant l'endpoint :
   `https://<votre-domaine>.up.railway.app/api/v1/health`
   qui doit retourner `{"status": "healthy", "database_alive": true, "database_engine": "postgresql"}`.

---

## 7. Résolution des Problèmes (Troubleshooting)

### A. Erreur : `port 8000` ou `3000` déjà utilisé
* **Solution :** Suivez la procédure [Arrêt propre & Libération des ports](#c-arrêt-propre--libération-des-ports) pour tuer le processus fantôme.

### B. Erreur : `OperationalError: no such table`
* **Cause :** La base de données SQLite a été créée mais les tables n'ont pas été migrées avec Alembic.
* **Solution :** Lancez la commande suivante pour mettre à jour la base :
  ```bash
  cd backend
  alembic upgrade head
   ```

### C. Problème : Images/Vidéos non affichées sur le Frontend
* **Cause :** Le serveur backend éteint (les images locales sont servies par FastAPI), ou le dossier `uploads/` a été supprimé.
* **Solution :** Lancez le backend sur le port `8000`. Vérifiez que le dossier `backend/uploads` existe bien.

### D. Problème : Déconnexion immédiate après Login
* **Cause :** Token JWT expiré ou horloge locale décalée.
* **Solution :** Videz le `localStorage` du navigateur ou augmentez la valeur de `ACCESS_TOKEN_EXPIRE_MINUTES` dans le `.env` du backend.
