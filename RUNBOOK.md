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

## 2. Gestion de la Base de Données (SQLite & Alembic)

E-Schola Pro utilise **SQLite** en local avec le fichier [`eschola.db`](file:///d:/my%20projet/E-Schola%20Pro/backend/eschola.db) situé dans le dossier `backend`.

> [!NOTE]
> Au démarrage du backend, FastAPI exécute automatiquement `Base.metadata.create_all(bind=engine)` (dans `app/main.py`), ce qui crée le fichier SQLite et toutes les tables s'ils n'existent pas. Cependant, pour un suivi propre du schéma de base de données, l'utilisation d'Alembic est fortement recommandée.

### A. Appliquer les migrations de base de données
Lorsque vous téléchargez des modifications de code contenant des mises à jour de modèles, appliquez les dernières migrations :
```bash
cd backend
venv\Scripts\activate
alembic upgrade head
```

### B. Créer une nouvelle migration de schéma
Si vous modifiez ou ajoutez un modèle SQLAlchemy dans `backend/app/models/` :
1. Assurez-vous d'importer le nouveau modèle dans `backend/app/db/base.py` pour qu'Alembic le détecte.
2. Générez la migration automatique :
   ```bash
   alembic revision --autogenerate -m "description_de_la_modification"
   ```
3. Vérifiez le fichier généré dans `backend/alembic/versions/`.
4. Appliquez-le :
   ```bash
   alembic upgrade head
   ```

### C. Gestion des Verrous de Base de Données SQLite
Par défaut, SQLite peut lever une erreur `sqlite3.OperationalError: database is locked` si plusieurs transactions d'écriture simultanées ont lieu.
- **Bonne pratique :** Toujours fermer les sessions de base de données dans le code (géré automatiquement par FastAPI via le pattern de dépendance dans `deps.py` qui produit et ferme la session `db`).
- **En cas de blocage persistant :** Redémarrez le serveur FastAPI pour tuer les connexions persistantes sur le fichier `eschola.db`.

### D. Accès Direct & Administration (SQLAdmin)
Le panel d'administration Web SQLAdmin offre une interface complète pour manipuler les données.
- **URL :** [http://localhost:8000/admin](http://localhost:8000/admin)
- **Permissions :** Accessible uniquement si vous êtes connecté en tant qu'utilisateur ayant le rôle `admin`.

---

## 3. Gestion des Utilisateurs & Comptes Admin

### A. Créer le compte administrateur initial
Pour initialiser un administrateur par défaut après l'installation de la base de données :
```bash
cd backend
venv\Scripts\activate
python create_admin.py
```
* **Identifiants créés :** 
  - **Email :** `admin`
  - **Mot de passe :** `Abc1234`
  - **Rôle :** `admin`

### B. Réinitialiser le mot de passe de l'administrateur
Si le compte administrateur standard (`admin@eschola.com`) doit être réinitialisé :
```bash
cd backend
venv\Scripts\activate
python reset_admin.py
```
* **Nouveaux identifiants :**
  - **Email :** `admin@eschola.com`
  - **Mot de passe :** `admin123`

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

## 6. Guide de Déploiement sur Railway (Méthode Simplifiée - Conteneur Unique)

[Railway.com](https://railway.com/) permet de déployer facilement des applications à partir d'un dépôt GitHub. Grâce au `Dockerfile` présent à la racine du dépôt, **E-Schola Pro** est automatiquement configuré pour compiler et s'exécuter dans un **conteneur Docker unique** combinant le frontend Next.js, le backend FastAPI et un serveur reverse-proxy Nginx.

### Étape 1 : Lancer le Déploiement
1. Connectez-vous à votre compte Railway.
2. Cliquez sur **New Project** -> **Deploy from GitHub repo** et choisissez votre dépôt `E-Schola-Pro`.
3. Railway va détecter le `Dockerfile` à la racine et lancer automatiquement la compilation et le déploiement du conteneur unifié.

### Étape 2 : Configurer les Variables d'Environnement
1. Une fois le service créé sur Railway, cliquez sur le bloc du service (`E-Schola-Pro`) et allez dans l'onglet **Variables**.
2. Ajoutez les variables d'environnement suivantes :
   * `DATABASE_URL` = `sqlite:///./eschola.db` (ou URL PostgreSQL, ex: `postgresql://...`)
   * `SECRET_KEY` = *[Votre clé secrète JWT]* (ex: générée avec `openssl rand -hex 32`)
   * `ACCESS_TOKEN_EXPIRE_MINUTES` = `10080` (7 jours)
   * `CLOUDINARY_CLOUD_NAME` = *[Votre Cloud Name]* (Requis pour médias Cloudinary)
   * `CLOUDINARY_API_KEY` = *[Votre API Key]*
   * `CLOUDINARY_API_SECRET` = *[Votre API Secret]*
3. **Persistance Permanente des Données sur Railway :**
   * **Méthode Recommandée (Volume Railway) :** Dans Railway, ajoutez un **Volume** à votre service avec le point de montage `/app/backend/data` (ou `/data`). Le backend détecte automatiquement `RAILWAY_VOLUME_MOUNT_PATH` et y stocke `eschola.db`.
   * **Alternative explicite :** Définissez `DATABASE_URL=sqlite:////app/backend/data/eschola.db`.
   * **Mode SQLite WAL :** Le backend active automatiquement le mode `PRAGMA journal_mode=WAL` pour une haute concurrence et une persistance disque immédiate sans verrouillage.
   * **Non-destructivité des comptes :** Le script d'initialisation (`create_admin.py`) est strictement non-destructif : il ne réécrit jamais les mots de passe modifiés ni les changements de rôle lors des redémarrages.

### Étape 3 : Générer le Domaine Public
1. Allez dans l'onglet **Settings** du service sur Railway.
2. Dans la section **Public Networking**, cliquez sur **Generate Domain** (ou configurez votre nom de domaine personnalisé).
3. L'application est maintenant accessible en ligne via cette adresse unique (Nginx gère intelligemment la répartition du trafic vers Next.js et l'API FastAPI en interne).

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
