import os
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Response, HTTPException, status, Request
from fastapi.responses import RedirectResponse
import jwt
from sqlalchemy.orm import Session

from .auth_deps import get_current_user, get_db
from .schemas import UserRead
from .config import settings
from .database import SessionLocal
from . import models

from .billing.manager import SubscriptionManager
from .billing.google_marketplace import GoogleMarketplaceBillingProvider
from .limiter import limiter # <-- Added

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_EXP_MINUTES = 60




def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXP_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


async def get_google_userinfo_and_tokens(code: str) -> dict:
    # Exchange authorization code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            token_url,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        # Fetch userinfo
        userinfo_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
        
        return {
            "userinfo": userinfo,
            "tokens": tokens
        }


@router.get("/login")
@limiter.limit("10/minute")
def login(request: Request):
    # Build redirect URL to Google's OAuth2 consent screen
    google_auth_endpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/directory.readonly",
        "access_type": "offline",
        "prompt": "select_account consent",
    }
    from urllib.parse import urlencode

    url = f"{google_auth_endpoint}?{urlencode(params)}"
    return {"login_url": url}



async def download_avatar(url: str, user_id: str) -> Optional[str]:
    try:
        # Security: Validate URL is from trusted Google domain to prevent SSRF
        from urllib.parse import urlparse
        parsed_url = urlparse(url)
        if not parsed_url.netloc.endswith(".googleusercontent.com"):
            print(f"Refusing to download avatar from untrusted domain: {parsed_url.netloc}")
            return None

        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                # Local Storage (Fallback / Dev)
                # Only use local storage if NOT in Cloud Run
                if not settings.is_cloud_run:
                    base_dir = os.path.dirname(os.path.dirname(__file__))
                    static_dir = os.path.join(base_dir, "static", "avatars")
                    os.makedirs(static_dir, exist_ok=True)
                    
                    filename = f"{user_id}.jpg"
                    filepath = os.path.join(static_dir, filename)
                    
                    with open(filepath, "wb") as f:
                        f.write(resp.content)
                    
                    return f"/static/avatars/{filename}"
                
                # Cloud Storage (Production)
                else:
                    try:
                        from google.cloud import storage
                        client = storage.Client()
                        bucket = client.bucket(settings.google_storage_bucket)
                        blob = bucket.blob(f"avatars/{user_id}.jpg")
                        
                        blob.upload_from_string(
                            resp.content,
                            content_type="image/jpeg"
                        )
                        
                        # Since we made the bucket public (objectViewer), we can use the public URL
                        # Alternatively, we could make just this object public if bucket isn't.
                        # blob.make_public() 
                        
                        return blob.public_url
                    except Exception as gcs_err:
                        print(f"Failed to upload avatar to GCS: {gcs_err}")
                        return None

    except Exception as e:
        print(f"Failed to download avatar: {e}")
    return None


@router.get("/callback")
@limiter.limit("20/minute")
async def callback(
    request: Request, 
    code: Optional[str] = None, 
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Handle access_denied or other errors from Google
    if error:
        from urllib.parse import quote
        # Redirect to frontend with error code
        # We map specific google errors to our translation keys if needed, 
        # or just pass it through if the frontend handles it.
        # "access_denied" is the standard OAuth error for user rejection.
        return RedirectResponse(
            url=f"{settings.frontend_url.rstrip('/')}/login?error={quote(error)}",
            status_code=303
        )

    if not code:
        # Should not happen in normal flow, but good fallback
        return RedirectResponse(
            url=f"{settings.frontend_url.rstrip('/')}/login?error=missing_code",
            status_code=303
        )

    # Exchange Google authorization code for user info and tokens
    data = await get_google_userinfo_and_tokens(code)
    userinfo = data["userinfo"]
    tokens = data["tokens"]
    
    sub = userinfo["sub"]
    email = userinfo["email"]
    # 'hd' claim is hosted domain (e.g. company.com). If missing, use email domain.
    # 'hd' claim is hosted domain (e.g. company.com). 
    # If it is missing, it is a PERSONAL account (e.g. gmail.com) or unmanaged usage.
    hd = userinfo.get("hd")

    full_name = userinfo.get("name")
    picture_url = userinfo.get("picture")


    # ---------------------------------------------------------
    # SECURITY: Strict HD (Hosted Domain) Enforcement
    # ---------------------------------------------------------
    # We strictly require the 'hd' claim to be present.
    # This automatically filters out all personal Google accounts (@gmail.com)
    # and ensures only users from managed Google Workspace domains can sign in.
    if not hd:
        # Redirect to frontend with error code for translation
        # "error_public_email" is semantically correct here (public/personal email not allowed)
        error_code = "error_public_email"
        from urllib.parse import quote
        return RedirectResponse(
            url=f"{settings.frontend_url.rstrip('/')}/login?error={quote(error_code)}",
            status_code=303
        )
    
    # Define user_domain for usage below (used to find Tenant)
    user_domain = hd

    # 1. Resolve Tenant first to check limits
    tenant = db.query(models.Tenant).filter_by(domain=user_domain).first()
    if not tenant:
        tenant = models.Tenant(
            domain=user_domain,
        )
        db.add(tenant)
        db.flush()
        db.refresh(tenant)

    # 2. Ensure Subscription Exists & Sync
    billing_provider = GoogleMarketplaceBillingProvider()
    billing_provider.sync_subscription(db, tenant)
    
    # 3. Check if user exists (OAuth or Email)
    oauth = (
        db.query(models.OAuthAccount).filter_by(provider="google", subject=sub).first()
    )

    user = None
    if oauth:
        user = oauth.user
    else:
        # Maybe user already exists by email
        user = db.query(models.User).filter_by(email=email).first()

    # 4. If New User -> Check Billing Limits
    if not user:
        sub_manager = SubscriptionManager(db)
        # Check limit only if we are creating a new user
        if not sub_manager.check_usage_limits(tenant.id, adding_users=1):
            error_code = "error_user_limit"
            from urllib.parse import quote
            return RedirectResponse(
                url=f"{settings.frontend_url.rstrip('/')}/login?error={quote(error_code)}",
                status_code=303
            )
            
        user = models.User(email=email, full_name=full_name)
        db.add(user)
        db.flush()
        
        # Link OAuth
        if not oauth:
             oauth = models.OAuthAccount(
                provider="google",
                subject=sub,
                email=email,
                user_id=user.id,
            )
             db.add(oauth)
    else:
        # Existing user, ensure OAuth link
        if not oauth:
            oauth = models.OAuthAccount(
                provider="google",
                subject=sub,
                email=email,
                user_id=user.id,
            )
            db.add(oauth)

    # 4.5 Store tokens in OAuthAccount
    oauth.access_token = tokens.get("access_token")
    if tokens.get("refresh_token"):
        oauth.refresh_token = tokens.get("refresh_token")
    if tokens.get("expires_in"):
        from time import time
        oauth.expires_at = int(time()) + tokens["expires_in"]

    # Update picture if we have one
    if picture_url:
        # Always try to download/update the cached avatar on login
        # This ensures we get updates but also have a local cache
        cached_picture = await download_avatar(picture_url, str(user.id))
        if cached_picture:
            user.picture = cached_picture
        elif not user.picture:
            # Fallback to remote URL if download failed and we don't have one
            user.picture = picture_url

    # Make the very first user of THIS TENANT (domain) an admin
    existing_admin = (
        db.query(models.User)
        .filter(
            models.User.is_admin == True,
            models.User.email.like(f"%@{hd}")
        )
        .first()
    )
    if existing_admin is None:
        user.is_admin = True





    # Update last_login
    user.last_login = datetime.utcnow()

    db.commit()
    db.refresh(user)

    # Issue JWT and set cookie
    # Include domain in the token so TenantResolver can use it
    token = create_access_token({"sub": str(user.id), "domain": hd})

    redirect = RedirectResponse(url=settings.frontend_url, status_code=303)
    redirect.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=JWT_EXP_MINUTES * 60,
    )
    return redirect


@router.get("/me", response_model=UserRead)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/refresh")
@limiter.limit("20/minute")
def refresh_token(
    request: Request,
    response: Response,
    current_user: models.User = Depends(get_current_user),
):
    """
    Refresh the access token.
    Validates the current token and issues a new one with a fresh expiration.
    """
    # Get the domain from the user's email
    domain = current_user.email.split("@")[-1]
    
    # Create a new token with the same payload
    new_token = create_access_token({"sub": str(current_user.id), "domain": domain})
    
    # Set the new token as an HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=new_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=JWT_EXP_MINUTES * 60,
    )
    
    return {"status": "success", "message": "Token refreshed"}


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Get tenant from user's domain
    user_domain = current_user.email.split("@")[-1]
    tenant = db.query(models.Tenant).filter_by(domain=user_domain).first()
    

    db.commit()

    # Clear cookie
    response.delete_cookie("access_token")
    return {"detail": "Logged out"}
