"""
Classroom Signaling & WebRTC SFU Manager
Fournit un serveur de signalisation temps réel ultra-performant via WebSocket pour :
- La gestion d'état des salles et la validation des codes d'accès
- La salle d'attente (Waiting Room) avec actions : knock, admit, reject, block, kick
- La signalisation WebRTC SFU (publication de pistes, distribution sélective, SDP, ICE)
- La segmentation stricte du chat (global, privé 1-à-1, sous-groupes)
- Les alertes de présence et de média (micro, caméra, partage d'écran, niveau audio)
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.database import SessionLocal
from app.models.classroom import Classroom
from app.models.user import User
from app.services.mediasoup_sfu import mediasoup_sfu_manager

logger = logging.getLogger("classroom_signaling")



class ClassroomSignalingManager:
    def __init__(self):
        # room_id -> dict with session state
        # {
        #   "instructor_id": int,
        #   "title": str,
        #   "requires_approval": bool,
        #   "clients": { user_id: { "ws": WebSocket, "user": dict, "joined_at": str } },
        #   "waiting_room": { user_id: { "ws": WebSocket, "user": dict, "requested_at": str } },
        #   "admitted_user_ids": set(),
        #   "blocked_user_ids": set(),
        #   "published_tracks": { user_id: { "audio": dict, "video": dict, "screen": dict } },
        #   "media_states": { user_id: dict },
        #   "subgroups": dict,
        #   "chat_history": list
        # }
        self._rooms: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def _get_or_create_room(self, room_id: str, classroom: Classroom) -> Dict[str, Any]:
        cleaned_id = room_id.strip().lower()
        if cleaned_id not in self._rooms:
            # Parse existing allowed users into admitted set
            admitted = set()
            if classroom.allowed_users:
                for token in classroom.allowed_users.split(","):
                    tok = token.strip()
                    if tok.isdigit():
                        admitted.add(int(tok))

            self._rooms[cleaned_id] = {
                "instructor_id": classroom.instructor_id,
                "title": classroom.title,
                "requires_approval": bool(classroom.requires_approval),
                "clients": {},
                "waiting_room": {},
                "admitted_user_ids": admitted,
                "blocked_user_ids": set(),
                "published_tracks": {},
                "media_states": {},
                "subgroups": {"is_active": False, "timer_minutes": 15, "subgroups": []},
                "chat_history": [],
            }
        return self._rooms[cleaned_id]

    async def authenticate_ws(self, websocket: WebSocket, token: Optional[str]) -> Optional[Dict[str, Any]]:
        """Valide le token JWT et extrait les données utilisateur."""
        if not token:
            return None
        try:
            payload = decode_token(token)
            if not payload or "sub" not in payload:
                return None
            user_id = payload.get("sub")
            if not user_id:
                return None

            with SessionLocal() as db:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if not user or (hasattr(user, "is_active") and user.is_active is False):
                    return None
                user_name = f"{user.prenom or ''} {user.nom or ''}".strip() or user.username or user.email.split("@")[0]
                return {
                    "id": user.id,
                    "email": user.email,
                    "name": user_name,
                    "role": user.role,
                    "group_name": user.group_name or "",
                }
        except Exception as err:
            logger.warning(f"Erreur d'authentification WebSocket: {err}")
            return None

    def is_host(self, room: Dict[str, Any], user: Dict[str, Any]) -> bool:
        """Détermine si l'utilisateur a les droits d'hôte/modérateur."""
        if user["id"] == room["instructor_id"]:
            return True
        role = (user.get("role") or "").lower()
        return role in ["admin", "admin_manager", "formateur", "pedagogique", "dg_rh", "dg/rh"]

    async def handle_connection(self, websocket: WebSocket, room_id: str, token: Optional[str]):
        """Cycle de vie complet de la connexion WebSocket pour une salle."""
        cleaned_id = room_id.strip().lower()
        await websocket.accept()

        user = await self.authenticate_ws(websocket, token)
        if not user:
            await websocket.send_text(json.dumps({
                "type": "error",
                "code": 4001,
                "message": "Authentification requise ou jeton JWT invalide."
            }))
            await websocket.close(code=4001)
            return

        # Vérification de l'existence et de l'état actif de la salle
        with SessionLocal() as db:
            classroom = db.query(Classroom).filter(Classroom.room_id == cleaned_id).first()
            if not classroom or not classroom.is_active:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "code": 4004,
                    "message": "Salle de visioconférence introuvable ou clôturée."
                }))
                await websocket.close(code=4004)
                return

        async with self._lock:
            room = self._get_or_create_room(cleaned_id, classroom)

            # Vérification de la liste noire de session (Bloqué)
            if user["id"] in room["blocked_user_ids"]:
                await websocket.send_text(json.dumps({
                    "type": "blocked",
                    "code": 4003,
                    "message": "Vous avez été bloqué de cette session par le modérateur."
                }))
                await websocket.close(code=4003)
                return

            user_is_host = self.is_host(room, user)

            # Détermination de l'éligibilité : direct ou salle d'attente
            is_pre_admitted = (
                user["id"] in room["admitted_user_ids"]
                or not room["requires_approval"]
                or user_is_host
            )

            if not is_pre_admitted:
                # Placer dans la salle d'attente
                room["waiting_room"][user["id"]] = {
                    "ws": websocket,
                    "user": user,
                    "requested_at": datetime.utcnow().strftime("%H:%M:%S")
                }
                # Notifier l'invité
                await websocket.send_text(json.dumps({
                    "type": "waiting_room_status",
                    "status": "pending",
                    "message": "Vous êtes dans la salle d'attente. L'hôte a été notifié de votre arrivée.",
                    "room_title": room["title"]
                }))
                # Notifier tous les hôtes connectés
                await self._broadcast_to_hosts(cleaned_id, {
                    "type": "waiting_room_knock",
                    "user": {
                        "id": user["id"],
                        "name": user["name"],
                        "email": user["email"],
                        "role": user["role"],
                        "group_name": user["group_name"],
                        "requested_at": room["waiting_room"][user["id"]]["requested_at"]
                    }
                })
            else:
                # Admission immédiate
                room["admitted_user_ids"].add(user["id"])
                room["clients"][user["id"]] = {
                    "ws": websocket,
                    "user": user,
                    "joined_at": datetime.utcnow().strftime("%H:%M:%S")
                }
                # Notifier le nouveau client
                await websocket.send_text(json.dumps({
                    "type": "room_joined",
                    "user": user,
                    "is_host": user_is_host,
                    "room_title": room["title"],
                    "active_peers": self._get_active_peers(cleaned_id, exclude_id=user["id"]),
                    "waiting_users": self._get_waiting_users(cleaned_id) if user_is_host else [],
                    "blocked_users_count": len(room["blocked_user_ids"]),
                    "published_tracks": room["published_tracks"],
                    "media_states": room["media_states"],
                    "subgroups": room["subgroups"]
                }))
                # Notifier les autres participants
                await self._broadcast_to_admitted(cleaned_id, {
                    "type": "peer_joined",
                    "peer": user
                }, exclude_id=user["id"])

        # Boucle de messages WebSocket
        try:
            while True:
                raw_data = await websocket.receive_text()
                if not raw_data:
                    continue
                try:
                    msg = json.loads(raw_data)
                except Exception:
                    continue

                msg_type = msg.get("type")
                if not msg_type:
                    continue

                await self._process_message(cleaned_id, user, msg)

        except (WebSocketDisconnect, ConnectionResetError):
            pass
        except Exception as e:
            logger.warning(f"Erreur connexion WebSocket pour user {user['id']}: {e}")
        finally:
            await self._handle_disconnect(cleaned_id, user["id"])

    async def _process_message(self, room_id: str, user: Dict[str, Any], msg: Dict[str, Any]):
        """Traite les actions entrantes envoyées par un client."""
        cleaned_id = room_id.strip().lower()
        msg_type = msg.get("type")

        async with self._lock:
            room = self._rooms.get(cleaned_id)
            if not room:
                return

            user_id = user["id"]
            user_is_host = self.is_host(room, user)

            # -------------------------------------------------------------
            # GESTION HÔTE : MODÉRATION SALLE D'ATTENTE & ACCÈS
            # -------------------------------------------------------------
            if msg_type == "host_admit":
                if not user_is_host:
                    return
                target_user_id = int(msg.get("user_id", 0))
                await self._admit_user_unlocked(cleaned_id, target_user_id)

            elif msg_type == "host_admit_all":
                if not user_is_host:
                    return
                waiting_ids = list(room["waiting_room"].keys())
                for uid in waiting_ids:
                    await self._admit_user_unlocked(cleaned_id, uid)

            elif msg_type == "host_reject":
                if not user_is_host:
                    return
                target_user_id = int(msg.get("user_id", 0))
                await self._reject_user_unlocked(cleaned_id, target_user_id)

            elif msg_type == "host_block":
                if not user_is_host:
                    return
                target_user_id = int(msg.get("user_id", 0))
                await self._block_user_unlocked(cleaned_id, target_user_id)

            elif msg_type == "host_kick":
                if not user_is_host:
                    return
                target_user_id = int(msg.get("user_id", 0))
                await self._kick_user_unlocked(cleaned_id, target_user_id)

            elif msg_type == "host_mute_user":
                if not user_is_host:
                    return
                target_user_id = int(msg.get("user_id", 0))
                target_client = room["clients"].get(target_user_id)
                if target_client:
                    await target_client["ws"].send_text(json.dumps({
                        "type": "remote_mute",
                        "by_host": user["name"]
                    }))

            elif msg_type == "host_mute_all":
                if not user_is_host:
                    return
                for uid, client in room["clients"].items():
                    if uid != user_id and not self.is_host(room, client["user"]):
                        try:
                            await client["ws"].send_text(json.dumps({
                                "type": "remote_mute",
                                "by_host": user["name"]
                            }))
                        except Exception:
                            pass

            # -------------------------------------------------------------
            # SIGNALISATION SFU (Mediasoup / Janus C++ Engine)
            # -------------------------------------------------------------
            elif msg_type == "mediasoup_get_router_rtp_capabilities":
                rtp_caps = await mediasoup_sfu_manager.get_router_rtp_capabilities(cleaned_id)
                client_entry = room["clients"].get(user_id)
                if client_entry:
                    await client_entry["ws"].send_text(json.dumps({
                        "type": "mediasoup_router_rtp_capabilities",
                        "request_id": msg.get("request_id"),
                        "rtpCapabilities": rtp_caps
                    }))

            elif msg_type == "mediasoup_create_webrtc_transport":
                direction = msg.get("direction", "send")
                transport_options = await mediasoup_sfu_manager.create_webrtc_transport(cleaned_id, user_id, direction)
                client_entry = room["clients"].get(user_id)
                if client_entry:
                    await client_entry["ws"].send_text(json.dumps({
                        "type": "mediasoup_webrtc_transport_created",
                        "request_id": msg.get("request_id"),
                        "direction": direction,
                        "transportOptions": transport_options
                    }))

            elif msg_type == "mediasoup_connect_webrtc_transport":
                transport_id = msg.get("transport_id")
                dtls_params = msg.get("dtlsParameters", {})
                success = await mediasoup_sfu_manager.connect_webrtc_transport(cleaned_id, transport_id, dtls_params)
                client_entry = room["clients"].get(user_id)
                if client_entry:
                    await client_entry["ws"].send_text(json.dumps({
                        "type": "mediasoup_webrtc_transport_connected",
                        "request_id": msg.get("request_id"),
                        "transport_id": transport_id,
                        "success": success
                    }))

            elif msg_type == "mediasoup_produce":
                transport_id = msg.get("transport_id")
                kind = msg.get("kind", "video")
                rtp_params = msg.get("rtpParameters", {})
                producer_info = await mediasoup_sfu_manager.create_producer(
                    cleaned_id, user_id, transport_id, kind, rtp_params, msg.get("appData")
                )
                
                # Enregistrer la piste publiée
                if user_id not in room["published_tracks"]:
                    room["published_tracks"][user_id] = {}
                room["published_tracks"][user_id][kind] = {
                    "kind": kind,
                    "producer_id": producer_info["id"],
                    "stream_id": f"{user_id}_{kind}",
                    "published_at": datetime.utcnow().strftime("%H:%M:%S")
                }

                client_entry = room["clients"].get(user_id)
                if client_entry:
                    await client_entry["ws"].send_text(json.dumps({
                        "type": "mediasoup_produced",
                        "request_id": msg.get("request_id"),
                        "producer_id": producer_info["id"],
                        "kind": kind
                    }))

                # Notifier les autres participants admis qu'une piste Mediasoup C++ est publiée
                await self._broadcast_to_admitted(cleaned_id, {
                    "type": "track_published",
                    "publisher_id": user_id,
                    "publisher_email": user["email"],
                    "publisher_name": user["name"],
                    "kind": kind,
                    "producer_id": producer_info["id"],
                    "stream_id": f"{user_id}_{kind}"
                }, exclude_id=user_id)

            elif msg_type == "mediasoup_consume":
                producer_id = msg.get("producer_id")
                rtp_caps = msg.get("rtpCapabilities", {})
                consumer_info = await mediasoup_sfu_manager.create_consumer(
                    cleaned_id, user_id, producer_id, rtp_caps
                )
                client_entry = room["clients"].get(user_id)
                if client_entry:
                    await client_entry["ws"].send_text(json.dumps({
                        "type": "mediasoup_consumed",
                        "request_id": msg.get("request_id"),
                        "consumerOptions": consumer_info
                    }))

            # -------------------------------------------------------------
            # SIGNALISATION SFU CLASSIQUE (Tracks, SDP, ICE Candidates)
            # -------------------------------------------------------------
            elif msg_type == "track_published":
                # Peer annonce la publication d'une piste montante vers le hub SFU
                kind = msg.get("kind")  # "audio", "video", "screen"
                if kind in ["audio", "video", "screen"]:
                    if user_id not in room["published_tracks"]:
                        room["published_tracks"][user_id] = {}
                    room["published_tracks"][user_id][kind] = {
                        "kind": kind,
                        "encodings": msg.get("encodings", []),
                        "stream_id": msg.get("stream_id", f"{user_id}_{kind}"),
                        "simulcast": bool(msg.get("simulcast", False)),
                        "published_at": datetime.utcnow().strftime("%H:%M:%S")
                    }
                    # Notifier les autres pairs de la disponibilité de cette piste
                    await self._broadcast_to_admitted(cleaned_id, {
                        "type": "track_published",
                        "publisher_id": user_id,
                        "publisher_email": user["email"],
                        "publisher_name": user["name"],
                        "kind": kind,
                        "stream_id": room["published_tracks"][user_id][kind]["stream_id"]
                    }, exclude_id=user_id)

            elif msg_type == "track_unpublished":
                kind = msg.get("kind")
                if user_id in room["published_tracks"] and kind in room["published_tracks"][user_id]:
                    del room["published_tracks"][user_id][kind]
                    await self._broadcast_to_admitted(cleaned_id, {
                        "type": "track_unpublished",
                        "publisher_id": user_id,
                        "kind": kind
                    }, exclude_id=user_id)

            elif msg_type in ["sfu_offer", "sfu_answer", "ice_candidate"]:
                # Relai ciblé ou SFU dispatch
                recipient_id = msg.get("recipient_id")
                envelope = {
                    "type": msg_type,
                    "sender_id": user_id,
                    "sender_email": user["email"],
                    "sender_name": user["name"],
                    "payload": msg.get("payload")
                }
                if recipient_id:
                    recipient_client = room["clients"].get(int(recipient_id))
                    if recipient_client:
                        await recipient_client["ws"].send_text(json.dumps(envelope))
                else:
                    # Relai SFU broadcast à tous les participants admis
                    await self._broadcast_to_admitted(cleaned_id, envelope, exclude_id=user_id)


            # -------------------------------------------------------------
            # ÉTATS MÉDIA EN TEMPS RÉEL (Micro, Caméra, Écran, Détection Voix)
            # -------------------------------------------------------------
            elif msg_type == "media_state":
                state = {
                    "is_mic_muted": bool(msg.get("is_mic_muted", False)),
                    "is_camera_off": bool(msg.get("is_camera_off", False)),
                    "is_screen_sharing": bool(msg.get("is_screen_sharing", False)),
                    "is_speaking": bool(msg.get("is_speaking", False)),
                    "audio_level": float(msg.get("audio_level", 0.0)),
                    "transport_protocol": str(msg.get("transport_protocol", "UDP")),
                }
                room["media_states"][user_id] = state
                await self._broadcast_to_admitted(cleaned_id, {
                    "type": "peer_media_state",
                    "peer_id": user_id,
                    "state": state
                }, exclude_id=user_id)

            # -------------------------------------------------------------
            # CHAT SEGMENTÉ (Global, Privé 1-à-1, Sous-Groupes)
            # -------------------------------------------------------------
            elif msg_type == "chat_message":
                channel = msg.get("channel", "global")  # "global", "private", "subgroup"
                chat_id = f"msg_{datetime.utcnow().timestamp()}_{user_id}"
                time_str = datetime.utcnow().strftime("%H:%M")
                text = (msg.get("text") or "").strip()
                attachment = msg.get("attachment")

                if not text and not attachment:
                    return

                chat_item = {
                    "id": chat_id,
                    "sender_id": user_id,
                    "sender": user["email"],
                    "sender_name": user["name"],
                    "sender_role": user["role"],
                    "text": text,
                    "time": time_str,
                    "channel": channel,
                    "attachment": attachment
                }

                if channel == "global":
                    chat_item["recipient"] = "everyone"
                    room["chat_history"].append(chat_item)
                    await self._broadcast_to_admitted(cleaned_id, {
                        "type": "chat_message",
                        "message": chat_item
                    })

                elif channel == "private":
                    recipient_id = msg.get("recipient_id")
                    recipient_email = (msg.get("recipient_email") or "").strip().lower()

                    target_client = None
                    if recipient_id and int(recipient_id) in room["clients"]:
                        target_client = room["clients"][int(recipient_id)]
                    elif recipient_email:
                        target_client = next((c for c in room["clients"].values() if c["user"]["email"].lower() == recipient_email), None)

                    if target_client:
                        chat_item["recipient"] = target_client["user"]["email"]
                        chat_item["recipient_id"] = target_client["user"]["id"]
                        chat_item["recipient_name"] = target_client["user"]["name"]

                        # Envoi au destinataire
                        await target_client["ws"].send_text(json.dumps({
                            "type": "chat_message",
                            "message": chat_item
                        }))
                        # Echo à l'émetteur
                        sender_client = room["clients"].get(user_id)
                        if sender_client:
                            await sender_client["ws"].send_text(json.dumps({
                                "type": "chat_message",
                                "message": chat_item
                            }))
                    else:
                        sender_client = room["clients"].get(user_id)
                        if sender_client:
                            await sender_client["ws"].send_text(json.dumps({
                                "type": "error",
                                "message": "Destinataire privé non connecté."
                            }))

                elif channel == "subgroup":
                    subgroup_id = msg.get("subgroup_id")
                    chat_item["subgroup_id"] = subgroup_id
                    chat_item["recipient"] = f"subgroup:{subgroup_id}"
                    # Envoyer uniquement aux membres de ce sous-groupe
                    subgroups_list = room["subgroups"].get("subgroups", [])
                    sg = next((s for s in subgroups_list if s.get("id") == subgroup_id), None)
                    if sg:
                        member_emails = [m.lower() for m in sg.get("members", [])]
                        for c in room["clients"].values():
                            if c["user"]["email"].lower() in member_emails or self.is_host(room, c["user"]):
                                try:
                                    await c["ws"].send_text(json.dumps({
                                        "type": "chat_message",
                                        "message": chat_item
                                    }))
                                except Exception:
                                    pass

            # -------------------------------------------------------------
            # LEVÉE DE MAIN & SOUS-GROUPES (Breakout Rooms)
            # -------------------------------------------------------------
            elif msg_type == "hand_raise":
                raised = bool(msg.get("is_raised", True))
                await self._broadcast_to_admitted(cleaned_id, {
                    "type": "peer_hand_raise",
                    "peer_id": user_id,
                    "peer_name": user["name"],
                    "is_raised": raised
                })

            elif msg_type == "subgroups_update":
                if user_is_host:
                    room["subgroups"] = msg.get("subgroups_state", room["subgroups"])
                    await self._broadcast_to_admitted(cleaned_id, {
                        "type": "subgroups_state",
                        "state": room["subgroups"]
                    })

    async def _admit_user_unlocked(self, room_id: str, user_id: int):
        """Admet un utilisateur de la salle d'attente vers la session active."""
        room = self._rooms.get(room_id)
        if not room or user_id not in room["waiting_room"]:
            return

        waiting_entry = room["waiting_room"].pop(user_id)
        ws = waiting_entry["ws"]
        target_user = waiting_entry["user"]

        room["admitted_user_ids"].add(user_id)
        room["clients"][user_id] = {
            "ws": ws,
            "user": target_user,
            "joined_at": datetime.utcnow().strftime("%H:%M:%S")
        }

        # Persistance dans allowed_users
        with SessionLocal() as db:
            c = db.query(Classroom).filter(Classroom.room_id == room_id).first()
            if c:
                allowed = [a.strip() for a in (c.allowed_users or "").split(",") if a.strip()]
                if str(user_id) not in allowed:
                    allowed.append(str(user_id))
                    c.allowed_users = ",".join(allowed)
                    db.commit()

        # Notifier l'utilisateur admis
        try:
            await ws.send_text(json.dumps({
                "type": "admitted",
                "message": "Votre demande a été acceptée par l'hôte. Bienvenue dans la salle !",
                "room_title": room["title"],
                "active_peers": self._get_active_peers(room_id, exclude_id=user_id),
                "published_tracks": room["published_tracks"],
                "media_states": room["media_states"],
                "subgroups": room["subgroups"]
            }))
        except Exception:
            pass

        # Notifier les pairs connectés
        await self._broadcast_to_admitted(room_id, {
            "type": "peer_joined",
            "peer": target_user
        }, exclude_id=user_id)

        # Mettre à jour la file d'attente chez les hôtes
        await self._broadcast_to_hosts(room_id, {
            "type": "waiting_room_updated",
            "waiting_users": self._get_waiting_users(room_id)
        })

    async def _reject_user_unlocked(self, room_id: str, user_id: int):
        """Rejette un utilisateur en salle d'attente."""
        room = self._rooms.get(room_id)
        if not room or user_id not in room["waiting_room"]:
            return

        waiting_entry = room["waiting_room"].pop(user_id)
        ws = waiting_entry["ws"]

        try:
            await ws.send_text(json.dumps({
                "type": "rejected",
                "message": "Votre demande d'accès a été déclinée par l'hôte."
            }))
            await ws.close(code=4002)
        except Exception:
            pass

        await self._broadcast_to_hosts(room_id, {
            "type": "waiting_room_updated",
            "waiting_users": self._get_waiting_users(room_id)
        })

    async def _block_user_unlocked(self, room_id: str, user_id: int):
        """Bannit définitivement l'utilisateur de cette session."""
        room = self._rooms.get(room_id)
        if not room:
            return

        room["blocked_user_ids"].add(user_id)
        room["admitted_user_ids"].discard(user_id)

        # Nettoyage DB
        with SessionLocal() as db:
            c = db.query(Classroom).filter(Classroom.room_id == room_id).first()
            if c and c.allowed_users:
                allowed = [a.strip() for a in c.allowed_users.split(",") if a.strip() and a.strip() != str(user_id)]
                c.allowed_users = ",".join(allowed)
                db.commit()

        # Si en attente
        if user_id in room["waiting_room"]:
            ws = room["waiting_room"].pop(user_id)["ws"]
            try:
                await ws.send_text(json.dumps({
                    "type": "blocked",
                    "message": "Vous avez été bloqué de cette session."
                }))
                await ws.close(code=4003)
            except Exception:
                pass

        # Si déjà connecté
        if user_id in room["clients"]:
            ws = room["clients"].pop(user_id)["ws"]
            try:
                await ws.send_text(json.dumps({
                    "type": "blocked",
                    "message": "Vous avez été bloqué de cette session par le formateur."
                }))
                await ws.close(code=4003)
            except Exception:
                pass
            await self._broadcast_to_admitted(room_id, {
                "type": "peer_left",
                "peer_id": user_id,
                "reason": "blocked"
            })

        await self._broadcast_to_hosts(room_id, {
            "type": "waiting_room_updated",
            "waiting_users": self._get_waiting_users(room_id),
            "blocked_users_count": len(room["blocked_user_ids"])
        })

    async def _kick_user_unlocked(self, room_id: str, user_id: int):
        """Exclut un participant actif de la salle."""
        room = self._rooms.get(room_id)
        if not room or user_id not in room["clients"]:
            return

        client_entry = room["clients"].pop(user_id)
        ws = client_entry["ws"]
        room["admitted_user_ids"].discard(user_id)

        try:
            await ws.send_text(json.dumps({
                "type": "kicked",
                "message": "Vous avez été exclu de la session par le formateur."
            }))
            await ws.close(code=4002)
        except Exception:
            pass

        await self._broadcast_to_admitted(room_id, {
            "type": "peer_left",
            "peer_id": user_id,
            "reason": "kicked"
        })

    async def _handle_disconnect(self, room_id: str, user_id: int):
        """Nettoyage complet lors de la déconnexion inattendue."""
        async with self._lock:
            room = self._rooms.get(room_id)
            if not room:
                return

            if user_id in room["waiting_room"]:
                del room["waiting_room"][user_id]
                await self._broadcast_to_hosts(room_id, {
                    "type": "waiting_room_updated",
                    "waiting_users": self._get_waiting_users(room_id)
                })

            if user_id in room["clients"]:
                del room["clients"][user_id]
                room["published_tracks"].pop(user_id, None)
                room["media_states"].pop(user_id, None)

                await self._broadcast_to_admitted(room_id, {
                    "type": "peer_left",
                    "peer_id": user_id,
                    "reason": "disconnected"
                })

    def _get_active_peers(self, room_id: str, exclude_id: Optional[int] = None) -> List[Dict[str, Any]]:
        room = self._rooms.get(room_id)
        if not room:
            return []
        peers = []
        for uid, client in room["clients"].items():
            if exclude_id and uid == exclude_id:
                continue
            peers.append({
                "id": uid,
                "email": client["user"]["email"],
                "name": client["user"]["name"],
                "role": client["user"]["role"],
                "group_name": client["user"]["group_name"],
                "joined_at": client["joined_at"],
                "is_host": self.is_host(room, client["user"]),
                "media_state": room["media_states"].get(uid, {
                    "is_mic_muted": False,
                    "is_camera_off": False,
                    "is_screen_sharing": False,
                    "is_speaking": False,
                    "audio_level": 0.0,
                    "transport_protocol": "UDP"
                })
            })
        return peers

    def _get_waiting_users(self, room_id: str) -> List[Dict[str, Any]]:
        room = self._rooms.get(room_id)
        if not room:
            return []
        return [
            {
                "id": uid,
                "name": entry["user"]["name"],
                "email": entry["user"]["email"],
                "role": entry["user"]["role"],
                "group_name": entry["user"]["group_name"],
                "requested_at": entry["requested_at"]
            }
            for uid, entry in room["waiting_room"].items()
        ]

    async def _broadcast_to_admitted(self, room_id: str, data: Dict[str, Any], exclude_id: Optional[int] = None):
        room = self._rooms.get(room_id)
        if not room:
            return
        payload_str = json.dumps(data)
        for uid, client in list(room["clients"].items()):
            if exclude_id and uid == exclude_id:
                continue
            try:
                await client["ws"].send_text(payload_str)
            except Exception:
                pass

    async def _broadcast_to_hosts(self, room_id: str, data: Dict[str, Any]):
        room = self._rooms.get(room_id)
        if not room:
            return
        payload_str = json.dumps(data)
        for uid, client in list(room["clients"].items()):
            if self.is_host(room, client["user"]):
                try:
                    await client["ws"].send_text(payload_str)
                except Exception:
                    pass

    # Méthodes d'accès REST publiques
    def get_room_state(self, room_id: str) -> Optional[Dict[str, Any]]:
        cleaned_id = room_id.strip().lower()
        room = self._rooms.get(cleaned_id)
        if not room:
            return None
        return {
            "room_id": cleaned_id,
            "title": room["title"],
            "requires_approval": room["requires_approval"],
            "active_peers_count": len(room["clients"]),
            "waiting_count": len(room["waiting_room"]),
            "blocked_count": len(room["blocked_user_ids"]),
            "active_peers": self._get_active_peers(cleaned_id),
            "waiting_users": self._get_waiting_users(cleaned_id),
            "blocked_user_ids": list(room["blocked_user_ids"])
        }

    async def block_user_rest(self, room_id: str, user_id: int):
        async with self._lock:
            await self._block_user_unlocked(room_id.strip().lower(), user_id)

    async def unblock_user_rest(self, room_id: str, user_id: int):
        async with self._lock:
            room = self._rooms.get(room_id.strip().lower())
            if room:
                room["blocked_user_ids"].discard(user_id)


# Instance unique du gestionnaire de signalisation
signaling_manager = ClassroomSignalingManager()
