from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth_deps import get_current_user
from app.database import SessionLocal
from app.billing.manager import SubscriptionManager

router = APIRouter(prefix="/billing", tags=["billing"])

from app.auth_deps import get_db

@router.get("/current")
def get_current_subscription(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current subscription status and plan usage.
    """
    try:
        user_domain = current_user.email.split("@")[-1]
        tenant = db.query(models.Tenant).filter_by(domain=user_domain).first()
        if not tenant:
            # Auto-create tenant if missing (should be handled in auth, but safety net)
            # Or just raise 404
            print(f"Tenant not found for domain {user_domain}")
            raise HTTPException(status_code=404, detail="Tenant not found")

        manager = SubscriptionManager(db)
        sub = manager.get_subscription(tenant.id)
        
        if not sub:
            print(f"No subscription for tenant {tenant.id}, creating default trial...")
            sub = manager.ensure_trial_subscription(tenant)
            
            if not sub:
                print("Failed to create subscription.")
                return {
                    "status": "none", 
                    "plan": None, 
                    "usage": {"users": 0, "limit": 0, "hard_limit": 0},
                    "trial_ends_at": None
                }

        # Check for trial expiration
        from datetime import datetime
        if sub.status == models.SubscriptionStatus.TRIAL and sub.trial_ends_at:
             # Check if trial ended (compare naive UTC if that's what we store, or aware)
             # DB stores naive UTC usually in this setup
             if sub.trial_ends_at < datetime.utcnow():
                 print(f"Trial expired for tenant {tenant.id}. Updating status.")
                 sub.status = models.SubscriptionStatus.EXPIRED
                 db.commit()
                 db.refresh(sub)

        # Calculate usage
        # usage_count = manager.is_soft_limit_reached(tenant.id) # Re-using logic, or counting directly
        # Ideally return exact count
        from sqlalchemy import func
        current_count = db.query(func.count(models.User.id)).filter(
            models.User.is_active == True,
            models.User.email.endswith(f"@{tenant.domain}")
        ).scalar()

        return {
            "status": sub.status,
            "trial_ends_at": sub.trial_ends_at,
            "plan": {
                "id": sub.plan.id,
                "max_users": sub.plan.max_users,
                "tier": sub.plan.tier,
                "cycle": sub.plan.cycle,

            } if sub.plan else None,
            "usage": {
                "users": current_count,
                "limit": sub.plan.max_users if sub.plan else 0,
                "hard_limit": int(sub.plan.max_users * 1.2) if sub.plan else 0
            }
        }
    except Exception as e:
        print(f"Error in get_current_subscription: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")



from pydantic import BaseModel

class TestPlanUpdate(BaseModel):
    plan_id: str

@router.post("/test/set-plan")
def test_set_plan(
    payload: TestPlanUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    TEST ONLY: Manually set the subscription plan for testing.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    user_domain = current_user.email.split("@")[-1]
    tenant = db.query(models.Tenant).filter_by(domain=user_domain).first()
    
    # Verify plan exists
    from app.billing.constants import PLAN_DETAILS, PlanID
    # Check if plan_id is valid
    # Convert string to enum if possible or check dict keys
    plan_id_enum = None
    try:
        plan_id_enum = PlanID(payload.plan_id)
    except ValueError:
         pass
         
    # Allow passing just key string even if not in Enum strictly if in DICT
    if not plan_id_enum and payload.plan_id not in PLAN_DETAILS:
         raise HTTPException(status_code=400, detail=f"Invalid Plan ID. Available: {[p.value for p in PlanID]}")
         
    # Update or create subscription
    manager = SubscriptionManager(db)
    sub = manager.get_subscription(tenant.id)
    
    from datetime import datetime
    
    if sub:
        sub.plan_id = payload.plan_id
        # Reset to active if it was expired/trial
        sub.status = models.SubscriptionStatus.ACTIVE
        # If setting to Trial, update provider?
        if payload.plan_id == PlanID.TRIAL.value:
             sub.status = models.SubscriptionStatus.TRIAL
             
        db.commit()
        db.refresh(sub)
    else:
        # Create new
        sub = models.Subscription(
            tenant_id=tenant.id,
            plan_id=payload.plan_id,
            status=models.SubscriptionStatus.ACTIVE,
            provider="test_override",
            created_at=datetime.utcnow()
        )
        if payload.plan_id == PlanID.TRIAL.value:
             sub.status = models.SubscriptionStatus.TRIAL
             
        db.add(sub)
        db.commit()
        
    return {"status": "success", "plan": payload.plan_id, "subscription_status": sub.status}
