
class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # storage_config likely unused now but user didn't explicitly say remove data structure, just functionality. 
    # But he said "remove adapters for drive/firestore" -> implies storage config is irrelevant.
    # I'll keep it as nullable dict or remove if I want to be strict. I'll keep it simple for now.
    storage_config: Mapped[dict] = mapped_column(JSON, nullable=True) 
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
