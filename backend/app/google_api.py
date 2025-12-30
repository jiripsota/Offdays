import httpx
from time import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from .config import settings
from .models import OAuthAccount
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest

_sa_token_cache = {"token": None, "expiry": 0}

def get_service_account_token(scopes: List[str]) -> str:
    """
    Get an access token for the service account.
    Uses a simple in-memory cache to avoid repeated requests.
    """
    now = int(time())
    if _sa_token_cache["token"] and _sa_token_cache["expiry"] > now + 60:
        return _sa_token_cache["token"]

    try:
        creds = service_account.Credentials.from_service_account_file(
            settings.google_service_account_file,
            scopes=scopes
        )
        # Refresh to get access token
        creds.refresh(GoogleRequest())
        
        _sa_token_cache["token"] = creds.token
        _sa_token_cache["expiry"] = int(creds.expiry.timestamp()) if creds.expiry else now + 3600
        
        return creds.token
    except Exception as e:
        print(f"Failed to get service account token: {e}")
        raise e

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

async def create_calendar_event(access_token: str, summary: str, start_date: str, end_date: str, calendar_id: str = "primary") -> str:
    """
    Create an all-day event in the calendar.
    Returns: event_id
    start_date/end_date in "YYYY-MM-DD" format.
    Google Calendar API end.date is exclusive for all-day events.
    """
    url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
    
    event_body = {
        "summary": summary,
        "start": {"date": start_date},
        "end": {"date": end_date}, # Exclusive
        "transparency": "opaque", # Show as busy? Or "transparent" for available? Leave should be Opaque (Busy).
        "visibility": "public" # Visible to others
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=event_body,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if resp.status_code < 200 or resp.status_code >= 300:
            error_detail = resp.text
            try:
                error_json = resp.json()
                error_detail = error_json.get("error", {}).get("message", resp.text)
            except: pass
            print(f"Failed to create Google Calendar event: {error_detail}")
            raise ValueError(f"Google Calendar API Error: {error_detail}")
            
        data = resp.json()
        return data["id"]

async def delete_calendar_event(access_token: str, event_id: str, calendar_id: str = "primary"):
    """
    Delete an event from the calendar.
    """
    url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events/{event_id}"
    
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            url,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code != 204 and resp.status_code != 404:
             print(f"Failed to delete Google Calendar event: {resp.text}")
             # Not raising error to avoid blocking logic if event is already gone
