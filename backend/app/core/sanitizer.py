"""
Security sanitization and validation utilities for E-Schola Pro.
Protects against XSS, HTML/Script injection, dangerous URLs, malicious uploads, and path traversal.
"""

import html
import re
from urllib.parse import urlparse

# Extensions strictly forbidden for uploads (executables, scripts, web shells, raw HTML)
FORBIDDEN_EXTENSIONS = {
    "exe", "bat", "cmd", "sh", "bash", "vbs", "vbe", "js", "jse", "wsf", "wsh",
    "ps1", "ps1xml", "ps2", "psc1", "psc2", "scr", "msi", "msp", "com", "pif",
    "reg", "hta", "cpl", "msc", "jar", "php", "phtml", "php3", "php4", "php5",
    "phps", "html", "htm", "xhtml", "shtml", "jsp", "jspx", "asp", "aspx", "asa",
    "py", "pyc", "pyw", "dll", "so", "bin", "elf", "cgi", "pl", "vxd", "drv"
}

# Allowed document, image, audio, and video extensions
ALLOWED_EXTENSIONS = {
    # Documents
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
    "odt", "ods", "odp", "zip", "rar", "7z", "tar", "gz",
    # Images
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "ico",
    # Audio
    "mp3", "wav", "ogg", "m4a", "aac", "flac",
    # Video
    "mp4", "webm", "mov", "mkv", "avi"
}

# Regex to detect dangerous inline scripts and event handlers
SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL)
HTML_TAG_RE = re.compile(r"<[^>]+>", re.IGNORECASE)
DANGEROUS_EVENTS_RE = re.compile(r"\b(on[a-z]+)\s*=", re.IGNORECASE)
CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def sanitize_text(text: str | None, max_length: int = 50000, strip_html: bool = True) -> str:
    """
    Sanitize text input to prevent Stored XSS and buffer exhaustion.
    Strips control characters, removes script tags, and optionally strips all HTML.
    """
    if not text:
        return ""

    # Remove null bytes and non-printable control characters (except newline / tab)
    clean = CONTROL_CHARS_RE.sub("", text)

    # Remove script tags entirely
    clean = SCRIPT_TAG_RE.sub("", clean)

    # Remove inline event attributes (e.g. onerror=, onclick=)
    clean = DANGEROUS_EVENTS_RE.sub("", clean)

    if strip_html:
        # Strip all HTML tags to prevent HTML injection
        clean = HTML_TAG_RE.sub("", clean)
        # Unescape any preexisting entities then re-sanitize
        clean = html.unescape(clean)
    else:
        # If keeping basic formatting, escape dangerous characters
        clean = html.escape(clean)

    clean = clean.strip()
    if len(clean) > max_length:
        clean = clean[:max_length]

    return clean


def sanitize_subject(subject: str | None, max_length: int = 255) -> str:
    """
    Sanitize message subject.
    """
    if not subject:
        return "(Sans objet)"
    clean = sanitize_text(subject, max_length=max_length, strip_html=True)
    # Replace newlines with space to prevent email header injection
    clean = re.sub(r"[\r\n]+", " ", clean).strip()
    return clean or "(Sans objet)"


def sanitize_attachment_url(url: str | None) -> str | None:
    """
    Validates attachment URL to prevent JavaScript execution (javascript:, data:text/html, etc.).
    Only allows:
    - Relative paths starting with /uploads/ or /api/
    - Absolute HTTP/HTTPS URLs
    - Safe image data URIs (data:image/(png|jpeg|webp|gif);base64,...)
    """
    if not url:
        return None

    clean_url = url.strip()

    # Reject protocol-relative URLs (//attacker.com)
    if clean_url.startswith("//"):
        return None

    # Allowed safe relative endpoints
    if clean_url.startswith("/uploads/") or clean_url.startswith("/api/"):
        return clean_url

    # Safe image data URIs
    if clean_url.startswith("data:image/") and ";base64," in clean_url:
        # Verify valid image MIME type
        match = re.match(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$", clean_url)
        if match:
            return clean_url
        return None

    # Disallow pseudo-protocols immediately
    lower = clean_url.lower()
    dangerous_protocols = ["javascript:", "vbscript:", "data:", "file:", "about:", "blob:"]
    for proto in dangerous_protocols:
        if lower.startswith(proto):
            return None

    # Parse absolute URL
    try:
        parsed = urlparse(clean_url)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            return clean_url
    except Exception:
        return None

    return None


def sanitize_filename(filename: str | None, max_length: int = 255) -> str:
    """
    Sanitizes a filename to prevent Path Traversal attacks.
    Removes path separators and directory traversal sequences.
    """
    if not filename:
        return "attachment"

    # Remove null bytes
    clean = filename.replace("\x00", "")

    # Remove path directory separators (both Windows and Unix)
    clean = re.sub(r"[/\\]+", "", clean)

    # Remove directory traversal sequences
    clean = clean.replace("..", "")

    # Strip control characters
    clean = CONTROL_CHARS_RE.sub("", clean).strip()

    # Truncate if needed while preserving extension
    if len(clean) > max_length:
        parts = clean.rsplit(".", 1)
        if len(parts) == 2:
            base, ext = parts
            clean = f"{base[:max_length - len(ext) - 1]}.{ext}"
        else:
            clean = clean[:max_length]

    return clean or "attachment"


def is_safe_extension(ext: str) -> bool:
    """
    Checks if a file extension is allowed and not in the forbidden blacklist.
    """
    clean_ext = ext.strip().lower().lstrip(".")
    if not clean_ext:
        return False
    if clean_ext in FORBIDDEN_EXTENSIONS:
        return False
    return clean_ext in ALLOWED_EXTENSIONS
