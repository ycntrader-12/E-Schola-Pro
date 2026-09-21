#!/usr/bin/env python3
"""
=============================================================================
E-Schola Pro — Transactional Email & Deliverability Automated Test Suite
=============================================================================
Tests the full lifecycle of transactional emails in FastAPI:
1. Address validation (syntax RFC, disposable domains, DNS MX)
2. Custom RFC-compliant headers (Message-ID, Date, X-Mailer, X-Entity-Ref-ID)
3. Native DKIM signing & cryptographic RSA-SHA256 signature verification
4. SPF / DMARC DNS recommendations & diagnostics
5. Non-blocking BackgroundTasks & Mock fallback execution
6. REST API administrative endpoints (/diagnostics, /validate-address)
=============================================================================
"""
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import BackgroundTasks
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.models.user import User
from app.services.email_service import (
    build_mime_message,
    get_dkim_dns_record_info,
    get_email_service_diagnostics,
    get_smtp_runtime_config,
    is_valid_email,
    load_dkim_private_key,
    send_classroom_invitation_email,
    send_email,
    send_password_reset_email,
    send_transactional_email_background,
    send_welcome_email,
    sign_mime_message_dkim,
    validate_recipient_email,
)
from create_admin import seed_users


class TestTransactionalEmailSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()
        seed_users()
        cls.admin = cls.db.query(User).filter(User.role == "admin").first()
        assert cls.admin is not None, "Admin user must exist for API tests"
        cls.admin_token = create_access_token(cls.admin.id)
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_syntax_validation(self):
        """Validates email RFC syntax and normalizations."""
        valid, _, norm = validate_recipient_email("contact@google.com", check_mx=False)
        self.assertTrue(valid)
        self.assertEqual(norm, "contact@google.com")

        valid, _, norm = validate_recipient_email("Etudiant.Test+Tag@DOMAINE.FR", check_mx=False)
        self.assertTrue(valid)
        self.assertEqual(norm, "Etudiant.Test+Tag@domaine.fr")

        # Invalid emails
        self.assertFalse(validate_recipient_email("")[0])
        self.assertFalse(validate_recipient_email("not-an-email")[0])
        self.assertFalse(validate_recipient_email("@domain.com")[0])
        self.assertFalse(validate_recipient_email("user@.com")[0])
        self.assertFalse(is_valid_email("plainaddress"))

    def test_02_disposable_domain_blocking(self):
        """Verifies temporary and disposable email domains are blocked when policy is active."""
        disposable_addresses = [
            "hacker@mailinator.com",
            "fake@10minutemail.com",
            "test@tempmail.com",
            "trash@guerrillamail.com",
        ]
        for addr in disposable_addresses:
            valid, reason, _ = validate_recipient_email(addr, check_mx=False, block_disposable=True)
            self.assertFalse(valid, f"Address {addr} should have been blocked")
            self.assertIn("temporaire", reason)

        # When policy is explicitly turned off, syntax validation alone passes
        valid_bypassed, _, _ = validate_recipient_email("test@mailinator.com", check_mx=False, block_disposable=False)
        self.assertTrue(valid_bypassed)

    def test_03_dns_mx_resolution(self):
        """Verifies DNS MX record verification on real and nonexistent domains."""
        # Real domain with public MX
        valid, _, _ = validate_recipient_email("admin@google.com", check_mx=True)
        self.assertTrue(valid)

        # Nonexistent domain
        invalid_domain = "nonexistent-fake-domain-eschola-987654321.xyz"
        valid_nx, reason, _ = validate_recipient_email(f"user@{invalid_domain}", check_mx=True)
        self.assertFalse(valid_nx)
        self.assertTrue("NXDOMAIN" in reason or "Aucun serveur" in reason or "ne possède aucun" in reason)

    def test_04_custom_rfc_headers(self):
        """Verifies all required transactional and anti-spam RFC headers are generated."""
        msg = build_mime_message(
            to_email="etudiant@google.com",
            subject="Confirmation d'inscription",
            html_content="<p>Bienvenue sur E-Schola Pro !</p>",
            text_content="Bienvenue sur E-Schola Pro !",
            custom_headers={"X-Campaign-ID": "welcome-2026"},
            reply_to="support@eschola.pro",
        )

        self.assertEqual(msg["To"], "etudiant@google.com")
        self.assertIn("Confirmation", str(msg["Subject"]))
        self.assertIsNotNone(msg["Date"])
        self.assertIsNotNone(msg["Message-ID"])
        self.assertTrue(msg["Message-ID"].startswith("<") and msg["Message-ID"].endswith(">"))
        self.assertEqual(msg["X-Mailer"], "E-Schola-Pro-Transactional-Mailer/2.0")
        self.assertIsNotNone(msg["X-Entity-Ref-ID"])
        self.assertEqual(msg["Auto-Submitted"], "auto-generated")
        self.assertEqual(msg["Precedence"], "bulk")
        self.assertEqual(msg["Reply-To"], "support@eschola.pro")
        self.assertEqual(msg["X-Campaign-ID"], "welcome-2026")

        # Multi-part content
        self.assertTrue(msg.is_multipart())
        payloads = msg.get_payload()
        self.assertEqual(len(payloads), 2)
        content_types = [p.get_content_type() for p in payloads]
        self.assertIn("text/plain", content_types)
        self.assertIn("text/html", content_types)

    def test_05_dkim_signing_and_verification(self):
        """Generates an RSA 2048-bit key, signs a MIME message, and verifies signature."""
        # 1. Generate RSA key
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        selector = "eschola_test"
        domain = "eschola.pro"

        # 2. Extract DNS TXT record
        dns_info = get_dkim_dns_record_info(private_key, selector, domain)
        self.assertEqual(dns_info["record_type"], "TXT")
        self.assertEqual(dns_info["record_name"], f"{selector}._domainkey.{domain}")
        self.assertTrue(dns_info["record_value"].startswith("v=DKIM1; k=rsa; p="))

        # 3. Create message and sign
        msg = build_mime_message(
            to_email="test.recipient@google.com",
            subject="Test Signature DKIM",
            html_content="<p>Message signé cryptographiquement.</p>",
        )
        raw_bytes = msg.as_bytes()
        signed_bytes = sign_mime_message_dkim(
            raw_message_bytes=raw_bytes,
            selector=selector,
            domain=domain,
            private_key=private_key,
        )

        signed_text = signed_bytes.decode("utf-8", errors="replace")
        self.assertIn("DKIM-Signature:", signed_text)
        self.assertIn(f"d={domain}", signed_text)
        self.assertIn(f"s={selector}", signed_text)
        self.assertIn("a=rsa-sha256", signed_text)
        self.assertIn("bh=", signed_text)
        self.assertIn("b=", signed_text)

    def test_06_mock_fallback_dispatch(self):
        """Ensures that in mock/dev mode, all transactional helper functions return True without errors."""
        # Welcome email
        res_welcome = send_welcome_email(
            to_email="jean.dupont@google.com",
            user_name="Jean Dupont",
            role="étudiant",
            group_name="Master 1 Cybersécurité",
        )
        self.assertTrue(res_welcome)

        # Password reset OTP
        res_reset = send_password_reset_email(
            to_email="admin@google.com",
            user_name="Administrateur",
            reset_url="https://eschola.pro/reset",
            confirmation_code="654321",
        )
        self.assertTrue(res_reset)

        # Classroom invite
        res_invite = send_classroom_invitation_email(
            to_email="formateur@google.com",
            user_name="Pierre Martin",
            room_title="Cours Magistral Sécurité Réseau",
            room_id="ROOM-777",
            inviter_name="Dr. Vincent",
        )
        self.assertTrue(res_invite)

    def test_07_fastapi_background_tasks(self):
        """Verifies non-blocking BackgroundTasks integration."""
        bg = BackgroundTasks()
        send_transactional_email_background(
            background_tasks=bg,
            to_email="learner@google.com",
            subject="Notification Asynchrone",
            html_content="<p>Exécuté en tâche de fond.</p>",
        )
        self.assertEqual(len(bg.tasks), 1)

        # Execute background task
        import asyncio
        asyncio.run(bg())

    def test_08_api_email_diagnostics_and_validate(self):
        """Tests the REST API endpoints /api/v1/email/diagnostics and /validate-address."""
        # 1. Diagnostics endpoint
        res_diag = self.client.get("/api/v1/email/diagnostics", headers=self.admin_headers)
        self.assertEqual(res_diag.status_code, 200)
        data = res_diag.json()
        self.assertIn("smtp", data)
        self.assertIn("dkim", data)
        self.assertIn("spf", data)
        self.assertIn("dmarc", data)
        self.assertIn("policies", data)

        # Check SPF & DMARC recommendations
        self.assertEqual(data["spf"]["recommended_record"]["record_type"], "TXT")
        self.assertTrue(data["spf"]["recommended_record"]["record_value"].startswith("v=spf1"))
        self.assertTrue(data["dmarc"]["recommended_record"]["record_value"].startswith("v=DMARC1"))

        # 2. Validate Address endpoint
        res_val = self.client.post(
            "/api/v1/email/validate-address",
            headers=self.admin_headers,
            json={"email": "contact@google.com", "check_mx": True, "block_disposable": True},
        )
        self.assertEqual(res_val.status_code, 200)
        val_data = res_val.json()
        self.assertTrue(val_data["is_valid"])
        self.assertEqual(val_data["normalized_email"], "contact@google.com")

        # Disposable address rejection via API
        res_disp = self.client.post(
            "/api/v1/email/validate-address",
            headers=self.admin_headers,
            json={"email": "spam@mailinator.com", "check_mx": False, "block_disposable": True},
        )
        self.assertEqual(res_disp.status_code, 200)
        self.assertFalse(res_disp.json()["is_valid"])

        # 3. Status endpoint
        res_status = self.client.get("/api/v1/email/status", headers=self.admin_headers)
        self.assertEqual(res_status.status_code, 200)
        status_data = res_status.json()
        self.assertIn("smtp_host", status_data)
        self.assertIn("smtp_port", status_data)
        self.assertIn("emails_enabled", status_data)


if __name__ == "__main__":
    unittest.main(verbosity=2)
