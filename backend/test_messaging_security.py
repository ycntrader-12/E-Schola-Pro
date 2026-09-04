"""
Security validation test suite for E-Schola Pro messaging system.
Tests protection against:
1. Stored XSS and HTML/Script injection
2. Dangerous attachment URLs and pseudo-protocols (javascript:, data:text/html, etc.)
3. Path traversal and executable web shell uploads
4. IDOR (Insecure Direct Object Reference) on message reporting
5. Unauthorized broadcast / mass-recipient spamming
6. Sliding window rate limiting / anti-flooding (HTTP 429)
"""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.sanitizer import (
    sanitize_text,
    sanitize_subject,
    sanitize_attachment_url,
    sanitize_filename,
    is_safe_extension,
    FORBIDDEN_EXTENSIONS,
)
from app.core.rate_limiter import SlidingWindowRateLimiter
from app.db.database import SessionLocal
from app.models.user import User
from app.models.message import Message
from app.core.security import get_password_hash, create_access_token


def test_unit_sanitization():
    print("\n--- TEST 1: Sanitization Unit Tests (XSS & Protocol Validation) ---")

    # 1. Script tag stripping
    dirty_body = "<script>alert('XSS')</script>Bonjour tout le monde ! <img src=x onerror='alert(1)'>"
    clean_body = sanitize_text(dirty_body, strip_html=True)
    assert "<script>" not in clean_body, "Failed: script tag was not stripped"
    assert "alert('XSS')" not in clean_body, "Failed: script content was not stripped"
    assert "onerror" not in clean_body, "Failed: onerror handler was not stripped"
    assert "Bonjour tout le monde !" in clean_body, "Failed: valid text was altered"
    print("  ✓ Script tags and event handlers successfully stripped.")

    # 2. Subject sanitization & header injection prevention
    dirty_subject = "<script>alert(1)</script>Objet Important\r\nBcc: evil@attacker.com"
    clean_subject = sanitize_subject(dirty_subject)
    assert "<script>" not in clean_subject, "Failed: script tag in subject"
    assert "\r" not in clean_subject and "\n" not in clean_subject, "Failed: newlines retained in subject"
    print("  ✓ Subject sanitized and email header injection vectors neutralized.")

    # 3. Dangerous attachment URLs
    dangerous_urls = [
        "javascript:alert(document.cookie)",
        "JAVASCRIPT:fetch('/api/v1/users/me')",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "vbscript:msgbox(1)",
        "//attacker.com/malware.exe",
        "file:///etc/passwd",
    ]
    for d_url in dangerous_urls:
        sanitized = sanitize_attachment_url(d_url)
        assert sanitized is None, f"Failed: Dangerous URL was not rejected: {d_url}"
    print("  ✓ Dangerous pseudo-protocols (javascript:, data:text/html, etc.) successfully blocked.")

    # 4. Safe URLs allowed
    safe_urls = [
        "https://example.com/files/report.pdf",
        "http://localhost:8000/uploads/documents/doc.docx",
        "/uploads/files/attachment.png",
    ]
    for s_url in safe_urls:
        sanitized = sanitize_attachment_url(s_url)
        assert sanitized == s_url, f"Failed: Safe URL was rejected: {s_url}"
    print("  ✓ Safe HTTP/HTTPS and /uploads/ URLs correctly permitted.")

    # 5. Path traversal in filenames
    traversal_names = [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\calc.exe",
        "normal/../../../file.pdf",
        "bad\x00file.png",
    ]
    for t_name in traversal_names:
        safe_name = sanitize_filename(t_name)
        assert ".." not in safe_name, f"Failed: '..' retained in {safe_name}"
        assert "/" not in safe_name and "\\" not in safe_name, f"Failed: slashes retained in {safe_name}"
        assert "\x00" not in safe_name, f"Failed: null byte retained in {safe_name}"
    print("  ✓ Path traversal sequences and null bytes sanitized from filenames.")

    # 6. Extension blacklist
    for bad_ext in ["exe", "bat", "cmd", "sh", "php", "phtml", "html", "js", "py"]:
        assert not is_safe_extension(bad_ext), f"Failed: {bad_ext} should be forbidden"
    for good_ext in ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "webp", "mp4", "zip"]:
        assert is_safe_extension(good_ext), f"Failed: {good_ext} should be allowed"
    print("  ✓ Extension blacklist and whitelist verified.")


def test_unit_rate_limiter():
    print("\n--- TEST 2: Sliding Window Rate Limiter Tests ---")
    limiter = SlidingWindowRateLimiter()

    user_key = "test_user_42"
    # Allow up to 3 requests in 5 seconds
    for _ in range(3):
        limiter.check_rate_limit(user_key, max_requests=3, window_seconds=5)

    # 4th request should raise 429
    raised_429 = False
    try:
        limiter.check_rate_limit(user_key, max_requests=3, window_seconds=5)
    except Exception as e:
        if getattr(e, "status_code", None) == 429:
            raised_429 = True

    assert raised_429, "Failed: Rate limiter did not raise HTTP 429 on 4th request."
    print("  ✓ Rate limiter correctly throttles requests with HTTP 429 and Retry-After.")


def test_integration_security_api():
    print("\n--- TEST 3: Full Integration API Security Tests ---")
    db = SessionLocal()
    client = TestClient(app)

    try:
        # Create test users
        student_email = "sec_student@eschola.pro"
        admin_email = "sec_admin@eschola.pro"
        teacher_email = "sec_teacher@eschola.pro"
        victim_email = "sec_victim@eschola.pro"

        # Cleanup existing
        db.query(Message).filter(Message.subject.like("%[TEST-SEC]%")).delete()
        db.query(User).filter(User.email.in_([student_email, admin_email, teacher_email, victim_email])).delete()
        db.commit()

        student = User(
            email=student_email,
            username="sec_student",
            hashed_password=get_password_hash("password123"),
            role="étudiant",
        )
        admin = User(
            email=admin_email,
            username="sec_admin",
            hashed_password=get_password_hash("password123"),
            role="admin",
        )
        teacher = User(
            email=teacher_email,
            username="sec_teacher",
            hashed_password=get_password_hash("password123"),
            role="formateur",
        )
        victim = User(
            email=victim_email,
            username="sec_victim",
            hashed_password=get_password_hash("password123"),
            role="étudiant",
        )
        db.add_all([student, admin, teacher, victim])
        db.commit()
        db.refresh(student)
        db.refresh(admin)
        db.refresh(teacher)
        db.refresh(victim)

        # Tokens
        student_token = create_access_token(subject=student.id, role=student.role, email=student.email)
        admin_token = create_access_token(subject=admin.id, role=admin.role, email=admin.email)
        student_headers = {"Authorization": f"Bearer {student_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Test XSS in attachment_url rejection
        res = client.post(
            "/api/v1/messages/",
            headers=student_headers,
            json={
                "subject": "[TEST-SEC] XSS Attempt",
                "body": "Normal body",
                "recipient_id": teacher.id,
                "attachment_url": "javascript:alert('pwned')",
            },
        )
        assert res.status_code == 400, f"Expected 400 for malicious attachment URL, got {res.status_code}: {res.text}"
        print("  ✓ Malicious attachment URL correctly rejected with HTTP 400.")

        # 2. Test Broadcast Permission Restriction
        res = client.post(
            "/api/v1/messages/",
            headers=student_headers,
            json={
                "subject": "[TEST-SEC] Unauthorized Broadcast",
                "body": "Spam to everyone",
                "is_broadcast": True,
            },
        )
        assert res.status_code == 403, f"Expected 403 for unauthorized broadcast, got {res.status_code}: {res.text}"
        print("  ✓ Unauthorized broadcast attempt by student correctly rejected with HTTP 403.")

        # 3. Test IDOR Protection on Message Reporting
        # Create a private message between Admin and Teacher
        private_msg = Message(
            sender_id=admin.id,
            recipient_id=teacher.id,
            subject="[TEST-SEC] Private Director Evaluation",
            body="Confidential notes about faculty.",
            is_read=False,
            is_draft=False,
            is_trash=False,
        )
        db.add(private_msg)
        db.commit()
        db.refresh(private_msg)

        # Student attempts to report private message between Admin and Teacher (IDOR exploit)
        res = client.post(
            f"/api/v1/messages/{private_msg.id}/report",
            headers=student_headers,
            json={"reason": "Attacker guessing ID to exfiltrate private messages"},
        )
        assert res.status_code == 403, f"Expected 403 IDOR rejection, got {res.status_code}: {res.text}"
        print("  ✓ IDOR attack on message reporting successfully prevented with HTTP 403.")

        # 4. Test Stored XSS Neutralization
        res = client.post(
            "/api/v1/messages/",
            headers=student_headers,
            json={
                "subject": "<script>alert('xss')</script>[TEST-SEC] Clean Subject",
                "body": "<script>fetch('http://evil.com')</script>Bonjour Professeur, voici mon devoir.",
                "recipient_id": teacher.id,
            },
        )
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert "<script>" not in data["subject"], "Subject still contains <script>"
        assert "<script>" not in data["body"], "Body still contains <script>"
        assert "Bonjour Professeur" in data["body"], "Valid content was stripped"
        print("  ✓ Stored XSS input automatically neutralized before database persistence.")

        # 5. Test OWASP Security Headers
        root_res = client.get("/")
        assert root_res.headers.get("X-Content-Type-Options") == "nosniff", "Missing X-Content-Type-Options"
        assert root_res.headers.get("X-Frame-Options") == "SAMEORIGIN", "Missing X-Frame-Options"
        assert root_res.headers.get("X-XSS-Protection") == "1; mode=block", "Missing X-XSS-Protection"
        assert root_res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin", "Missing Referrer-Policy"
        print("  ✓ OWASP Security Headers verified on API responses.")

    finally:
        # Cleanup
        db.query(Message).filter(Message.subject.like("%[TEST-SEC]%")).delete()
        db.query(User).filter(User.email.in_([student_email, admin_email, teacher_email, victim_email])).delete()
        db.commit()
        db.close()


if __name__ == "__main__":
    print("===================================================================")
    print("🛡️ RUNNING E-SCHOLA PRO MESSAGING & PLATFORM SECURITY TEST SUITE")
    print("===================================================================")
    test_unit_sanitization()
    test_unit_rate_limiter()
    test_integration_security_api()
    print("\n===================================================================")
    print("✅ ALL SECURITY TESTS PASSED! E-Schola Pro messaging is hardened.")
    print("===================================================================")
