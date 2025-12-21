from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app import models

class AbstractBillingProvider(ABC):
    """
    Interface for billing providers (e.g., Google Workspace Marketplace, Stripe).
    """

    @abstractmethod
    def sync_subscription(self, db: Session, tenant: models.Tenant) -> models.Subscription:
        """
        Synchronize the subscription status with the provider.
        Should update the tenant's subscription record in the DB.
        """
        pass

    @abstractmethod
    def get_portal_url(self, tenant: models.Tenant) -> Optional[str]:
        """
        Return a URL where the user can manage their subscription.
        """
        pass
    
    @abstractmethod
    def handle_webhook(self, payload: Dict[str, Any], signature: str) -> None:
        """
        Handle incoming webhook events from the provider.
        """
        pass
