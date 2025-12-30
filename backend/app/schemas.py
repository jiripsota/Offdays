from datetime import datetime, date
from typing import Optional, Any, Dict, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, EmailStr
from pydantic.config import ConfigDict


# Common base for ORM models (Pydantic v2)
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserType(str, Enum):
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"


# --- Tenants & Storage ---

class TenantBase(BaseModel):
    domain: str


class TenantCreate(TenantBase):
    pass

class TenantRead(TenantBase, ORMModel):
    id: int
    created_at: datetime
    updated_at: datetime


# --- Users ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_admin: bool = False
    is_active: bool = True
    user_type: UserType = UserType.EMPLOYEE

class UserCreate(UserBase):
    pass

class UserRead(UserBase, ORMModel):
    id: UUID
    created_at: datetime
    picture: Optional[str] = None
    last_login: Optional[datetime] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    user_type: Optional[UserType] = None
    supervisor_id: Optional[UUID] = None

# --- Billing (Kept simplified placeholders if needed by other parts, or assume kept from cleanup) --
# Assuming SubscriptionRead might be needed if I didn't verify use in users.py or main.py 
# but previous list_dir showed billing.py was there, checking dependencies...
# I'll rely on what I saw. If billing is kept, its schemas might be in billing.py or schemas.py?
# --- Leaves ---

class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    CANCEL_PENDING = "cancel_pending"


class LeaveEntitlementBase(BaseModel):
    year: int
    total_days: float
    remaining_days: float

class LeaveEntitlementRead(LeaveEntitlementBase, ORMModel):
    id: int
    user_id: UUID
    accrued_days: float = 0.0

class LeaveEntitlementUpdate(BaseModel):
    total_days: Optional[float] = None
    remaining_days: Optional[float] = None


class LeaveRequestBase(BaseModel):
    start_date: date
    end_date: date
    note: Optional[str] = None
    start_half_day: bool = False
    end_half_day: bool = False

class LeaveRequestCreate(LeaveRequestBase):
    pass

class LeaveRequestRead(LeaveRequestBase, ORMModel):
    id: UUID
    user_id: UUID
    days_count: float
    status: LeaveStatus
    start_half_day: bool
    end_half_day: bool
    gcal_event_id: Optional[str] = None
    created_at: datetime
    
    # Ideally include basic user info for approver view
    user: Optional[UserRead] = None


# --- Billing (Kept simplified placeholders if needed by other parts, or assume kept from cleanup) --
# Assuming SubscriptionRead might be needed if I didn't verify use in users.py or main.py 
# but previous list_dir showed billing.py was there, checking dependencies...
# I'll rely on what I saw. If billing is kept, its schemas might be in billing.py or schemas.py?
# The previous file had no billing schemas, so they likely exist elsewhere or are not used in types I saw.
