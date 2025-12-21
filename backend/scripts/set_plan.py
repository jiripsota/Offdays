
import sys
import os
import argparse

# Ensure we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from app.billing.constants import PLAN_DETAILS

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def list_tenants(db: Session):
    tenants = db.query(models.Tenant).all()
    print("\nAvailable Tenants:")
    for t in tenants:
        sub_plan = t.subscription.plan_id if t.subscription else "None"
        print(f"  - ID: {t.id} | Domain: {t.domain} | Current Plan: {sub_plan}")
    return tenants

def list_plans():
    print("\nAvailable Plans:")
    for plan_id in PLAN_DETAILS.keys():
        print(f"  - {plan_id.value}")

def set_plan(domain_part: str, plan_id: str):
    db: Session = SessionLocal()
    try:
        # Find tenant (fuzzy match on domain)
        tenant = db.query(models.Tenant).filter(models.Tenant.domain.contains(domain_part)).first()
        if not tenant:
            print(f"❌ Tenant matching '{domain_part}' not found.")
            list_tenants(db)
            return

        # Validate plan
        valid_plans = [p.value for p in PLAN_DETAILS.keys()]
        if plan_id not in valid_plans:
            print(f"❌ Invalid Plan ID: {plan_id}")
            list_plans()
            return

        # Ensure subscription exists
        if not tenant.subscription:
            print("Creating new subscription...")
            sub = models.Subscription(
                tenant_id=tenant.id,
                plan_id=plan_id,
                status=models.SubscriptionStatus.ACTIVE
            )
            db.add(sub)
        else:
            print(f"Updating subscription from {tenant.subscription.plan_id} to {plan_id}...")
            tenant.subscription.plan_id = plan_id
            tenant.subscription.status = models.SubscriptionStatus.ACTIVE
        
        db.commit()
        print(f"✅ Success! Tenant '{tenant.domain}' is now on plan '{plan_id}'.")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set Tenant Plan CLI")
    parser.add_argument("domain", nargs="?", help="Partial domain name of the tenant")
    parser.add_argument("plan", nargs="?", help="Plan ID to set (e.g., TEAM_SMALL_MONTHLY_HOSTED)")
    parser.add_argument("--list", action="store_true", help="List tenants and plans")

    args = parser.parse_args()

    if args.list:
        db = SessionLocal()
        list_tenants(db)
        list_plans()
        db.close()
        sys.exit(0)

    if not args.domain or not args.plan:
        print("Usage: python -m scripts.set_plan <domain_part> <plan_id>")
        print("       python -m scripts.set_plan --list")
        sys.exit(1)

    set_plan(args.domain, args.plan)
