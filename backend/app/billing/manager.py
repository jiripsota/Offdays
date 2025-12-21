from sqlalchemy.orm import Session
from sqlalchemy import func
from app import models
from .constants import PlanID, PLAN_DETAILS

class SubscriptionManager:
    def __init__(self, db: Session):
        self.db = db

    def get_subscription(self, tenant_id: int) -> models.Subscription | None:
        return self.db.query(models.Subscription).filter_by(tenant_id=tenant_id).first()

    def check_usage_limits(self, tenant_id: int, adding_users: int = 1) -> bool:
        """
        Check if the tenant can add 'adding_users' more users.
        Implements Growth Shield: Hard limit is Plan limit + 20%.
        Returns True if allowed, False if blocked.
        """
        sub = self.get_subscription(tenant_id)
        if not sub:
            # No subscription -> assume blocked or minimal trial? 
            # For now, if no subscription, block.
            return False
            
        plan = sub.plan
        if not plan:
            return False

        # If Enterprise or special unlimited plan (not yet defined, but handled loosely)
        if plan.tier == "enterprise":
            return True

        current_count = self.db.query(func.count(models.User.id)).filter(
            models.User.is_active == True,
            # We need to filter by tenant. User model doesn't have tenant_id directly?
            # Wait, User doesn't have tenant_id in models.py shown earlier!
            # It has 'email' and is linked to groups.
            # Auth logic resolves tenant from domain.
            # Users are global but implicitly scoped by domain?
            # Let's check User model again. 
            # Step 17: User does NOT have tenant_id. Tenant has domain.
            # Users are tied to tenant via domain match (in auth.py).
            # So to count users, we assume we filter by email like '%@domain'.
        ).filter(models.User.email.endswith(f"@{sub.tenant.domain}")).scalar()

        max_limit = plan.max_users
        hard_limit = int(max_limit * 1.20) # 20% Growth Shield

        if current_count + adding_users > hard_limit:
            return False
            
        return True

    def is_soft_limit_reached(self, tenant_id: int) -> bool:
        """
        Returns True if user count > base limit (but < hard limit).
        Used to show UI warnings.
        """
        sub = self.get_subscription(tenant_id)
        if not sub or not sub.plan:
            return False
            
        current_count = self.db.query(func.count(models.User.id)).filter(
            models.User.is_active == True,
            models.User.email.endswith(f"@{sub.tenant.domain}")
        ).scalar()
        
        return current_count > sub.plan.max_users
