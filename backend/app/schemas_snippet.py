
# --- Tenants & Storage ---

class TenantBase(BaseModel):
    domain: str
    storage_config: Dict[str, Any] # simplified

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
