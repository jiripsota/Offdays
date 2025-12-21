import uuid
from datetime import datetime, date
from typing import Optional
from enum import Enum

from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Integer,
    UniqueConstraint,
    Text,
    JSON,
    CheckConstraint,
    Table,
)

from sqlalchemy import UUID as sa_UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    
    subscription: Mapped["Subscription"] = relationship("Subscription", back_populates="tenant", uselist=False)

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        sa_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    picture: Mapped[str | None] = mapped_column(String(1024))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(back_populates="user")

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # "google"
    subject: Mapped[str] = mapped_column(String(255), nullable=False)  # Google 'sub'
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(sa_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # OAuth Tokens for "User Delegated" access (Drive, Contacts, etc.)
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[int | None] = mapped_column(Integer) # Unix timestamp

    user: Mapped["User"] = relationship(back_populates="oauth_accounts")




# --- Billing & Pricing ---

class PlanTier(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    ENTERPRISE = "enterprise"

class BillingCycle(str, Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"

class SubscriptionStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    UNPAID = "unpaid"
    EXPIRED = "expired"

class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g. TEAM_SMALL_MONTHLY_HOSTED
    tier: Mapped[PlanTier] = mapped_column(String(20), nullable=False)
    cycle: Mapped[BillingCycle] = mapped_column(String(20), nullable=False)
    
    max_users: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    marketplace_sku_id: Mapped[str | None] = mapped_column(String(100)) # Google SKU ID

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, nullable=False)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"), nullable=False)
    
    status: Mapped[SubscriptionStatus] = mapped_column(String(20), default=SubscriptionStatus.TRIAL)
    provider: Mapped[str] = mapped_column(String(50), default="google_marketplace")
    external_id: Mapped[str | None] = mapped_column(String(255)) # License ID from GWM
    
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    current_period_ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="subscription")
    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions")
