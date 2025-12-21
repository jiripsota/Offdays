import httpx
from time import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from .config import settings
from .models import OAuthAccount

async def refresh_google_token(db: Session, oauth: OAuthAccount) -> str:
    """
    Refresh the Google Access Token if expired.
    Returns the valid access token.
    """
    # If token is still valid (with 60sec buffer), return it
    if oauth.expires_at and oauth.expires_at > int(time()) + 60:
        return oauth.access_token
    
    if not oauth.refresh_token:
        raise ValueError("No refresh token available. User must log in again to grant offline access.")
    
    token_url = "https://oauth2.googleapis.com/token"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_url,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": oauth.refresh_token,
                "grant_type": "refresh_token",
            },
        )
        
        if resp.status_code != 200:
            print(f"Failed to refresh token: {resp.text}")
            raise ValueError("Token refresh failed. User must log in again.")
            
        data = resp.json()
        
        oauth.access_token = data["access_token"]
        if data.get("expires_in"):
            oauth.expires_at = int(time()) + data["expires_in"]
        
        # Save updated tokens
        db.add(oauth)
        db.commit()
        db.refresh(oauth)
        
        return oauth.access_token

async def search_google_users(access_token: str, query: str) -> List[Dict[str, Any]]:
    """
    Search users via Google People API.
    Attempts to search both personal contacts and the Workspace directory.
    """
    # Use searchDirectoryPeople endpoint for Workspace-wide search
    # This requires directory.readonly scope
    url = "https://people.googleapis.com/v1/people:searchDirectoryPeople"
    params = {
        "query": query,
        "readMask": "names,emailAddresses,photos",
        "sources": ["DIRECTORY_SOURCE_TYPE_DOMAIN_CONTACT", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"]
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if resp.status_code != 200:
            print(f"Google People API Error: {resp.text}")
            return []
            
        data = resp.json()
        
        # Local filtering to avoid Google's "weird" broad matches (e.g. Petr for Anna)
        results = []
        q = query.lower()
        for person in data.get("people", []):
            # Extract basic info
            name = "No Name"
            if person.get("names"):
                name = person["names"][0].get("displayName", "No Name")
            
            email = None
            if person.get("emailAddresses"):
                email = person["emailAddresses"][0].get("value")
            
            avatar = None
            if person.get("photos"):
                avatar = person["photos"][0].get("url")
            
            if email:
                # Basic fuzzy/substring check to filter out obviously wrong results
                name_match = q in name.lower()
                email_match = q in email.lower()
                
                if name_match or email_match:
                    results.append({
                        "name": name,
                        "email": email,
                        "avatar": avatar # Renamed from avatar_url to match frontend
                    })
                
        return results
