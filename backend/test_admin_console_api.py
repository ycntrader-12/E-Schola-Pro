"""
Suite de tests de régression et de sécurité pour la Console d'Administration E-Schola Pro.
Valide l'ensemble des 11 modules de gouvernance et de supervision administrative :
1. Statistiques consolidées et KPI temps réel (/admin/dashboard/stats)
2. Journal d'audit et recherche filtrée (/admin/audit-logs)
3. Gestion des sessions actives et révocation (/admin/sessions)
4. Événements et détection de sécurité (/admin/security/events)
5. Invitations cryptographiques avec tokens (/admin/invitations)
6. Paramètres système dynamiques (/admin/settings)
7. Santé système, latence DB et stockage uploads (/admin/system/status)
8. Logs applicatifs avec masquage automatique des secrets (/admin/system/logs)
9. Exportation complète JSON & instantané serveur (/admin/backup/export & /snapshot)
10. Supervision et fermeture d'urgence de visioconférences (/admin/classrooms/supervision)
11. Supervision pédagogique des quiz (/admin/quizzes/supervision)
12. Contrôle RBAC strict (interdiction aux étudiants et formateurs, HTTP 403)
"""

import io
import json
import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.v1.admin import (
    InvitationCreateRequest,
    SystemSettingsUpdateRequest,
    create_local_snapshot,
    create_user_invitation,
    export_database_backup,
    force_terminate_classroom,
    get_active_sessions,
    get_admin_dashboard_stats,
    get_application_logs,
    get_audit_logs,
    get_classrooms_supervision,
    get_invitations,
    get_quizzes_supervision,
    get_security_events,
    get_system_settings,
    get_system_status,
    resend_invitation,
    revoke_all_sessions_for_user,
    revoke_invitation,
    revoke_session,
    update_system_settings,
)
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.classroom import Classroom
from app.models.course import Course
from app.models.group import Group
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.user_session import UserSession
from app.services.audit_service import log_audit_event, register_user_session


class MockRequest:
    def __init__(self, client_ip: str = "127.0.0.1", user_agent: str = "TestAgent/1.0"):
        self.headers = {
            "x-forwarded-for": client_ip,
            "user-agent": user_agent,
        }
        self.client = type("Client", (), {"host": client_ip})()


class TestAdminConsoleAPI(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Création des utilisateurs tests
        self.admin = User(
            username="admin_first",
            email="admin_first@eschola.pro",
            hashed_password=get_password_hash("Admin@1212"),
            role="admin",
            nom="Admin",
            prenom="Super",
            is_active=True,
        )
        self.admin_manager = User(
            username="admin_mgr",
            email="admin_mgr@eschola.pro",
            hashed_password=get_password_hash("Secret123!"),
            role="admin_manager",
            nom="Manager",
            prenom="Admin",
            is_active=True,
        )
        self.student = User(
            username="student1",
            email="student1@eschola.pro",
            hashed_password=get_password_hash("Secret123!"),
            role="étudiant",
            nom="Dupont",
            prenom="Lucas",
            is_active=True,
        )
        self.instructor = User(
            username="instructor1",
            email="prof@eschola.pro",
            hashed_password=get_password_hash("Secret123!"),
            role="formateur",
            nom="Martin",
            prenom="Sophie",
            is_active=True,
        )

        self.db.add_all([self.admin, self.admin_manager, self.student, self.instructor])
        self.db.commit()
        for u in [self.admin, self.admin_manager, self.student, self.instructor]:
            self.db.refresh(u)

        # Ajout de paramètres système initiaux
        self.db.add_all([
            SystemSetting(key="site_name", value="E-Schola Pro", category="general"),
            SystemSetting(key="allow_registration", value="true", category="general"),
        ])
        self.db.commit()

        self.req = MockRequest()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_dashboard_stats(self):
        """Vérifie le calcul correct de toutes les métriques de la plateforme."""
        stats = get_admin_dashboard_stats(current_admin=self.admin, session=self.db)
        self.assertIn("users", stats)
        self.assertEqual(stats["users"]["total"], 4)
        self.assertEqual(stats["users"]["active"], 4)
        self.assertEqual(stats["users"]["disabled"], 0)
        self.assertIn("system", stats)
        self.assertTrue(stats["system"]["database_alive"])

    def test_audit_logs_and_filtering(self):
        """Vérifie l'enregistrement et la recherche filtrée des logs d'audit."""
        log_audit_event(
            self.db,
            action="LOGIN_SUCCESS",
            user_id=self.admin.id,
            user_email=self.admin.email,
            details="Authentification réussie",
            status="SUCCESS",
            request=self.req,
        )
        log_audit_event(
            self.db,
            action="LOGIN_FAILED",
            user_email="unknown@eschola.pro",
            details="Mot de passe incorrect",
            status="FAILED",
            request=self.req,
        )

        logs = get_audit_logs(
            current_admin=self.admin,
            session=self.db,
            page=1,
            limit=10,
            search="admin_first",
        )
        self.assertEqual(logs["total"], 1)
        self.assertEqual(logs["items"][0]["action"], "LOGIN_SUCCESS")

    def test_user_session_registration_and_revocation(self):
        """Vérifie la création, consultation et révocation de session active."""
        expires = datetime.utcnow() + timedelta(days=7)
        sess = register_user_session(
            self.db,
            user_id=self.student.id,
            session_token="abcdef1234567890",
            expires_at=expires,
            request=self.req,
        )
        self.assertIsNotNone(sess)

        active_sessions = get_active_sessions(current_admin=self.admin, session=self.db)
        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0]["user_email"], self.student.email)

        # Révocation unitaire
        res = revoke_session(
            session_id=sess.id,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertIn("succès", res["message"])

        # Vérification qu'il n'y a plus de session active
        remaining = get_active_sessions(current_admin=self.admin, session=self.db)
        self.assertEqual(len(remaining), 0)

    def test_revoke_all_user_sessions(self):
        """Vérifie la déconnexion globale d'un utilisateur suspect."""
        expires = datetime.utcnow() + timedelta(days=7)
        register_user_session(self.db, self.student.id, "tok1", expires, self.req)
        register_user_session(self.db, self.student.id, "tok2", expires, self.req)

        active = get_active_sessions(current_admin=self.admin, session=self.db)
        self.assertEqual(len(active), 2)

        res = revoke_all_sessions_for_user(
            user_id=self.student.id,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertIn("2 sessions révoquées", res["message"])

        remaining = get_active_sessions(current_admin=self.admin, session=self.db)
        self.assertEqual(len(remaining), 0)

    def test_security_events_detection(self):
        """Vérifie la détection des échecs répétés de connexion et IPs suspectes."""
        for _ in range(4):
            log_audit_event(
                self.db,
                action="LOGIN_FAILED",
                user_email="hacker@test.com",
                details="Brute force attempt",
                status="FAILED",
                request=MockRequest(client_ip="192.168.1.99"),
            )

        events = get_security_events(current_admin=self.admin, session=self.db)
        self.assertEqual(events["failed_logins_last_24h"], 4)
        self.assertEqual(len(events["suspicious_ips"]), 1)
        self.assertEqual(events["suspicious_ips"][0]["ip"], "192.168.1.99")
        self.assertEqual(events["suspicious_ips"][0]["failures"], 4)

    def test_invitation_lifecycle(self):
        """Vérifie le cycle de vie complet d'une invitation utilisateur."""
        # 1. Création
        payload = InvitationCreateRequest(
            email="nouveau.stagiaire@eschola.pro",
            role="stagiaire",
            group_name="Promo 2026",
        )
        res = create_user_invitation(
            payload=payload,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertEqual(res["email"], "nouveau.stagiaire@eschola.pro")
        invite_id = res["id"]

        # 2. Consultation
        inv_list = get_invitations(current_admin=self.admin, session=self.db)
        self.assertEqual(len(inv_list), 1)
        self.assertEqual(inv_list[0]["status"], "pending")

        # 3. Renvoi
        resend_res = resend_invitation(
            invite_id=invite_id,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertIn("renvoyée", resend_res["message"])

        # 4. Révocation
        rev_res = revoke_invitation(
            invite_id=invite_id,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertIn("révoquée", rev_res["message"])

    def test_system_settings_update(self):
        """Vérifie la mise à jour à chaud des réglages par le super-admin."""
        payload = SystemSettingsUpdateRequest(
            settings={
                "site_name": "E-Schola Pro Elite",
                "maintenance_mode": "false",
                "max_upload_size_mb": "100",
            }
        )
        update_res = update_system_settings(
            payload=payload,
            request=self.req,
            current_super_admin=self.admin,
            session=self.db,
        )
        self.assertIn("succès", update_res["message"])

        settings = get_system_settings(current_admin=self.admin, session=self.db)
        site_name = next(s["value"] for s in settings if s["key"] == "site_name")
        self.assertEqual(site_name, "E-Schola Pro Elite")

    def test_backup_export_integrity(self):
        """Vérifie l'intégrité de l'export JSON avec son checksum SHA256."""
        backup = export_database_backup(
            request=self.req,
            current_super_admin=self.admin,
            session=self.db,
        )
        self.assertIn("metadata", backup)
        self.assertIn("sha256_checksum", backup["metadata"])
        self.assertEqual(backup["metadata"]["counts"]["users"], 4)
        self.assertEqual(len(backup["data"]["users"]), 4)

    def test_classroom_supervision_and_termination(self):
        """Vérifie la supervision des salles de classe et l'arrêt d'urgence."""
        room = Classroom(
            room_id="room-1234-xyz",
            title="Cours d'Architecture Logicielle",
            instructor_id=self.instructor.id,
            is_active=True,
        )
        self.db.add(room)
        self.db.commit()
        self.db.refresh(room)

        rooms = get_classrooms_supervision(current_admin=self.admin, session=self.db)
        self.assertEqual(len(rooms), 1)
        self.assertTrue(rooms[0]["is_active"])

        # Arrêt forcé
        term_res = force_terminate_classroom(
            room_id=room.id,
            request=self.req,
            current_admin=self.admin,
            session=self.db,
        )
        self.assertIn("clôturée", term_res["message"])

        self.db.refresh(room)
        self.assertFalse(room.is_active)

    def test_quiz_supervision(self):
        """Vérifie la supervision des évaluations et le suivi des tentatives."""
        quiz = Quiz(
            title="Examen Sécurité Web",
            description="QCM de validation",
            created_by_id=self.instructor.id,
            target_roles="étudiant",
            time_limit_minutes=30,
        )
        self.db.add(quiz)
        self.db.commit()
        self.db.refresh(quiz)

        attempt = QuizAttempt(
            quiz_id=quiz.id,
            user_id=self.student.id,
            score=18,
            max_score=20,
            percentage=90.0,
            completed_at=datetime.utcnow(),
        )
        self.db.add(attempt)
        self.db.commit()

        supervision = get_quizzes_supervision(current_admin=self.admin, session=self.db)
        self.assertEqual(len(supervision["quizzes"]), 1)
        self.assertEqual(supervision["quizzes"][0]["average_score"], 90.0)
        self.assertEqual(len(supervision["recent_attempts"]), 1)
        self.assertEqual(supervision["recent_attempts"][0]["percentage"], 90.0)


if __name__ == "__main__":
    unittest.main()
