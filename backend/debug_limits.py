from sqlalchemy import func
from app.database import SessionLocal
from app import models
from app.billing.manager import SubscriptionManager

db = SessionLocal()

print("\n🔍 Debugging Usage Limits 🔍\n")

tenants = db.query(models.Tenant).all()
if not tenants:
    print("❌ No tenants found.")
else:
    for t in tenants:
        print(f"🏢 Tenant ID: {t.id} | Domain: {t.domain}")
        sub = t.subscription
        if not sub:
            print("   ❌ No Subscription")
            continue
            
        print(f"   📜 Subscription ID: {sub.id} | Plan: {sub.plan_id} | Status: {sub.status}")
        
        plan = sub.plan
        if not plan:
            print("   ❌ Link to Plan is broken (sub.plan is None)")
            # Try to fetch plan directly
            actual_plan = db.query(models.Plan).get(sub.plan_id)
            print(f"      (Direct fetch of plan {sub.plan_id}: {actual_plan})")
            continue
            
        print(f"   ℹ️  Plan Max Users: {plan.max_users}")
        
        # Manually count users
        count = db.query(func.count(models.User.id)).filter(
            models.User.is_active == True,
            models.User.email.endswith(f"@{t.domain}")
        ).scalar()
        
        print(f"   👥 Current User Count (via email match): {count}")
        
        limit = int(plan.max_users * 1.20)
        print(f"   🚫 Calculated Hard Limit: {limit}")
        
        if count >= limit:
             print("   ⚠️  LIMIT REACHED OR EXCEEDED")
        else:
             print("   ✅ Limit OK")

print("\n")
db.close()
