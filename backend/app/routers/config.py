from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/service-accounts")
def get_service_accounts():
    """
    Returns the service account email that should be granted access
    to storage backends (Drive, Firestore).
    
    Same service account is used for both.
    """
    return {
        "drive": settings.google_service_account,
        "firestore": settings.google_service_account,
    }
