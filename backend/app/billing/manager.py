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
        
    def ensure_trial_subscription(self, tenant: models.Tenant) -> models.Subscription:
        """
        Ensures a tenant has a 60-day trial subscription.
        Creates one if it doesn't exist.
        """
        from datetime import datetime, timedelta
        
        if tenant.subscription:
            return tenant.subscription
            
        # Create a default 2-month (60 days) trial subscription
        new_sub = models.Subscription(
            tenant_id=tenant.id,
            plan_id=PlanID.TRIAL.value,
            status=models.SubscriptionStatus.TRIAL,
            provider="internal_trial",
            trial_ends_at=datetime.utcnow() + timedelta(days=60),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(new_sub)
        self.db.commit()
        self.db.refresh(new_sub)
        tenant.subscription = new_sub
        return new_sub
