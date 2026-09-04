import os
import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.api.deps import CurrentUser
from app.core.sanitizer import (
    ALLOWED_EXTENSIONS,
    FORBIDDEN_EXTENSIONS,
    is_safe_extension,
    sanitize_filename,
)

router = APIRouter()

MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_VIDEO_SIZE = 60 * 1024 * 1024       # 60 MB


def get_base_url(request: Request) -> str:
    # Check for reverse proxy / Railway / Nginx forwarded headers
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https" if "https" in str(request.base_url) else "http")
        return f"{proto}://{forwarded_host}"
    return f"{request.url.scheme}://{request.client.host if request.client else '127.0.0.1'}:{request.url.port or 8000}"


def save_upload_file_securely(
    file: UploadFile,
    subfolder: str,
    max_size: int = MAX_ATTACHMENT_SIZE,
    allowed_exts: set[str] | None = None,
) -> tuple[str, str, str]:
    """
    Secure file writer:
    - Sanitizes original filename against Path Traversal
    - Enforces extension whitelist and executable/script blacklist
    - Enforces maximum file size limit (streaming chunk verification)
    - Emits HTTP 400 for forbidden extensions and HTTP 413 for oversized files
    """
    raw_filename = file.filename or "file"
    safe_name = sanitize_filename(raw_filename)
    ext = safe_name.split(".")[-1].lower() if "." in safe_name else ""

    if not ext or not is_safe_extension(ext):
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier interdit (.{(ext or 'inconnu')}). Les scripts (.php, .html, .js) et exécutables (.exe, .bat, .sh) sont strictement rejetés.",
        )

    if allowed_exts and ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Extension .{ext} non prise en charge pour cette catégorie.",
        )

    dest_dir = os.path.join("uploads", subfolder)
    os.makedirs(dest_dir, exist_ok=True)
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(dest_dir, unique_filename)

    total_bytes = 0
    chunk_size = 1024 * 1024  # 1MB
    try:
        with open(filepath, "wb") as buffer:
            while chunk := file.file.read(chunk_size):
                total_bytes += len(chunk)
                if total_bytes > max_size:
                    buffer.close()
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Fichier trop volumineux. La taille maximale autorisée est de {max_size // (1024 * 1024)} Mo.",
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=f"Échec de l'enregistrement sécurisé du fichier: {e!s}")

    return unique_filename, safe_name, ext


@router.post("/image")
def upload_image_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload an image file securely (JPG, PNG, WebP, GIF).
    """
    image_allowed = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "ico"}
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier fourni n'est pas une image valide.")

    unique_filename, safe_name, ext = save_upload_file_securely(
        file=file,
        subfolder="images",
        max_size=15 * 1024 * 1024,
        allowed_exts=image_allowed,
    )

    url = f"{get_base_url(request)}/uploads/images/{unique_filename}"
    return {"url": url, "filename": safe_name}


@router.post("/document")
def upload_document_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload a document file securely (PDF, Word, Excel, PowerPoint, TXT, CSV, Zip).
    """
    doc_allowed = {
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf",
        "odt", "ods", "odp", "zip", "rar", "7z"
    }
    unique_filename, safe_name, ext = save_upload_file_securely(
        file=file,
        subfolder="documents",
        max_size=MAX_ATTACHMENT_SIZE,
        allowed_exts=doc_allowed,
    )

    url = f"{get_base_url(request)}/uploads/documents/{unique_filename}"
    return {"url": url, "filename": safe_name}


@router.post("/video")
def upload_video_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload a video file securely (MP4, WebM, MOV, MKV).
    """
    video_allowed = {"mp4", "webm", "mov", "mkv", "avi"}
    if file.content_type and not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Le fichier fourni n'est pas une vidéo valide.")

    unique_filename, safe_name, ext = save_upload_file_securely(
        file=file,
        subfolder="videos",
        max_size=MAX_VIDEO_SIZE,
        allowed_exts=video_allowed,
    )

    url = f"{get_base_url(request)}/uploads/videos/{unique_filename}"
    return {"url": url, "filename": safe_name}


@router.post("/chat-file")
def upload_chat_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload any classroom chat attachment (document, audio, video, image, text).
    """
    unique_filename, safe_name, ext = save_upload_file_securely(
        file=file,
        subfolder="chat",
        max_size=MAX_ATTACHMENT_SIZE,
        allowed_exts=ALLOWED_EXTENSIONS,
    )

    file_category = "document"
    if ext in ["mp3", "wav", "ogg", "m4a", "aac", "flac"]:
        file_category = "audio"
    elif ext in ["mp4", "webm", "mov", "mkv", "avi"]:
        file_category = "video"
    elif ext in ["jpg", "jpeg", "png", "webp", "gif", "bmp", "ico"]:
        file_category = "image"

    url = f"{get_base_url(request)}/uploads/chat/{unique_filename}"
    return {
        "url": url,
        "filename": safe_name,
        "category": file_category,
        "ext": ext,
    }


@router.post("")
@router.post("/")
@router.post("/file")
def upload_any_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload an attachment or deliverable file securely.
    Guaranteed protection against malicious executables, web shells, and scripts.
    """
    unique_filename, safe_name, ext = save_upload_file_securely(
        file=file,
        subfolder="files",
        max_size=MAX_ATTACHMENT_SIZE,
        allowed_exts=ALLOWED_EXTENSIONS,
    )

    url = f"{get_base_url(request)}/uploads/files/{unique_filename}"
    return {
        "url": url,
        "file_url": url,
        "filename": safe_name,
        "file_type": ext,
    }
