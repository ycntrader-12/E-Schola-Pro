# 🎓 E-Schola Pro — Plateforme de Gestion Éducative Intégrée & Campus Numérique

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?logo=next.js)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%26%20SQLite-336791?logo=postgresql)](https://postgresql.org)
[![WebRTC](https://img.shields.io/badge/Streaming-WebRTC%20SFU%20%26%20C%2B%2B20-blue?logo=webrtc)](https://webrtc.org)
[![FFmpeg](https://img.shields.io/badge/Media%20Pipeline-FFmpeg%206.1%20NVENC-007808?logo=ffmpeg)](https://ffmpeg.org)
[![Railway](https://img.shields.io/badge/Deploy-Railway%20Cloud-0B0D0E?logo=railway)](https://railway.app)
[![OWASP](https://img.shields.io/badge/Security-OWASP%20Hardened-blue?logo=owasp)](https://owasp.org)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)

**E-Schola Pro** est une plateforme éducative industrielle complète et moderne, conçue pour unifier les flux de travail des administrateurs, des formateurs et des apprenants (étudiants, stagiaires, employés) au sein d'un écosystème numérique rapide, esthétique et hautement sécurisé.

---

## 🚀 Démarrage Rapide

### Lancement en un clic (Windows)
Pour démarrer simultanément le backend FastAPI et le frontend Next.js en développement local :
👉 Double-cliquez sur [`start_all.bat`](start_all.bat)

- **Application Web (Frontend) :** [http://localhost:3000](http://localhost:3000)
- **Documentation API Interactive (Swagger) :** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Console d'Administration SQLAdmin :** [http://localhost:8000/admin](http://localhost:8000/admin)
- **Portail de Documentation Technique Complète :** [Documentation_Technique_E-Schola_Pro.html](Documentation_Technique_E-Schola_Pro.html)
- **Spécification Moteur C++ & WebRTC :** [SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md](SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md)

---

## 🎥 Moteur de Visioconférence WebRTC SFU & Streaming Vidéo Haute Performance

E-Schola Pro intègre une suite multimédia de pointe pour les classes virtuelles et la diffusion de cours vidéo :

### 1. Spécification Industrielle du Moteur Média Natif C++20 / C++23
*Document d'architecture complet :* [`SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md`](SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md)
* **Architecture SFU en Étoile $O(N)$ :** Suppression du maillage P2P saturant au profit d'un routage de paquets RTP zéro-copie (`rtc::CopyOnWriteBuffer`, Ring Buffers lock-free) pour supporter jusqu'à 500 flux simultanés par nœud avec une latence interne $< 2\text{ ms}$.
* **Simulcast & SVC Dynamique (VP9/AV1 profil L3T3) :** Bascule instantanée de couche spatiale/temporelle sans demande de keyframe PLI/FIR. Régulation TWCC/GCC (RFC 8888).
* **Pipeline FFmpeg 6.1+ & Accélération GPU NVENC/CUDA :** Composition dynamique de mosaïques multi-caméras (*Active Speaker Spotlight*) et enregistrement crash-proof en Fragmented MP4 (`fMP4`) avec segmentation HLS.
* **Signalement Hybride Découplé :** WebSockets (Boost.Beast / uWebSockets) pour les clients web et gRPC bidirectionnel (`classroom_media.proto`) pour les échanges inter-services.
* **Transfert de Fichiers Haut Débit par DataChannels SCTP :** Chunks de 64 KB avec régulation de flux (backpressure) et relais automatique S3/MinIO au-delà de 50 Mo.
* **Intelligence Artificielle Temps Réel :**
  - *Suppression de bruit neuronale (DSP + RNNoise / DeepFilterNet2 AVX2).*
  - *Floutage d'arrière-plan & arrière-plan virtuel par inférence ONNX Runtime (DirectML / TensorRT FP16).*
  - *Transcription continue Whisper.cpp avec diarisation des locuteurs par SSRC et résumés pédagogiques par LLM.*
  - *Traduction automatique temps réel (MarianMT / SeamlessM4T) avec sous-titres DataChannel sub-seconde.*
* **Système de Vote Atomique Cryptographique :** Bulletins signés par HMAC-SHA256, dépouillement en mémoire $O(1)$ sans mutex (`std::atomic<uint32_t>`).
* **Module Strict de Suivi de Présence :** Défi-réponse cryptographique toutes les 30 secondes, détection passive de présence caméra (liveness), calcul d'assiduité cumulée ($\sum \Delta t$) et écriture transactionnelle en base de données.

### 2. Streaming Vidéo Résilient pour les Cours (`YoutubePlayer.tsx`)
* **Support Natif HTTP 206 Partial Content (Range Requests) :** Distribution par Nginx `sendfile` autorisant la recherche instantanée (seeking) et éliminant tout blocage de lecture.
* **En-têtes CORS Universels :** `Access-Control-Allow-Origin: *`, `Accept-Ranges: bytes` et exposition de `Content-Range` pour garantir la compatibilité totale avec l'API Web Audio (Audio Boost jusqu'à 200%).
* **Normalisation d'URL Intelligente :** Conversion automatique des URL locales (`http://localhost:8000`) en chemins relatifs `/uploads/...`.
* **Diagnostic d'Erreur Visuel :** Volet contextuel interactif détaillant l'erreur (404, réseau/CORS, codec) avec boutons *« Réessayer »* et *« Tester le flux direct »*.
* **Persistance Automatique sur Railway :** Liaison symbolique dynamique vers le volume persistant (`/data` ou `$RAILWAY_VOLUME_MOUNT_PATH`) dans `start.sh` protégeant les médias des redémarrages.

---

## 🛡️ Sécurité Industrielle & Protection Anti-Menaces (Local & Railway)

Le système de messagerie et les endpoints de la plateforme intègrent un blindage multicouche conforme aux recommandations **OWASP** :

| Vecteur d'Attaque / Menace | Risque | Protection Déployée |
| :--- | :--- | :--- |
| **XSS Stocké & Injections HTML** | Injection de `<script>`, `<iframe>` ou d'événements JS (`onerror=`, `onclick=`) dans les messages | **Désinfection systématique** (`app/core/sanitizer.py`). Éradication de toutes les balises et attributs dangereux avant persistance. |
| **Attaque XSS via Pièces Jointes** | Exécution de JavaScript via `attachment_url` (`javascript:...`, `data:text/html;base64,...`) | **Validation stricte de protocole** : Seuls `http://`, `https://`, `/uploads/` et images Base64 sont autorisés. Rejet immédiat avec code **HTTP 400**. Vérification défensive additionnelle dans l'interface React. |
| **Malware, WebShells & DoS Fichier** | Upload de fichiers exécutables (`.exe`, `.bat`, `.sh`, `.php`, `.js`, etc.) ou saturation de disque | **Liste noire stricte** dans `app/api/v1/upload.py`, assainissement contre les traversées de répertoires (*Path Traversal* `../`), et **limite streaming de 25 Mo / 60 Mo vidéo** (rejet **HTTP 413**). |
| **IDOR & Fuite de Messages Privés** | Exfiltration de messages confidentiels via `POST /{id}/report` ou suppression frauduleuse | **Vérification d'accès stricte** : un utilisateur ne peut consulter, supprimer ou signaler qu'un message dont il est le destinataire direct ou l'expéditeur (**HTTP 403**). |
| **Spam, Flooding & Déni de Service (DoS)** | Scripts automatisés bombardant la base PostgreSQL pour épuiser les connexions | **Limiteur de débit par fenêtre glissante** (`app/core/rate_limiter.py`) : max **25 messages/min** et **5 signalements/min** par utilisateur (**HTTP 429** avec `Retry-After`). |
| **Spam Broadcast / Envoi Massif** | Envois massifs non autorisés à tous les membres par des étudiants | Rôle restreint sur `is_broadcast` et **plafond anti-spam de 10 destinataires max** pour les rôles étudiants et employés. |
| **Clickjacking & Sécurité Réseau Railway** | Reniflage MIME, détournement d'iframe, requêtes cross-origin non autorisées | Middleware FastAPI et Nginx injectant les **en-têtes de sécurité OWASP** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `Referrer-Policy`, CSP avec `frame-src`). |

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
4. **Volumes Persistants pour les Téléversements (`/uploads`) :**
   - Liaison symbolique automatique configurée dans `start.sh` vers le volume Railway (`/data/uploads` ou `$RAILWAY_VOLUME_MOUNT_PATH/uploads`).

---

## 🛠️ Stack Technologique

### Frontend
- **Framework :** [Next.js 15](https://nextjs.org) (App Router, Server & Client Components)
- **UI & Icônes :** React 19, [Lucide React](https://lucide.dev)
- **Langage :** TypeScript (mode strict, validation 100 % sans erreur)
- **Design System :** CSS Vanilla & Tailwind moderne (Glassmorphism, thèmes Sombre/Clair, animations GPU 60 FPS)
- **Internationalisation :** `next-intl` (Français, Anglais, Arabe avec support RTL complet)
- **Lecteur Média :** `YoutubePlayer.tsx` avec streaming HTTP 206, normalisation d'URL, diagnostic d'erreur et Web Audio API
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

### Infrastructure & Déploiement
- **Serveur Web / Reverse Proxy :** Nginx avec distribution `sendfile`, support Range requests et CORS
- **Orchestration Multi-Services :** Supervisord (FastAPI sur port 8000, Next.js sur port 3001, Nginx en frontal sur port $PORT)
- **Conteneurisation :** Docker multi-stage build unifié

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
│   │   │   │   ├── upload.py            # Upload sécurisé anti-malware (images, vidéos, fichiers)
│   │   │   │   ├── courses.py           # Gestion des cours, vidéos de cours, inscriptions
│   │   │   │   └── ...                  # Quiz, Présences, Devoirs, Groupes, Invitations
│   │   │   └── deps.py                  # Injection de dépendances et session DB
│   │   ├── core/
│   │   │   ├── config.py                # Résolution variables d'environnement & Railway
│   │   │   ├── rate_limiter.py          # Limiteur de débit à fenêtre glissante (HTTP 429)
│   │   │   ├── sanitizer.py             # Désinfection XSS, validation URL & extensions
│   │   │   └── security.py              # Hachage bcrypt et création de jetons JWT
│   │   ├── models/                      # Modèles ORM SQLAlchemy (User, CourseVideo, Classroom, etc.)
│   │   ├── schemas/                     # Schémas de validation Pydantic v2
│   │   └── main.py                      # Application FastAPI, headers OWASP et CORS
│   ├── requirements.txt                 # Dépendances Python
│   └── start.sh                         # Script de démarrage Docker avec auto-link volume persistant
├── frontend/                            # Client Next.js 15 (App Router)
│   ├── src/
│   │   ├── app/[locale]/
│   │   │   ├── inbox/                   # Boîte de messagerie Gmail-style sécurisée
│   │   │   ├── profile/                 # Profil utilisateur & portail admin
│   │   │   ├── classroom/               # Classes virtuelles visioconférence SFU
│   │   │   ├── courses/                 # Catalogue de cours, dossiers et lecteur vidéo
│   │   │   └── ...                      # Quiz, Devoirs, Présences, Groupes
│   │   ├── components/
│   │   │   ├── video/
│   │   │   │   └── YoutubePlayer.tsx    # Lecteur vidéo universel avec Range streaming & diagnostic
│   │   │   └── ...                      # Composants réutilisables (Modales, Navbar, etc.)
│   │   └── lib/api.ts                   # Client Axios configuré
│   ├── messages/                        # Dictionnaires i18n (fr.json, en.json, ar.json)
│   └── package.json                     # Dépendances Node.js
├── nginx.conf                           # Configuration Nginx (sendfile, Range requests, CORS)
├── supervisord.conf                     # Orchestrateur de processus (FastAPI + Next.js + Nginx)
├── Dockerfile                           # Image unifiée multi-stage prête pour Railway Cloud
├── start_all.bat                        # Script de lancement global pour Windows
├── SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md # Spécification d'ingénierie C++ WebRTC SFU/MCU
└── Documentation_Technique_E-Schola_Pro.html # Documentation technique officielle complète
```

---

## 🌟 Fonctionnalités Principales

* 💬 **Messagerie Inbox Sécurisée :** Boîte de réception inspirée de Gmail, multi-destinataires, copie carbone (CC), brouillons, corbeille, favoris (⭐), recherche multi-modes (Interne, Google Web, Assistant IA Gemini), signalement de sécurité immédiat aux administrateurs/formateurs et protection anti-spam.
* 👤 **Gestion des Utilisateurs & Avatars :** Profil complet par rôle (Admin, Formateur, Étudiant, Stagiaire, Employé), téléversement et optimisation instantanée des photos en WebP 256×256 stockées en Base64 dans Railway PostgreSQL.
* 📚 **Gestion des Cours & Dossiers Pédagogiques :** Organisation des cours par dossiers thématiques, chapitres vidéo avec lecteur HD, support des requêtes HTTP 206 Byte-Range, documents PDF et suivi de progression des apprenants.
* 📹 **Classes Virtuelles & Visioconférence WebRTC SFU :** Grille vidéo dynamique 60 FPS indexée sur les pairs réels, zéro tuile factice, modale d'invitation multi-cibles, admission instantanée, carillon sonore et chat segmenté.
* 🏆 **Quiz & Évaluations :** Création de QCM chronométrés, notation automatique, calcul du score sur 20 et publication instantanée des résultats.
* 📋 **Feuille de Présences & Émargement :** Pointage d'assiduité par séance avec statuts détaillés (Présent, Retard, Absent, Excusé) et statistiques personnelles pour les apprenants.
* 📅 **Agenda & Calendrier :** Planification des sessions et échéances avec filtrage mensuel et soumission de livrables liés.
* 👥 **Groupes & Promotions :** Gestion des promotions et affectation ciblée des étudiants avec contrôle d'accès strict.
* ⚙️ **Panel SQLAdmin & Console d'Administration :** Visualisation et manipulation sécurisée des tables de données, monitoring des sessions actives, journal d'audit filtrable et exports JSON SHA-256.

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

### 3. Tests de Visioconférence WebRTC & Signalisation
```bash
python backend/test_classroom_sfu_signaling.py
```
*Validation : WebSocket SFU, admission instantanée, blocage d'utilisateurs et chat multi-canaux.*

### 4. Vérification TypeScript Frontend
```bash
cd frontend && npm run build
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

# Sur Railway :
DATABASE_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_PRIVATE_DOMAIN}}:5432/${{PGDATABASE}}

# Point de montage du volume persistant Railway :
RAILWAY_VOLUME_MOUNT_PATH=/data
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
# Sur Railway (Production unifiée via Nginx) :
# NEXT_PUBLIC_API_URL=/api/v1
```

---

## 📖 Documentations de Référence

1. **Portail de Documentation Technique Industrielle :**  
   Consultez [Documentation_Technique_E-Schola_Pro.html](Documentation_Technique_E-Schola_Pro.html) pour explorer les modèles de données (ORM), les endpoints REST, la matrice des permissions RBAC et l'architecture frontend.
2. **Spécification Moteur C++ & WebRTC SFU :**  
   Consultez [SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md](SPECIFICATION_TECHNIQUE_WEBRTC_CPP.md) pour les détails d'implémentation bas niveau du serveur média, de l'encodage FFmpeg et des modules IA.
