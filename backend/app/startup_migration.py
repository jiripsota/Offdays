from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from . import models
from .billing.constants import PLAN_DETAILS, PlanID

def seed_plans(db: Session):
    """
    Seed valid plans into the database.
    """
    print("🌱 Seeding plans...")
    try:
        existing_plans = {p.id: p for p in db.query(models.Plan).all()}
        print(f"📊 Found {len(existing_plans)} existing plans")
        
        for plan_id, details in PLAN_DETAILS.items():
            pid = plan_id.value
            if pid not in existing_plans:
                print(f"✨ Seeding Plan: {pid}")
                plan = models.Plan(
                    id=pid,
                    tier=details["tier"],
                    cycle=details["cycle"],
                    max_users=details["max_users"],
                    price_cents=details["price_cents"],
                    marketplace_sku_id=details["sku"]
                )
                db.add(plan)
            else:
                # Update existing plan if details changed
                plan = existing_plans[pid]
                changed = False
                if plan.max_users != details["max_users"]:
                    print(f"🔄 Updating Plan {pid}: max_users {plan.max_users} -> {details['max_users']}")
                    plan.max_users = details["max_users"]
                    changed = True
                if plan.price_cents != details["price_cents"]:
                    print(f"🔄 Updating Plan {pid}: price_cents {plan.price_cents} -> {details['price_cents']}")
                    plan.price_cents = details["price_cents"]
                    changed = True
                
                if changed:
                    db.add(plan)
        
        db.commit()
        print("✅ Seeding/Update completed successfully")
    except Exception as e:
        print(f"❌ Error seeding plans: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()

def seed_initial_data(engine: Engine):
    """
    Seed initial data (Plans, etc.) into the database.
    Does NOT modify schema structure - that is Alembic's job.
    HOWEVER, for local dev simplicity (no alembic run required after wipe), we create tables here.
    """
    # Create tables if not exist (DEV ONLY convenience)
    from .database import Base
    Base.metadata.create_all(bind=engine)

    # We need a session here
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()

