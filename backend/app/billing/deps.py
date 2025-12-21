from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth_deps import get_current_user, get_db
from app.database import SessionLocal
from .manager import SubscriptionManager

def require_active_subscription(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dependency to ensure the tenant has an active subscription (or trial).
    If expired/cancelled/unpaid, raises 403/402.
    """
    # Resolve tenant from user domain
    # Assuming user is authenticated, otherwise get_current_user would fail.
    user_domain = current_user.email.split("@")[-1]
    tenant = db.query(models.Tenant).filter_by(domain=user_domain).first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Tenant not found"
        )
    
    sub = tenant.subscription
    if not sub:
        # Should normally be created on login, but if missing -> block
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active subscription found."
        )
        
    # Check status
    valid_statuses = [
        models.SubscriptionStatus.ACTIVE,
        models.SubscriptionStatus.TRIAL,
        # models.SubscriptionStatus.PAST_DUE # Maybe allow grace period?
    ]
    
    if sub.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Subscription is not active. Read-only mode."
        )
    
    return sub
