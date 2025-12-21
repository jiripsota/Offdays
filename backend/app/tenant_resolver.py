from sqlalchemy.orm import Session
from . import models, schemas
import uuid


class TenantResolver:
    def __init__(self, db: Session, user_email: str):
        """
        Initialize TenantResolver.

        Args:
            db: Database session
            user_email: Email of the user
        """
        self.db = db
        self.user_email = user_email

    def resolve_from_domain(self, domain: str) -> models.Tenant:
        """
        Resolve tenant by domain, creating if necessary.
        """
        tenant = self.db.query(models.Tenant).filter_by(domain=domain).first()

        if tenant:
            return tenant

        # No tenant yet -> create one with no storage config
        # Simplified for Offdays: we removed storage config schema so we pass {} or nothing if nullable.
        # Check models.py: storage_config: Mapped[dict] = mapped_column(JSON, nullable=True)
        
        tenant = models.Tenant(
            domain=domain,
        )
        self.db.add(tenant)
        self.db.commit()
        self.db.refresh(tenant)

        return tenant