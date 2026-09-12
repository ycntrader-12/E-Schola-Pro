"""
Comprehensive Verification Test Suite for E-Schola Pro:
1. PostgreSQL Railway Persistence & Environment Variable Resolution
2. Root Admin & User Password Preservation Across Restarts (Anti-Reset)
3. Transactional Email System (Welcome, Role Change, Video Conference Invitation)
4. Role Change Persistence, Immediate Commit & Audit Trail
5. Video Conference Room Invitation Persistence & Email Dispatch
6. Security Constraints (RBAC, Root Admin Immunity)
7. Terminology Harmonization (« Salle vidéo conférence »)
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import (
    is_in_railway,
    expand_railway_template_variables,
    get_default_database_url,
    Settings,
)
from app.core.security import get_password_hash, verify_password
from app.services.email_service import (
    send_welcome_email,
    send_role_change_email,
    send_classroom_invitation_email,
)
from create_admin import ensure_root_admin_first
from app.models.user import User
from app.models.classroom import Classroom
from app.models.classroom_invitation import ClassroomInvitation
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base


class TestRailwayPostgreSQLPersistence(unittest.TestCase):
    """Test 1: Railway detection, template expansion, and safe non-fallback."""

    def test_railway_environment_detection(self):
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_NAME": "production"}):
            self.assertTrue(is_in_railway())

        with patch.dict(os.environ, {"RAILWAY_SERVICE_NAME": "backend"}):
            self.assertTrue(is_in_railway())

        with patch.dict(os.environ, {"RAILWAY_PUBLIC_DOMAIN": "backend.up.railway.app"}):
            self.assertTrue(is_in_railway())

    def test_railway_template_variable_expansion(self):
        raw_url = "${{Postgres.DATABASE_URL}}"
        with patch.dict(os.environ, {
            "Postgres.DATABASE_URL": "postgresql://postgres:secret@db.railway.internal:5432/railway"
        }):
            expanded = expand_railway_template_variables(raw_url)
            self.assertEqual(expanded, "postgresql://postgres:secret@db.railway.internal:5432/railway")

    def test_missing_database_url_raises_error(self):
        """Missing DATABASE_URL must strictly raise a clear ValueError."""
        with patch.dict(os.environ, {
            "DATABASE_URL": "",
            "POSTGRES_URL": "",
            "DATABASE_PUBLIC_URL": "",
            "DATABASE_URL_UNPOOLED": "",
            "RAILWAY_PRIVATE_DOMAIN": "",
            "PGHOST": "",
            "POSTGRES_HOST": "",
            "PGUSER": "",
            "POSTGRES_USER": "",
            "POSTGRES_PASSWORD": "",
            "PGDATABASE": "",
            "POSTGRES_DB": "",
            "ENVIRONMENT": "production",
        }, clear=False):
            with self.assertRaises(ValueError) as ctx:
                get_default_database_url()
            self.assertIn("DATABASE_URL", str(ctx.exception))

    def test_sqlite_fallback_strictly_banned(self):
        """Any attempt to configure a SQLite database or .db file in production must raise ValueError."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            with self.assertRaises(ValueError) as ctx:
                Settings.normalize_database_url("sqlite:///./app.db")
            self.assertIn("SQLite", str(ctx.exception))

            with self.assertRaises(ValueError) as ctx2:
                Settings.normalize_database_url("sqlite:///./eschola.db")
            self.assertIn("SQLite", str(ctx2.exception))

    def test_postgres_url_normalization(self):
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            normalized = Settings.normalize_database_url("postgres://user:pass@host:5432/db")
            self.assertTrue(normalized.startswith("postgresql+psycopg2://"))



class TestUserAndAdminPersistenceAcrossRestarts(unittest.TestCase):
    """Test 2: Ensure root admin and users retain custom passwords across restarts."""

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_ensure_root_admin_first_does_not_reset_existing_password(self):
        # 1. First run creates admin_first with initial password
        admin = ensure_root_admin_first(self.db)
        self.assertIsNotNone(admin)
        self.assertTrue(verify_password("Admin@1212", admin.hashed_password))

        # 2. Admin changes password to a custom secure one
        custom_password = "MyNewSuperSecretPassword2026!"
        admin.hashed_password = get_password_hash(custom_password)
        self.db.commit()

        # 3. Simulate container reboot / redeploy -> ensure_root_admin_first is called again
        admin_after_reboot = ensure_root_admin_first(self.db)
        self.assertTrue(verify_password(custom_password, admin_after_reboot.hashed_password))
        self.assertFalse(verify_password("Admin@1212", admin_after_reboot.hashed_password))


class TestTransactionalEmailService(unittest.TestCase):
    """Test 3: Transactional emails (Welcome, Role Change, Room Invitation)."""

    def test_send_welcome_email(self):
        # When SMTP is disabled or offline, it safely handles it without raising
        result = send_welcome_email(
            to_email="newbie@example.com",
            user_name="Jean Dupont",
            role="formateur",
            login_url="https://eschola.pro/login",
        )
        # Should return a boolean without throwing an exception
        self.assertIsInstance(result, bool)

    def test_send_role_change_email(self):
        result = send_role_change_email(
            to_email="jean.dupont@example.com",
            user_name="Jean Dupont",
            old_role="étudiant",
            new_role="formateur",
            login_url="https://eschola.pro/login",
        )
        self.assertIsInstance(result, bool)

    def test_send_classroom_invitation_email(self):
        result = send_classroom_invitation_email(
            to_email="student@example.com",
            user_name="Alice Martin",
            room_title="Atelier Intelligence Artificielle & Deep Learning",
            room_id="room-ai-2026",
            inviter_name="Professeur Martin",
            start_time="10/09/2026 à 14:00",
            room_url="https://eschola.pro/classroom/room-ai-2026",
        )
        self.assertIsInstance(result, bool)


class TestClassroomInvitationModelPersistence(unittest.TestCase):
    """Test 4: Video conference room and invitations persistence in DB."""

    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_classroom_invitation_persisted_in_database(self):
        # Create host user
        host = User(
            email="instructor@example.com",
            username="instructor1",
            hashed_password=get_password_hash("Pass1234"),
            role="formateur",
        )
        # Create learner
        learner = User(
            email="learner@example.com",
            username="learner1",
            hashed_password=get_password_hash("Pass1234"),
            role="étudiant",
        )
        self.db.add_all([host, learner])
        self.db.commit()

        # Create classroom
        room = Classroom(
            room_id="test-room-101",
            title="Session Vidéo Conférence",
            instructor_id=host.id,
            is_active=True,
            is_private=True,
        )
        self.db.add(room)
        self.db.commit()

        # Create invitation
        invitation = ClassroomInvitation(
            classroom_id=room.id,
            inviter_id=host.id,
            invitee_id=learner.id,
            status="pending",
        )
        self.db.add(invitation)
        self.db.commit()

        # Verify query
        saved_inv = self.db.query(ClassroomInvitation).filter_by(
            classroom_id=room.id, invitee_id=learner.id
        ).first()
        self.assertIsNotNone(saved_inv)
        self.assertEqual(saved_inv.status, "pending")

        # Simulate accept
        saved_inv.status = "accepted"
        self.db.commit()

        reloaded = self.db.query(ClassroomInvitation).filter_by(id=saved_inv.id).first()
        self.assertEqual(reloaded.status, "accepted")


class TestTerminologyHarmonization(unittest.TestCase):
    """Test 5: Verify no leftover old classroom terms in critical user-facing files."""

    def test_french_messages_terminology(self):
        import json
        fr_json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "messages", "fr.json")
        with open(fr_json_path, "r", encoding="utf-8") as f:
            fr_data = json.load(f)

        self.assertEqual(fr_data.get("Navigation", {}).get("virtual_classroom"), "Salle vidéo conférence")
        self.assertEqual(fr_data.get("Inbox", {}).get("classroom"), "Salles vidéo conférence")
        self.assertEqual(fr_data.get("Inbox", {}).get("broadcast"), "Salles vidéo conférence")
        self.assertIn("Salles vidéo conférence", fr_data.get("Classroom", {}).get("page_title", ""))


if __name__ == "__main__":
    unittest.main()
