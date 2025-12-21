from datetime import datetime
from typing import Optional, Any, Dict, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, EmailStr
from pydantic.config import ConfigDict


# Common base for ORM models (Pydantic v2)
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


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

# --- Billing (Kept simplified placeholders if needed by other parts, or assume kept from cleanup) --
# Assuming SubscriptionRead might be needed if I didn't verify use in users.py or main.py 
# but previous list_dir showed billing.py was there, checking dependencies...
# I'll rely on what I saw. If billing is kept, its schemas might be in billing.py or schemas.py?
# The previous file had no billing schemas, so they likely exist elsewhere or are not used in types I saw.
