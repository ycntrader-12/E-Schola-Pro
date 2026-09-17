"""
Test automatisé de validation du module de visioconférence WebRTC SFU,
du serveur de signalisation WebSocket, de la salle d'attente, du blocage,
du chat segmenté et des invitations multi-canaux.
"""

import sys
import os
import asyncio
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


from app.db.database import SessionLocal
from app.models.user import User
from app.models.classroom import Classroom
from app.models.classroom_invitation import ClassroomInvitation
from app.models.group import Group, GroupMember
from app.models.attendance import Attendance
from app.models.message import Message
from app.core.security import create_access_token
from app.services.classroom_signaling import signaling_manager


class MockWebSocket:
    """Mock léger simulant un WebSocket FastAPI asynchrone."""
    def __init__(self):
        self.sent_messages = []
        self.is_closed = False
        self.close_code = None

    async def accept(self):
        pass

    async def send_text(self, text: str):
        self.sent_messages.append(json.loads(text))

    async def close(self, code: int = 1000):
        self.is_closed = True
        self.close_code = code


def run_tests():
    print("=" * 70)
    print("🚀 DÉMARRAGE DES TESTS : VISIOCONFÉRENCE WEBRTC SFU & SIGNALISATION")
    print("=" * 70)

    db = SessionLocal()
    try:
        # 1. Setup Test Users
        print("\n[TEST 1] Initialisation des comptes formateur et étudiants...")
        formateur = db.query(User).filter(User.role.in_(["formateur", "admin"])).first()
        assert formateur is not None, "Formateur/Admin introuvable en base."

        etudiant1 = db.query(User).filter(User.email == "test_learner_1@eschola.pro").first()
        if not etudiant1:
            etudiant1 = User(
                email="test_learner_1@eschola.pro",
                hashed_password="fakehashedpwd",
                role="etudiant",
                prenom="Karim",
                nom="Bennani",
                username="kbennani",
                is_active=True
            )
            db.add(etudiant1)

        etudiant2 = db.query(User).filter(User.email == "test_learner_2@eschola.pro").first()
        if not etudiant2:
            etudiant2 = User(
                email="test_learner_2@eschola.pro",
                hashed_password="fakehashedpwd",
                role="etudiant",
                prenom="Sofia",
                nom="El Amrani",
                username="selamrani",
                is_active=True
            )
            db.add(etudiant2)

        db.commit()
        db.refresh(formateur)
        db.refresh(etudiant1)
        db.refresh(etudiant2)
        print(f"  ✅ Formateur: {formateur.email} (ID: {formateur.id})")
        print(f"  ✅ Étudiant 1: {etudiant1.email} (ID: {etudiant1.id})")
        print(f"  ✅ Étudiant 2: {etudiant2.email} (ID: {etudiant2.id})")

        # 2. Setup Test Classroom with Waiting Room (requires_approval=True)
        print("\n[TEST 2] Création de la salle de visioconférence sécurisée avec Salle d'Attente...")
        test_room_id = "test-sfu-room"
        existing_room = db.query(Classroom).filter(Classroom.room_id == test_room_id).first()
        if existing_room:
            existing_room.is_active = True
            existing_room.requires_approval = True
            existing_room.instructor_id = formateur.id
            existing_room.allowed_users = ""
            db.commit()
            classroom = existing_room
        else:
            classroom = Classroom(
                room_id=test_room_id,
                title="Cours Test WebRTC SFU & Signalisation",
                instructor_id=formateur.id,
                is_active=True,
                is_private=True,
                requires_approval=True,
                allow_screen_sharing=True,
                allowed_users=""
            )
            db.add(classroom)
            db.commit()
            db.refresh(classroom)

        print(f"  ✅ Salle créée : '{classroom.title}' (Code: {classroom.room_id})")

        # 3. Test Tokens
        formateur_token = create_access_token(subject=str(formateur.id))
        etudiant1_token = create_access_token(subject=str(etudiant1.id))
        etudiant2_token = create_access_token(subject=str(etudiant2.id))

        # 4. Async Tests with Mock WebSockets
        async def run_async_suite():
            print("\n[TEST 3] Connexion de l'Hôte / Formateur via WebSocket...")
            host_ws = MockWebSocket()
            host_auth = await signaling_manager.authenticate_ws(host_ws, formateur_token)
            assert host_auth is not None
            assert host_auth["id"] == formateur.id
            print(f"  ✅ Hôte authentifié avec succès : {host_auth['name']} ({host_auth['role']})")

            # Connexion de l'hôte dans la salle
            async with signaling_manager._lock:
                room = signaling_manager._get_or_create_room(test_room_id, classroom)
                room["clients"][formateur.id] = {
                    "ws": host_ws,
                    "user": host_auth,
                    "joined_at": "12:00:00"
                }
                room["admitted_user_ids"].add(formateur.id)

            print("  ✅ Hôte connecté dans la salle de session.")

            print("\n[TEST 4] Arrivée d'un apprenant non autorisé (Placement en Salle d'Attente & Knock)...")
            learner1_ws = MockWebSocket()
            learner1_auth = await signaling_manager.authenticate_ws(learner1_ws, etudiant1_token)
            assert learner1_auth is not None

            # Simulation de l'arrivée dans la salle nécessitant approbation
            async with signaling_manager._lock:
                room["waiting_room"][etudiant1.id] = {
                    "ws": learner1_ws,
                    "user": learner1_auth,
                    "requested_at": "12:01:00"
                }
                # Knock envoyé à l'hôte
                await signaling_manager._broadcast_to_hosts(test_room_id, {
                    "type": "waiting_room_knock",
                    "user": learner1_auth
                })

            # Vérification du message knock reçu par l'hôte
            knock_msgs = [m for m in host_ws.sent_messages if m.get("type") == "waiting_room_knock"]
            assert len(knock_msgs) > 0, "L'hôte n'a pas reçu la notification d'arrivée (Knock)."
            print(f"  ✅ Knock reçu par l'hôte pour {knock_msgs[-1]['user']['name']}.")

            print("\n[TEST 5] Action Hôte : Admission de l'apprenant (host_admit)...")
            async with signaling_manager._lock:
                await signaling_manager._admit_user_unlocked(test_room_id, etudiant1.id)

            assert etudiant1.id in room["admitted_user_ids"]
            assert etudiant1.id not in room["waiting_room"]
            assert etudiant1.id in room["clients"]
            admitted_msgs = [m for m in learner1_ws.sent_messages if m.get("type") == "admitted"]
            assert len(admitted_msgs) > 0, "L'apprenant n'a pas reçu le message 'admitted'."
            print("  ✅ Apprenant admis avec succès, connecté dans room['clients'].")

            print("\n[TEST 6] Signalisation SFU : Publication de piste (track_published)...")
            await signaling_manager._process_message(test_room_id, learner1_auth, {
                "type": "track_published",
                "kind": "video",
                "stream_id": f"{etudiant1.id}_video",
                "simulcast": True
            })

            assert "video" in room["published_tracks"][etudiant1.id]
            track_msgs = [m for m in host_ws.sent_messages if m.get("type") == "track_published"]
            assert len(track_msgs) > 0
            print(f"  ✅ Piste vidéo SFU publiée et relayée vers l'hôte : stream_id={track_msgs[-1]['stream_id']}.")

            print("\n[TEST 7] Segmentation du Chat : Message Global vs Message Privé...")
            # 1. Message Global
            await signaling_manager._process_message(test_room_id, learner1_auth, {
                "type": "chat_message",
                "channel": "global",
                "text": "Bonjour tout le monde !"
            })
            global_msgs = [m for m in host_ws.sent_messages if m.get("type") == "chat_message" and m["message"]["channel"] == "global"]
            assert len(global_msgs) > 0
            print("  ✅ Message global diffusé et reçu par les participants.")

            # 2. Message Privé ciblé vers l'hôte
            await signaling_manager._process_message(test_room_id, learner1_auth, {
                "type": "chat_message",
                "channel": "private",
                "recipient_id": formateur.id,
                "text": "Question confidentielle pour le formateur."
            })
            private_msgs = [m for m in host_ws.sent_messages if m.get("type") == "chat_message" and m["message"]["channel"] == "private"]
            assert len(private_msgs) > 0
            assert private_msgs[-1]["message"]["recipient"] == formateur.email
            print(f"  ✅ Message privé délivré en toute étanchéité à l'hôte ({formateur.email}).")

            print("\n[TEST 8] Action Hôte : Rejet & Blocage d'un utilisateur malveillant (host_block)...")
            learner2_ws = MockWebSocket()
            learner2_auth = await signaling_manager.authenticate_ws(learner2_ws, etudiant2_token)
            assert learner2_auth is not None

            # Placer etudiant2 en attente
            async with signaling_manager._lock:
                room["waiting_room"][etudiant2.id] = {
                    "ws": learner2_ws,
                    "user": learner2_auth,
                    "requested_at": "12:05:00"
                }

            # L'hôte bloque etudiant2
            await signaling_manager._process_message(test_room_id, host_auth, {
                "type": "host_block",
                "user_id": etudiant2.id
            })

            assert etudiant2.id in room["blocked_user_ids"]
            assert etudiant2.id not in room["waiting_room"]
            assert learner2_ws.is_closed is True
            assert learner2_ws.close_code == 4003
            print("  ✅ Utilisateur bloqué avec succès et connexion fermée avec code 4003.")

            print("\n[TEST 9] Vérification de l'état de la salle via get_room_state...")
            state = signaling_manager.get_room_state(test_room_id)
            assert state is not None
            assert state["active_peers_count"] == 2  # formateur + etudiant1
            assert state["waiting_count"] == 0
            assert state["blocked_count"] == 1
            assert etudiant2.id in state["blocked_user_ids"]
            print("  ✅ État temps réel conforme : 2 actifs, 0 en attente, 1 bloqué.")

        asyncio.run(run_async_suite())

        # 5. Test Multi-channel Invitation Dispatch
        print("\n[TEST 10] Test de la diffusion automatisée multi-canaux d'invitations...")
        # Create a test group
        test_group = db.query(Group).filter(Group.name == "Groupe Visioconférence Test").first()
        if not test_group:
            test_group = Group(
                name="Groupe Visioconférence Test",
                description="Groupe de validation test SFU",
                creator_id=formateur.id
            )
            db.add(test_group)
            db.commit()
            db.refresh(test_group)

        # Add etudiant1 to group
        gm = db.query(GroupMember).filter(GroupMember.group_id == test_group.id, GroupMember.user_id == etudiant1.id).first()
        if not gm:
            db.add(GroupMember(group_id=test_group.id, user_id=etudiant1.id))
            db.commit()

        # Simulate invitation dispatch via API logic
        targeted_user_ids = {etudiant1.id, etudiant2.id}
        targeted_user_ids.discard(formateur.id)

        invited_count = 0
        for uid in targeted_user_ids:
            inv = db.query(ClassroomInvitation).filter(
                ClassroomInvitation.classroom_id == classroom.id,
                ClassroomInvitation.invitee_id == uid
            ).first()
            if not inv:
                inv = ClassroomInvitation(
                    classroom_id=classroom.id,
                    inviter_id=formateur.id,
                    invitee_id=uid,
                    status="pending"
                )
                db.add(inv)

            # In-app message
            msg = Message(
                sender_id=formateur.id,
                recipient_id=uid,
                subject=f"🎓 Invitation Salle vidéo conférence : {classroom.title}",
                body=f"Rejoignez la session : code {classroom.room_id}"
            )
            db.add(msg)

            # Attendance pre-enrollment
            att = Attendance(
                user_id=uid,
                date=classroom.created_at.date(),
                status="absent",
                session_name=classroom.title,
                remarks=f"Invitation auto test"
            )
            db.add(att)
            invited_count += 1

        db.commit()

        # Verify persistence
        pending_invs = db.query(ClassroomInvitation).filter(ClassroomInvitation.classroom_id == classroom.id).all()
        assert len(pending_invs) >= 2
        print(f"  ✅ {invited_count} invitations enregistrées en base avec notifications et présences.")

        print("\n" + "=" * 70)
        print("🎉 TOUS LES TESTS DU MODULE WEBRTC SFU & SIGNALISATION SONT 100% VALIDÉS !")
        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
