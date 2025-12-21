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
        existing_plans = {p.id for p in db.query(models.Plan).all()}
        print(f"📊 Found {len(existing_plans)} existing plans")
        
        for plan_id, details in PLAN_DETAILS.items():
            if plan_id.value not in existing_plans:
                print(f"✨ Seeding Plan: {plan_id.value}")
                plan = models.Plan(
                    id=plan_id.value,
                    tier=details["tier"],
                    cycle=details["cycle"],
                    max_users=details["max_users"],
                    price_cents=details["price_cents"],
                    marketplace_sku_id=details["sku"]
                )
                db.add(plan)
        
        db.commit()
        print("✅ Seeding completed successfully")
    except Exception as e:
        print(f"❌ Error seeding plans: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()

def seed_initial_data(engine: Engine):
    """
    Seed initial data (Plans, etc.) into the database.
    Does NOT modify schema structure - that is Alembic's job.
    """
    # We need a session here
    from .database import SessionLocal
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()

