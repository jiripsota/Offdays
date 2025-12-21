from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from ..database import SessionLocal
from ..auth_deps import get_current_user, get_db
from ..models import User, OAuthAccount
from ..google_api import refresh_google_token, search_google_users

router = APIRouter(prefix="/integrations", tags=["integrations"])

@router.get("/google/search-users")
async def search_users(
    query: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search for users in the Google Workspace directory.
    Only available to admins who logged in via Google.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can search Workspace users")
    
    # Find Google OAuth account
    oauth = db.query(OAuthAccount).filter_by(user_id=current_user.id, provider="google").first()
    if not oauth:
        raise HTTPException(
            status_code=400, 
            detail="To search users, you must be logged in with a Google account"
        )
    
    try:
        # 1. Ensure token is fresh
        token = await refresh_google_token(db, oauth)
        
        # 2. Search users
        users = await search_google_users(token, query)
        
        return users
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        print(f"Integration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search Google users")
