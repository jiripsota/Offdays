from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models

db = SessionLocal()
plans = db.query(models.Plan).all()
print(f"{'ID':<20} | {'Max Users':<10}")
print("-" * 35)
for p in plans:
    print(f"{p.id:<20} | {p.max_users:<10}")
db.close()
