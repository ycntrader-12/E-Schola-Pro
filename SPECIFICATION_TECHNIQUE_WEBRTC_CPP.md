# Spécification Technique Industrielle : Plateforme de Visioconférence Haute Performance C++ & WebRTC

**Projet :** E-Schola Pro — Moteur Médias & Visioconférence  
**Statut :** Spécification Technique d'Ingénierie Système & Architecture (Architecture Master Document)  
**Langages & Standards :** C++20 / C++23, WebRTC Native (libwebrtc M120+ / Custom SFU), FFmpeg 6.1+, gRPC, WebSockets, ONNX Runtime  
**Auteur :** Lead Software Engineer — Systèmes Distribués & Traitement Médias Temps Réel  

---

## 1. Vue d'Ensemble & Philosophie Architecturale

### 1.1 Objectifs Système & Métriques Cibles
La plateforme de visioconférence E-Schola Pro repose sur un **moteur multimédia natif en C++20/C++23** conçu pour délivrer des performances industrielles :
- **Latence Glass-to-Glass (G2G) :** $< 60\text{ ms}$ en conditions réseau nominales (UDP/SRTP).
- **Rendu Vidéo Ultra-Fluide :** Rendu constant à **60 FPS** en 1080p (Full HD) et 720p avec gestion dynamique du Simulcast et du SVC (Scalable Video Coding).
- **Consommation Mémoire & Zero-Copy :** Architecture non-bloquante avec transfert de trames en zéro-copie (`rtc::CopyOnWriteBuffer`, wrappers `AVFrame`, Ring Buffers lock-free).
- **Scalabilité Horizontale :** Modèle SFU (Selective Forwarding Unit) en étoile $O(N)$ supplantant le maillage complet P2P Mesh $O(N^2)$ pour supporter jusqu'à 500 flux simultanés par nœud de calcul.
- **Résilience Réseau Maximale :** Tolérance à 30% de perte de paquets sans dégradation perceptive grâce à NACK, RTX, FEC (FlexFEC / RED) et contrôle de congestion GCC (Google Congestion Control) / TWCC (Transport-wide Congestion Control).

```
                      +------------------------------------------+
                      |         Navigateurs & Clients Web        |
                      |   (WebRTC / Wasm / WebCodecs / HTML5)    |
                      +---------------------+--------------------+
                                            |
                         SDP / ICE / WS     |   RTP / RTCP / SRTP
                      Heartbeat / Presence  |   SCTP DataChannels
                                            |
                      +---------------------v--------------------+
                      |    Ingress Gateway & Signaling Node      |
                      |  - Boost.Beast / uWebSockets (Clients)   |
                      |  - JWT Bearer Authentication & Policies  |
                      +---------------------+--------------------+
                                            |  gRPC Bi-directionnel
                                            |  (Protobuf v3)
                      +---------------------v--------------------+
                      |     C++ Media Server (SFU Engine Core)   |
                      |  - Libwebrtc / RTP Packet Routing        |
                      |  - Simulcast & Dynamic SVC Layer Switch  |
                      |  - BWE / TWCC Bandwidth Estimation       |
                      |  - Lock-Free SPSC/MPMC Ring Buffers      |
                      +----------+--------------------+----------+
                                 |                    |
        YUV / PCM (Zero-Copy)    |                    | Audio Tap (16kHz PCM)
                                 v                    v
          +-----------------------------+      +-----------------------------+
          | FFmpeg Pipeline Worker      |      |  AI Inference Engine (C++)  |
          | - libavcodec / libavfilter  |      | - RNNoise / DeepFilterNet   |
          | - NVENC / CUDA Transcoding  |      | - ONNX Runtime / TensorRT   |
          | - MCU Grid Compositing      |      | - Whisper.cpp ASR & Diariz. |
          | - fMP4 Crash-Proof Record   |      | - MarianMT Real-Time Sub    |
          | - RTMP/HLS Live Egress      |      +-----------------------------+
          +-----------------------------+
```

---

## 2. Architecture du Moteur de Streaming WebRTC C++

### 2.1 Topologie SFU vs MCU & Routage RTP
Le système adopte une architecture **hybride SFU avec capacités MCU sélectives** :
- **Flux estándar (SFU) :** Chaque flux média (Audio/Vidéo/Écran) est publié une seule fois vers le SFU (*Uplink*). Le routeur C++ réexpédie les paquets RTP aux abonnés autorisés (*Downlink*) sans décodage ni ré-encodage, préservant le CPU hôte.
- **Flux composite & Enregistrement (MCU à la demande) :** Un sous-système FFmpeg C++ dédié s'abonne aux flux bruts, les décode via GPU, compose la grille dynamique des participants et produit un flux unique mixé pour l'enregistrement et les spectateurs passifs.

### 2.2 Gestion des Transports, Cryptographie & Connectivité
1. **ICE Agent (RFC 8445) & NAT Traversal :**
   - Implémentation via `libnice` ou la pile ICE native de `libwebrtc`.
   - Support complet de ICE Lite côté serveur et Full ICE côté client.
   - Trickle ICE (RFC 8838) pour une réduction drastique du temps d'établissement ($< 250\text{ ms}$).
2. **Négociation Cryptographique DTLS-SRTP (RFC 5763 / 5764) :**
   - Poignée de main DTLS 1.2 / 1.3 avec chiffrement `SRTP_AEAD_AES_256_GCM` ou `SRTP_AES128_CM_HMAC_SHA1_80`.
   - Révocation et rotation périodique des certificats éphémères X.509 en mémoire vive.

### 2.3 Adaptation Dynamique : Simulcast, SVC & Contrôle de Congestion
1. **Simulcast Multi-Flux :**
   - Émission simultanée de 3 profils vidéo :
     - *High (1080p @ 60 FPS, ~2.5 Mbps, qp 24)*
     - *Medium (720p @ 30 FPS, ~800 kbps, qp 28)*
     - *Low (360p @ 15 FPS, ~200 kbps, qp 34)*
2. **Scalable Video Coding (SVC - VP9 & AV1) :**
   - Profil spatial/temporel `L3T3` (3 niveaux spatiaux, 3 niveaux temporels).
   - Bascule de flux instantanée sans génération de keyframe (`PLI/FIR`), réduisant la surcharge réseau.
3. **Transport-wide Congestion Control (TWCC) & GCC :**
   - Le serveur insère l'extension d'en-tête RTP `transport-wide-cc-02`.
   - Les clients renvoient des paquets RTCP de feedback TWCC toutes les $50\text{ ms}$ (évaluation précise du RTT, gigue, perte et délai de file d'attente).
   - Algorithme d'ajustement adaptatif de débit (*AimdRateControl*) pilotant la sélection des couches spatiales/temporelles pour chaque récepteur.

---

## 3. Pipeline Média FFmpeg C++ (libav*)

### 3.1 Découpage des Responsabilités `libav*`
L'intégration directe des bibliothèques C natives de FFmpeg dans l'infrastructure C++ s'articule autour de wrappers RAII stricts :
- **`libavcodec` :** Décodage matériel NVDEC/VAAPI des flux H.264/H.265/VP9 entrants et encodage matériel NVENC ultra-rapide (`preset=p1`, `tune=ull` Ultra Low Latency).
- **`libavformat` :** Démultiplexage des paquets RTP bruts et multiplexage sécurisé en Fragmented MP4 (`fMP4`) et HLS.
- **`libavfilter` :** Graphes de filtrage pour le mixage audio 48 kHz multi-pistes et la composition d'images en mosaïque dynamique.
- **`libswscale` & `libswresample` :** Conversions de formats de pixels (YUV420P $\leftrightarrow$ RGB24) et rééchantillonnage audio (Opus 48 kHz $\leftrightarrow$ PCM 16 kHz).

### 3.2 Grille MCU Dynamique & Détection de l'Orateur Actif (Active Speaker)
Un graphe de filtres FFmpeg dynamique est instancié pour la génération du flux composite :
```
[in_peer1] scale_cuda=640:360 [v1];
[in_peer2] scale_cuda=640:360 [v2];
[in_peer3] scale_cuda=640:360 [v3];
[in_peer4] scale_cuda=640:360 [v4];
[v1][v2] hstack_cuda=inputs=2 [top_row];
[v3][v4] hstack_cuda=inputs=2 [bottom_row];
[top_row][bottom_row] vstack_cuda=inputs=2 [canvas]
```
L'analyseur d'énergie audio en temps réel sélectionne automatiquement la caméra du locuteur actif pour l'agrandir en mode « Spotlight » avec liseré lumineux coloré.

### 3.3 Enregistrement Résilient Crash-Proof (fMP4 & HLS)
- **Fragmentation Continue :** Enregistrement via le conteneur MP4 fragmenté (`-movflags empty_moov+default_base_moof+frag_every_frame`). En cas de crash serveur ou de coupure de courant, **aucun fichier n'est corrompu** car la table d'indexation n'est pas concentrée à la fin du fichier.
- **Alignement Horloge & A/V Sync :** Resynchronisation continue des paquets RTP via l'horodatage NTP des paquets RTCP Sender Reports (SR) pour éliminer tout décalage son/image sur des sessions de plusieurs heures.
- **Sortie Egress RTMP / SRT :** Publication optionnelle vers YouTube Live, Twitch ou un serveur de streaming CDN institutionnel.

---

## 4. Signalement Temps Réel : Architecture Hybride WebSockets & gRPC

### 4.1 Séparation des Responsabilités Réseau
Le signalement est scindé en deux niveaux hermétiques :
1. **Couche Edge (Client $\leftrightarrow$ Ingress) — WebSockets (WSS) :**
   - Protocole JSON binaire compact ou MsgPack sur WebSocket sécurisé.
   - Négociation SDP (`offer`, `answer`), Trickle ICE candidates, événements d'interface, chat, votes, heartbeats de présence.
   - Moteur C++ basé sur **Boost.Beast** ou **uWebSockets** (traitement de plus de 100 000 connexions par thread).
2. **Couche Inter-Services (Ingress $\leftrightarrow$ Media Server $\leftrightarrow$ Core E-Schola Pro) — gRPC / HTTP2 :**
   - Échanges haute performance typés via **Protocol Buffers v3**.
   - Allocation de ressources, création/destruction de salles, synchronisation d'état, validation des jetons JWT et persistance des présences.

### 4.2 Schéma Protobuf de Signalisation gRPC (`classroom_media.proto`)
```protobuf
syntax = "proto3";

package eschola.media.v1;

service MediaEngineService {
  rpc CreateRoomSession(CreateRoomRequest) returns (CreateRoomResponse);
  rpc TerminateRoomSession(TerminateRoomRequest) returns (TerminateRoomResponse);
  rpc NegotiatePeerTransport(stream SignalingFrame) returns (stream SignalingFrame);
  rpc BroadcastRoomMessage(BroadcastMessageRequest) returns (BroadcastMessageResponse);
  rpc RecordAttendanceBatch(AttendanceBatchRequest) returns (AttendanceBatchResponse);
  rpc GetRoomMetrics(RoomMetricsRequest) returns (RoomMetricsResponse);
}

message SignalingFrame {
  string room_id = 1;
  string session_id = 2;
  string user_id = 3;
  oneof payload {
    string sdp_offer = 4;
    string sdp_answer = 5;
    string ice_candidate = 6;
    AttendanceHeartbeat heartbeat = 7;
    VoteSubmission vote = 8;
  }
  uint64 timestamp_utc_ms = 9;
}

message AttendanceHeartbeat {
  string challenge_nonce = 1;
  string signed_hmac = 2;
  bool is_tab_active = 3;
  bool camera_enabled = 4;
  bool mic_enabled = 5;
  float audio_rms_db = 6;
}
```

---

## 5. Transfert de Fichiers Haut Débit & Gestion des Salons avec Messagerie

### 5.1 Transfert de Fichiers via SCTP DataChannels & Relais Hybride
Le transfert documentaire (polycopiés, devoirs, ressources) s'appuie sur une architecture hybride à deux vitesses :

```
             Taille du fichier <= 50 MB
             [Client Émetteur]
                    |
                    | (WebRTC DataChannel SCTP)
                    | Chunks de 64 KB / Backpressure Control
                    v
             [SFU DataRouter C++] 
                    |
                    +----(Relais Direct)----> [Clients Destinataires]
                    
             Taille du fichier > 50 MB ou Stockage Permanent
             [Client Émetteur]
                    |
                    | (HTTP/3 Multipart Chunked Upload)
                    v
             [S3 / MinIO Object Storage E-Schola Pro]
                    |
                    | Notif WebSocket Metadata (File ID, SHA-256)
                    v
             [SFU DataRouter] -------> [Diffusion du lien sécurisé pré-signé]
```

#### Protocole Binaire de Transfert par SCTP DataChannel :
- **Taille de Bloc (Chunk Size) :** $64\text{ KB}$ par message binaire pour éviter la fragmentation IP.
- **Entête de Trame (Header) :**
  ```cpp
  #pragma pack(push, 1)
  struct FileChunkHeader {
      uint32_t file_id;
      uint32_t chunk_index;
      uint32_t total_chunks;
      uint32_t chunk_payload_size;
      uint8_t  sha256_checksum[32];
  };
  #pragma pack(pop)
  ```
- **Contrôle de Flux & Backpressure :**
  - Surveillance continue de `bufferedAmount` côté émetteur.
  - Seuil d'interruption : si `bufferedAmount > 4 MB`, pause immédiate de la lecture disque.
  - Reprise sur déclenchement de l'événement `bufferedamountlow` (seuil fixé à $512\text{ KB}$).

### 5.2 Gestion des Salons & Messagerie Multi-Canaux Étanches
Le moteur C++ orchestre la salle en sous-canaux étanches :
1. **Canal Plénier (Global Room) :** Diffusion à tous les membres connectés et approuvés.
2. **Canaux de Sous-Groupes (Breakout Rooms) :** Isolation topologique des flux RTP et messages chat pour travaux pratiques par petits groupes, avec faculté pour le formateur d'écouter ou de circuler instantanément d'un sous-groupe à l'autre sans renégociation SDP globale.
3. **Canal Questions / Réponses Modéré (Q&A) :** File d'attente prioritaire avec système de vote montant (*upvoting*), marquage des réponses par le formateur et horodatage synchronisé avec la vidéo.
4. **Messagerie Privée 1-à-1 (Whisper) :** Chiffrement de bout-en-bout (E2EE) ou routage direct émetteur-récepteur avec notification sonore discrète.

---

## 6. Fonctionnalités Avancées d'Intelligence Artificielle & Traitement Médias

### 6.1 Suppression du Bruit Ambiant & Amélioration Vocale (Deep Noise Suppression)
- **Pipeline DSP C++ :** Intégration de l'APM WebRTC (*Audio Processing Module*) combiné à un réseau de neurones récurrents léger (**RNNoise** ou **DeepFilterNet2** compilé en C++ natif avec optimisations SIMD AVX2).
- **Algorithme & Latence :**
  - Fenêtrage temps-fréquence STFT sur des trames de $10\text{ ms}$ (480 échantillons à 48 kHz).
  - Estimation de gain spectral par réseau GRU pour filtrer bruits de frappe clavier, ventilateurs, réverbérations et échos résiduels.
  - Latence additionnelle imperceptible : $< 12\text{ ms}$, surcharge CPU $< 2\%$ par flux.

### 6.2 Floutage d'Arrière-Plan & Arrière-Plan Virtuel par Segmentation IA
- **Moteur d'Inférence :** **ONNX Runtime C++ API** exploitant le provider d'exécution **DirectML** (Windows) ou **TensorRT / CUDA** (Linux).
- **Modèle de Segmentation :** *MediaPipe Selfie Segmentation* ou *RobustVideoMatting (RVM)* quantifié en FP16.
- **Pipeline de Rendu d'Image :**
  1. Capture de la trame brute `AVFrame` en YUV420P.
  2. Conversion ultra-rapide YUV $\to$ RGB via Shaders Compute ou CUDA Kernel.
  3. Redimensionnement $512 \times 512$ et normalisation tensorielle.
  4. Inférence ONNX Runtime produisant le masque Alpha de découpe silhouette $\alpha \in [0.0, 1.0]$.
  5. Application d'un filtre bilatéral guidé pour lisser les contours des cheveux et des mains.
  6. Composition finale :
     $$\text{Pixel}_{\text{final}} = \alpha \times \text{Pixel}_{\text{original}} + (1 - \alpha) \times \text{Pixel}_{\text{flouté/virtuel}}$$
     où $\text{Pixel}_{\text{flouté}}$ est généré par un flou gaussien à deux passes séparables (horizontal/vertical) accéléré GPU.
  7. Ré-encodage immédiat vers le pipeline WebRTC. Temps de traitement total : $< 6\text{ ms}$ à 60 FPS.

### 6.3 Transcription Intelligente & Diarisation des Locuteurs
- **Pipeline d'Acquisition Audio :** Le routeur SFU dérive le flux Opus de chaque participant actif vers un rééchantillonneur C++ 16 kHz Mono 16-bit PCM.
- **Détection d'Activité Vocale (VAD) :** Silero VAD identifie les segments de parole actifs ($> 250\text{ ms}$).
- **Moteur de Transcription ASR :**
  - Moteur **Whisper.cpp** ou pool de workers **Faster-Whisper** communiquant via gRPC.
  - Modèle *Whisper Small / Medium* optimisé en Int8 pour une exécution quasi-temps réel (Facteur RTF $< 0.15$).
- **Diarisation des Locuteurs (Speaker Diarization) :**
  - Association immédiate du flux avec l'identifiant utilisateur E-Schola Pro via le SSRC RTP du paquet.
  - En cas de microphone partagé en salle physique : extraction d'embeddings vocaux ECAPA-TDNN pour distinguer les locuteurs distincts.
- **Génération Pédagogique Automatisée :** Agrégation continue du texte transcrit. En fin de cours, déclenchement d'un LLM pour générer automatiquement :
  - Le compte-rendu synthétique de la session.
  - Le glossaire des définitions abordées.
  - La liste des devoirs et actions à réaliser pour le prochain cours.

### 6.4 Traduction Automatique Temps Réel & Sous-Titrage Multi-Langues
- **Pipeline NMT (Neural Machine Translation) :**
  - Les segments transcrits en langue source (ex: Français) sont envoyés au moteur de traduction basé sur **MarianMT** ou **SeamlessM4T** via ONNX Runtime C++.
  - Prise en charge des langues officielles de la plateforme (Français, Arabe littéraire avec translittération phonétique, Anglais, Espagnol).
- **Diffusion Synchronisée des Sous-Titres :**
  - Envoi instantané des sous-titres traduits via le WebRTC DataChannel (paquets JSON légers avec horodatage PTS de début et fin de phrase).
  - Rendu fluide côté interface avec défilement cinétique et latence totale ASR + Traduction $< 800\text{ ms}$.
- **Piste Vocale de Doublage (Voice Dubbing Optionnel) :** Synthèse vocale neuronale (FastSpeech2 / VITS C++) injectée comme canal audio secondaire sélectionnable par l'étudiant.

---

## 7. Système de Vote & Sondages Pédagogiques Temps Réel

### 7.1 Architecture & Performance
- **Distribution Ultra-Basse Latence :** Création, diffusion et vote exécutés directement au niveau de la couche transport C++ (WebSockets / DataChannels).
- **Moteur d'Agrégation Atomique :** Calcul instantané des résultats via compteurs atomiques non-bloquants en mémoire (`std::atomic<uint32_t>`), autorisant un dépouillement en $O(1)$ sans verrouillage mutex.
- **Sécurité & Non-Répudiation :**
  - Chaque bulletin de vote est signé cryptographiquement par un HMAC-SHA256 combinant le `user_id`, le `poll_id`, l'option choisie et le jeton de session JWT.
  - Prévention absolue du double-vote par table de hachage lock-free avec clé unique `(poll_id, user_id)`.
- **Synchronisation avec le Carnet de Notes E-Schola Pro :** Les résultats des quiz et votes formatifs sont exportés directement via gRPC vers la table `quiz_submissions` et pris en compte dans le barème de notation pédagogique.

---

## 8. Module Strict de Suivi de Présence, Gestion des Retards & Absences

### 8.1 Problématique & Règles Métier Académiques
Dans le cadre de formations certifiantes et universitaires, le système doit garantir l'intégrité absolue de l'émargement numérique en éliminant les fraudes classiques (onglets fantômes en arrière-plan, abandon de poste, vidéos statiques pré-enregistrées).

### 8.2 Matrice Décisionnelle d'Assiduité
Pour une session de durée totale $T_{\text{total}}$ débutant à $H_{\text{début}}$ et se clôturant à $H_{\text{fin}}$ :

| Statut Attribué | Condition Temporelle d'Arrivée | Temps Effectif Connecté Cumulé ($T_{\text{effectif}}$) |
|---|---|---|
| 🟢 **Présent (Present)** | Heure d'arrivée $\le H_{\text{début}} + T_{\text{tolérance}}$ (ex: 10 min) | $T_{\text{effectif}} \ge 80\% \times T_{\text{total}}$ |
| 🟡 **En Retard (Late)** | $H_{\text{début}} + T_{\text{tolérance}} < \text{Arrivée} \le H_{\text{début}} + T_{\text{retard\_max}}$ (ex: 30 min) | $T_{\text{effectif}} \ge 65\% \times T_{\text{total}}$ |
| 🔴 **Absent (Absent)** | Arrivée $> H_{\text{début}} + T_{\text{retard\_max}}$ OU Aucune connexion | $T_{\text{effectif}} < 65\% \times T_{\text{total}}$ |
| 🔵 **Excusé (Excused)** | Justificatif médical ou administratif validé dans E-Schola Pro | Validé par la direction pédagogique |

### 8.3 Mécanismes Cryptographiques & Télémétrie Active
1. **Heartbeat Cryptographique par Défi-Réponse (Challenge-Response) :**
   - Toutes les 30 secondes, le serveur C++ émet un défi aléatoire (nonce cryptographique) via le DataChannel.
   - Le client dispose de $4\text{ secondes}$ pour renvoyer le nonce signé par sa clé de session, accompagné des métriques d'état du navigateur (`document.hasFocus()`, `document.visibilityState == 'visible'`).
   - Si 3 défis consécutifs échouent, le chronomètre de présence est automatiquement suspendu (*état d'absence passive*).
2. **Tolérance aux Déconnexions Réseau Intempestives :**
   - Si la connexion réseau est brutalement interrompue (coupure Wi-Fi, changement d'IP), une fenêtre de grâce de $3\text{ minutes}$ est accordée.
   - Les minutes effectives sont calculées par cumul réel des tranches actives ($\sum \Delta t_{\text{actif}}$) et non par simple soustraction entre heure de départ et d'arrivée.
3. **Vérification Passive de Présence Caméra (Liveness & Seat Detection) :**
   - Échantillonnage vidéo aléatoire toutes les 5 à 10 minutes analysé par un réseau neuronal léger de détection faciale (MediaPipe Face Mesh).
   - Détection de la présence effective d'une personne devant la caméra, alerte discrète transmise à l'enseignant en cas de siège vide prolongé ($> 5\text{ min}$).

### 8.4 Synchronisation Automatique avec la Base de Données E-Schola Pro
Dès la fin de la visioconférence (action de l'hôte ou clôture programmée), le serveur média compile le rapport d'assiduité et déclenche l'endpoint gRPC/REST pour insérer ou mettre à jour la table `attendances` :
```sql
INSERT INTO attendances (
    student_id, course_id, session_date, status, 
    connection_time, disconnection_time, duration_minutes,
    late_minutes, remarks
) VALUES (
    :uid, :course_id, CURRENT_DATE, :computed_status,
    :first_seen, :last_seen, :total_active_mins,
    :late_mins, :automated_audit_report
);
```
Un email d'alerte automatique et une notification push sont immédiatement envoyés aux apprenants en retard ou absents, ainsi qu'aux tuteurs en entreprise pour les stagiaires et apprentis.

---

## 9. Implémentation de Référence en C++20 (Extraits d'Ingénierie)

### 9.1 Définition du Moteur Routeur Médias (`MediaRouterEngine.hpp`)
```cpp
#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <shared_mutex>
#include <boost/asio.hpp>
#include <rtc/rtc.hpp> // Libdatachannel / WebRTC Native

namespace eschola::media {

struct PeerSession {
    std::string user_id;
    std::string role;
    std::shared_ptr<rtc::PeerConnection> peer_connection;
    std::shared_ptr<rtc::DataChannel> data_channel;
    std::unordered_map<std::string, std::shared_ptr<rtc::Track>> video_tracks;
    std::unordered_map<std::string, std::shared_ptr<rtc::Track>> audio_tracks;
    
    // Télémétrie d'assiduité
    std::chrono::steady_clock::time_point joined_at;
    std::chrono::steady_clock::time_point last_heartbeat;
    uint32_t active_seconds{0};
    bool is_in_focus{true};
};

class RoomMediaRouter {
public:
    explicit RoomMediaRouter(std::string room_id, boost::asio::io_context& ioc);
    ~RoomMediaRouter();

    void AddPeer(const std::string& user_id, const std::string& role);
    void RemovePeer(const std::string& user_id);
    void HandleOffer(const std::string& user_id, const std::string& sdp);
    void HandleIceCandidate(const std::string& user_id, const std::string& candidate);
    
    // Distribution des flux & DataChannels
    void RouteRtpPacket(const std::string& source_user_id, const uint8_t* data, size_t len);
    void BroadcastChatMessage(const std::string& sender_id, const std::string& channel, const std::string& payload);
    
    // Cycle de présence
    void ProcessHeartbeatTick();
    void FinalizeSessionAttendance();

private:
    std::string m_room_id;
    boost::asio::io_context& m_ioc;
    mutable std::shared_mutex m_mutex;
    std::unordered_map<std::string, std::shared_ptr<PeerSession>> m_peers;
    std::atomic<bool> m_is_recording{false};
};

} // namespace eschola::media
```

### 9.2 Routeur de Paquets RTP avec Forwarding Zéro-Copie (`MediaRouterEngine.cpp`)
```cpp
#include "MediaRouterEngine.hpp"
#include <iostream>

namespace eschola::media {

void RoomMediaRouter::RouteRtpPacket(const std::string& source_user_id, const uint8_t* data, size_t len) {
    // Lecture concurrente optimisée sans blocage exclusif
    std::shared_lock<std::shared_mutex> lock(m_mutex);
    
    for (const auto& [peer_id, peer] : m_peers) {
        if (peer_id == source_user_id) continue; // Pas d'écho local vers l'émetteur

        // Réexpédition directe du paquet RTP sans décodage (Zéro-Copie SFU)
        if (peer->peer_connection && peer->peer_connection->state() == rtc::PeerConnection::State::Connected) {
            try {
                // Routage sélectif selon la souscription
                for (auto& [track_id, track] : peer->video_tracks) {
                    if (track->isOpen()) {
                        track->send(reinterpret_cast<const std::byte*>(data), len);
                    }
                }
            } catch (const std::exception& e) {
                std::cerr << "[SFU Error] Failed to forward RTP to " << peer_id << ": " << e.what() << '\n';
            }
        }
    }
}

void RoomMediaRouter::ProcessHeartbeatTick() {
    std::unique_lock<std::shared_mutex> lock(m_mutex);
    auto now = std::chrono::steady_clock::now();

    for (auto& [user_id, peer] : m_peers) {
        auto elapsed_since_hb = std::chrono::duration_cast<std::chrono::seconds>(now - peer->last_heartbeat).count();
        
        // Si le heartbeat a été validé récemment et que la fenêtre est active
        if (elapsed_since_hb <= 40 && peer->is_in_focus) {
            peer->active_seconds += 1;
        } else if (elapsed_since_hb > 40) {
            std::cout << "[Assiduité Alert] Heartbeat manqué pour l'utilisateur : " << user_id << std::endl;
        }
    }
}

} // namespace eschola::media
```

### 9.3 Pipeline d'Inférence ONNX Runtime pour Floutage Silhouette (`BackgroundMattingFilter.cpp`)
```cpp
#include <onnxruntime_cxx_api.h>
#include <opencv2/opencv.hpp>

class BackgroundSegmentationEngine {
public:
    BackgroundSegmentationEngine(const wchar_t* model_path) 
        : m_env(ORT_LOGGING_LEVEL_WARNING, "EscholaSegmentation") {
        
        Ort::SessionOptions session_options;
        session_options.SetIntraOpNumThreads(4);
        session_options.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
        
        // Activation CUDA / DirectML si disponible
        // OrtSessionOptionsAppendExecutionProvider_CUDA(session_options, 0);

        m_session = std::make_unique<Ort::Session>(m_env, model_path, session_options);
    }

    void ProcessFrame(cv::Mat& input_bgr, cv::Mat& output_bgr, bool apply_blur) {
        // 1. Prétraitement : Redimensionnement et normalisation tensorielle
        cv::Mat resized;
        cv::resize(input_bgr, resized, cv::Size(512, 512));
        cv::cvtColor(resized, resized, cv::COLOR_BGR2RGB);
        resized.convertTo(resized, CV_32FC3, 1.0 / 255.0);

        // 2. Préparation du Tensor d'entrée NCHW
        std::vector<int64_t> input_shape = {1, 3, 512, 512};
        std::vector<float> input_tensor_values(1 * 3 * 512 * 512);
        
        // HWC to CHW
        for (int c = 0; c < 3; ++c) {
            for (int h = 0; h < 512; ++h) {
                for (int w = 0; w < 512; ++w) {
                    input_tensor_values[c * 512 * 512 + h * 512 + w] = resized.at<cv::Vec3f>(h, w)[c];
                }
            }
        }

        auto memory_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
        Ort::Value input_tensor = Ort::Value::CreateTensor<float>(
            memory_info, input_tensor_values.data(), input_tensor_values.size(),
            input_shape.data(), input_shape.size()
        );

        // 3. Inférence Neuronale ONNX
        const char* input_names[] = {"input_image"};
        const char* output_names[] = {"output_alpha"};
        
        auto output_tensors = m_session->Run(
            Ort::RunOptions{nullptr}, input_names, &input_tensor, 1, output_names, 1
        );

        // 4. Extraction du masque Alpha
        float* alpha_data = output_tensors.front().GetTensorMutableData<float>();
        cv::Mat alpha_mask(512, 512, CV_32FC1, alpha_data);
        cv::resize(alpha_mask, alpha_mask, input_bgr.size());

        // 5. Floutage et Composition
        cv::Mat background;
        if (apply_blur) {
            cv::GaussianBlur(input_bgr, background, cv::Size(51, 51), 0);
        } else {
            background = cv::Mat(input_bgr.size(), input_bgr.type(), cv::Scalar(240, 240, 240)); // Fond studio
        }

        output_bgr.create(input_bgr.size(), input_bgr.type());
        for (int y = 0; y < input_bgr.rows; ++y) {
            for (int x = 0; x < input_bgr.cols; ++x) {
                float a = alpha_mask.at<float>(y, x);
                cv::Vec3b fg = input_bgr.at<cv::Vec3b>(y, x);
                cv::Vec3b bg = background.at<cv::Vec3b>(y, x);
                
                output_bgr.at<cv::Vec3b>(y, x) = cv::Vec3b(
                    static_cast<uchar>(a * fg[0] + (1.0f - a) * bg[0]),
                    static_cast<uchar>(a * fg[1] + (1.0f - a) * bg[1]),
                    static_cast<uchar>(a * fg[2] + (1.0f - a) * bg[2])
                );
            }
        }
    }

private:
    Ort::Env m_env;
    std::unique_ptr<Ort::Session> m_session;
};
```

---

## 10. Matrice de Dimensionnement Matériel & Scalabilité

| Métrique Système | Déploiement Local / Salle TP | Serveur Institutionnel (Cluster Dédié) | Cloud Haute Disponibilité |
|---|---|---|---|
| **Participants Simultanés** | 10 à 30 pairs | 100 à 300 pairs | 1 000+ pairs (Fédération de nœuds) |
| **Bande Passante Réseau** | 50 Mbps montants / 100 Mbps descendants | 1 Gbps full-duplex dédié | 10 Gbps redondé par région |
| **CPU Recommandé** | 8 cœurs (Intel Core i7 / AMD Ryzen 7) | 32 cœurs (AMD EPYC / Intel Xeon Gold) | Multiples instances c6g.8xlarge |
| **Accélération Graphique** | NVIDIA RTX 3060 / 4060 (8 Go VRAM) | NVIDIA RTX A4000 ou T4 (16 Go) | NVIDIA L4 / A10G Cloud Instances |
| **Débit Encodage FFmpeg** | 2 sessions composites 1080p 60 FPS | 10 sessions composites simultanées | Scalabilité automatique autoscaling |
| **Inférence IA (Bruit + Flou)** | CPU AVX2 ou CUDA local | GPU TensorRT FP16 partagé | Triton Inference Server dédié |

---

## 11. Plan d'Intégration & Déploiement dans E-Schola Pro

1. **Phase 1 : Conteneurisation & Découplage Microservices**
   - Emballage du binaire C++ dans une image Docker minimale `eschola-media-sfu:v1.0` (base Ubuntu 22.04 LTS ou Alpine avec glibc).
   - Exposition du port WebSocket WSS (ex: `8443`) et de la plage UDP WebRTC (`40000-45000/udp`).
2. **Phase 2 : Pont gRPC avec FastAPI Core**
   - Mise à disposition d'un client gRPC Python dans `backend/app/services/media_sfu_client.py`.
   - Synchronisation bidirectionnelle des événements : ouverture de salle, vérification des rôles, émargement automatisé et arrêt d'urgence.
3. **Phase 3 : Intégration Frontend Next.js 15**
   - Modernisation de `sfuClient.ts` pour exploiter les DataChannels SCTP, l'inversion de caméra et l'affichage des sous-titres traduits.
   - Intégration du composant de vote instantané et du badge d'assiduité dynamique en temps réel.

---
*Ce document fait foi de spécification technique de référence pour l'implémentation du sous-système de visioconférence native C++ E-Schola Pro.*
