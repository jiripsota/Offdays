import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import os

from sqlalchemy.orm import Session
from google.auth import default
from google.auth.exceptions import DefaultCredentialsError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app import models
from app.config import settings
from .service import AbstractBillingProvider
from .constants import PlanID, PLAN_DETAILS

logger = logging.getLogger(__name__)

class GoogleMarketplaceBillingProvider(AbstractBillingProvider):
    def __init__(self):
        self.scopes = ["https://www.googleapis.com/auth/appsmarketplace.license"]
        self.app_id = settings.google_app_id if hasattr(settings, "google_app_id") else None
        
    def _get_service(self):
        """
        Get authenticated service for Google Workspace Marketplace API.
        Uses Application Default Credentials (ADC).
        """
        try:
            creds, _ = default(scopes=self.scopes)
            return build("appsmarket", "v2", credentials=creds)
        except Exception as e:
            logger.error(f"Failed to create Google Marketplace service: {e}")
            return None

    def sync_subscription(self, db: Session, tenant: models.Tenant) -> models.Subscription:
        """
        Syncs the subscription status from Google Workspace Marketplace.
        """
        if not self.app_id:
             logger.warning("Google App ID not configured. Skipping license sync.")
             return self._ensure_default_trial(db, tenant)

        service = self._get_service()
        
        if not service:
            logger.warning("Google Apps Market service not available. Skipping sync.")
            return self._ensure_default_trial(db, tenant)

        try:
            # Call Google API to get license status for the customer's domain
            license_data = service.customerLicense().get(
                applicationId=self.app_id, 
                customerId=tenant.domain
            ).execute()
            
            logger.info(f"Fetched license for {tenant.domain}: {license_data}")
            return self._update_subscription_from_license(db, tenant, license_data)

        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"No license found for domain {tenant.domain}. Maybe not installed?")
            elif e.resp.status == 403:
                logger.warning(f"Access forbidden checking license for {tenant.domain}. Check scopes/permissions.")
            else:
                logger.error(f"Google API Error checking license: {e}")
            
            # Fallback for now to avoid locking out valid users during dev/troubleshooting
            return self._ensure_default_trial(db, tenant)
            
        except Exception as e:
            logger.error(f"Unexpected error syncing subscription: {e}")
            return self._ensure_default_trial(db, tenant)

    def _update_subscription_from_license(
        self, 
        db: Session, 
        tenant: models.Tenant, 
        license_data: Dict[str, Any]
    ) -> models.Subscription:
        
        state = license_data.get("state", "Unlicensed")
        
        # Map Google state to our status
        if state == "ACTIVE":
            status = models.SubscriptionStatus.ACTIVE
        elif state == "Unlicensed":
             # This happens if installed but no license assigned? Or just removed?
             status = models.SubscriptionStatus.CANCELLED
        else:
            # DELETED, EXPIRED?
            status = models.SubscriptionStatus.CANCELLED

        # Determine Plan
        # We can look at 'editionId' if we have multiple SKUs.
        # For now, if active, we give them the basic paid plan.
        plan_id = PlanID.SMALL_MONTHLY.value 
        
        # Check if it was a trial
        current_sub = tenant.subscription
        
        if not current_sub:
            new_sub = models.Subscription(
                tenant_id=tenant.id,
                plan_id=plan_id,
                status=status,
                provider="google_marketplace",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_sub)
            db.commit()
            db.refresh(new_sub)
            tenant.subscription = new_sub
            return new_sub
        else:
            # Update existing
            current_sub.status = status
            current_sub.plan_id = plan_id
            current_sub.updated_at = datetime.utcnow()
            db.commit()
            return current_sub

    def _ensure_default_trial(self, db: Session, tenant: models.Tenant) -> models.Subscription:
        if tenant.subscription:
            return tenant.subscription
            
        # Create a default trial subscription
        logger.info(f"Creating default TRIAL subscription for tenant {tenant.id}")
        
        new_sub = models.Subscription(
            tenant_id=tenant.id,
            plan_id=PlanID.TRIAL.value,
            status=models.SubscriptionStatus.TRIAL,
            provider="google_marketplace",
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(new_sub)
        db.commit()
        db.refresh(new_sub)
        tenant.subscription = new_sub
        return new_sub

    def get_portal_url(self, tenant: models.Tenant) -> Optional[str]:
        # Google Workspace Marketplace doesn't have a specific billing portal URL per se, 
        # usually it's the Admin Console -> Apps -> Marketplace Apps.
        return "https://admin.google.com/ac/apps"

    def handle_webhook(self, payload: Dict[str, Any], signature: str) -> None:
        # GWM sends license notifications via Pub/Sub usually, or you poll.
        # This generic hook is for push-based providers.
        pass
