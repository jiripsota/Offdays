import os
from pydantic import BaseModel, model_validator
from dotenv import load_dotenv

# Load .env file so environment variables become available
load_dotenv()


class Settings(BaseModel):
    database_url: str = ""
    secret_key: str = os.getenv("SECRET_KEY", "change-me")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    google_redirect_uri: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback"
    )
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    jwt_algorithm: str = "HS256"
    


    # Google Apps Marketplace App ID (for license checks)
    google_app_id: str | None = os.getenv("GOOGLE_APP_ID")

    # Cloud Storage Bucket for public assets (avatars)
    google_storage_bucket: str = os.getenv("GCS_BUCKET_NAME", "vaultiqo-assets")

    # SMTP Settings
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    emails_from_email: str = os.getenv("EMAILS_FROM_EMAIL", "noreply@offdays.app")


    # Cookie security
    # Default to False in dev (detected by lack of K_SERVICE), True in Cloud Run
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "true").lower() == "true" if os.getenv("K_SERVICE") else False

    
    @property
    def is_cloud_run(self) -> bool:
        """Detect if running in Cloud Run environment"""
        return os.getenv("K_SERVICE") is not None
    
    @model_validator(mode='after')
    def validate_settings(self) -> "Settings":
        """
        Finalize configuration after Pydantic has initialized all fields.
        """
        is_cloud_run = self.is_cloud_run
        database_url = os.getenv("DATABASE_URL")
        
        # In Cloud Run, DATABASE_URL is required
        if is_cloud_run and not database_url:
            raise ValueError(
                "DATABASE_URL environment variable is required in Cloud Run. "
                "Please ensure it's set in the deployment configuration."
            )
        
        # Helper to make SQLite path absolute
        if database_url and database_url.startswith("sqlite:///"):
            path = database_url.replace("sqlite:///", "")
            if path.startswith("."):
                # It is a relative path (e.g. ./dev.db), resolve it relative to backend root
                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                clean_path = path.replace("./", "") 
                abs_db_path = os.path.join(base_dir, clean_path)
                database_url = f"sqlite:///{abs_db_path}"
                print(f"✅ Resolved local DB path: {abs_db_path}")

        # Use SQLite as default for local development only
        if not database_url:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base_dir, "dev.db")
            database_url = f"sqlite:///{db_path}"
            print("⚠️  Using SQLite for local development")
        
        # Validate that production uses PostgreSQL
        if is_cloud_run and not database_url.startswith("postgresql"):
            raise ValueError(
                f"Production must use PostgreSQL, but got: {database_url.split('://')[0]}"
            )
        
        # Log database type (without credentials) for debugging
        db_type = database_url.split("://")[0]
        print(f"📊 Database: {db_type}")
        
        # Validate that we are not using default secret key in production
        if is_cloud_run and self.secret_key == "change-me":
            raise ValueError(
                "Insecure configuration: SECRET_KEY must be set in production environment."
            )

        self.database_url = database_url
        return self


settings = Settings()
