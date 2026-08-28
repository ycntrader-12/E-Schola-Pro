import cloudinary
import cloudinary.uploader
import cloudinary.api
from app.core.config import settings

# Initialize Cloudinary if credentials are provided
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )

def is_mock_cloudinary():
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY:
        return True
    if settings.CLOUDINARY_CLOUD_NAME == "your_cloud_name" or settings.CLOUDINARY_API_KEY == "your_api_key":
        return True
    return False

def upload_image(file_data, folder_name="e_schola"):
    """
    Uploads an image to Cloudinary and returns the secure URL.
    """
    if is_mock_cloudinary():
        # Fallback if Cloudinary is not configured yet
        return "https://via.placeholder.com/150?text=No+Cloudinary"
        
    response = cloudinary.uploader.upload(
        file_data, 
        folder=folder_name
    )
    return response.get("secure_url")

def upload_document(file_data, folder_name="e_schola"):
    """
    Uploads a raw document (pdf, docx, etc.) to Cloudinary and returns the secure URL.
    """
    if is_mock_cloudinary():
        # Fallback if Cloudinary is not configured yet
        return "https://example.com/mock-document.pdf"
        
    response = cloudinary.uploader.upload_large(
        file_data, 
        folder=folder_name,
        resource_type="raw"
    )
    return response.get("secure_url")
