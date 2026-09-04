import os
import shutil
import uuid
from typing import Any

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.api.deps import CurrentUser

router = APIRouter()


def get_base_url(request: Request) -> str:
    # Check for reverse proxy / Railway / Nginx forwarded headers
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if forwarded_host:
        proto = request.headers.get("x-forwarded-proto", "https" if "https" in str(request.base_url) else "http")
        return f"{proto}://{forwarded_host}"
    return f"{request.url.scheme}://{request.client.host if request.client else '127.0.0.1'}:{request.url.port or 8000}"


@router.post("/image")
def upload_image_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload an image file locally.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    try:
        os.makedirs("uploads/images", exist_ok=True)
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "images", filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"{get_base_url(request)}/uploads/images/{filename}"
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {e!s}")


@router.post("/document")
def upload_document_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload a document file locally.
    """
    allowed_extensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]
    ext = file.filename.split(".")[-1].lower()

    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, detail="File provided is not a supported document format."
        )

    try:
        os.makedirs("uploads/documents", exist_ok=True)
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "documents", filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"{get_base_url(request)}/uploads/documents/{filename}"
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document upload failed: {e!s}")


@router.post("/video")
def upload_video_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload a video file locally.
    """
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File provided is not a video.")

    try:
        os.makedirs("uploads/videos", exist_ok=True)
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "videos", filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"{get_base_url(request)}/uploads/videos/{filename}"
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video upload failed: {e!s}")


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
    allowed_extensions = [
        # Documents & text
        "pdf",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
        "txt",
        "csv",
        "zip",
        # Audio
        "mp3",
        "wav",
        "ogg",
        "m4a",
        "aac",
        # Video
        "mp4",
        "webm",
        "mov",
        "mkv",
        # Images
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
    ]
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Extension .{ext} non supportée. Formats autorisés : PDF, Office, TXT, Audio, Vidéo, Images.",
        )

    try:
        os.makedirs("uploads/chat", exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "chat", unique_name)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Detect category
        file_category = "document"
        if ext in ["mp3", "wav", "ogg", "m4a", "aac"]:
            file_category = "audio"
        elif ext in ["mp4", "webm", "mov", "mkv"]:
            file_category = "video"
        elif ext in ["jpg", "jpeg", "png", "webp", "gif"]:
            file_category = "image"

        url = f"{get_base_url(request)}/uploads/chat/{unique_name}"
        return {
            "url": url,
            "filename": file.filename,
            "category": file_category,
            "ext": ext,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e!s}")


@router.post("/file")
def upload_any_file(
    *,
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Upload any file format (for deliverables, etc.).
    """
    try:
        os.makedirs("uploads/files", exist_ok=True)

        # Get extension if exists
        ext = ""
        if "." in file.filename:
            ext = file.filename.split(".")[-1]

        filename = f"{uuid.uuid4().hex}"
        if ext:
            filename += f".{ext}"

        filepath = os.path.join("uploads", "files", filename)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        url = f"{get_base_url(request)}/uploads/files/{filename}"
        return {"url": url, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {e!s}")
