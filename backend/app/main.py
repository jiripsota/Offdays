import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Configure logging to see output in Cloud Run
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("offdays")

logger.info("🎬 Starting Offdays Backend...")

logger.info("📦 Loading routers...")
from app.routers import users; logger.info("  - users loaded")

from app.routers import config; logger.info("  - config loaded")
from app.routers import billing; logger.info("  - billing loaded")
from app.routers import integrations; logger.info("  - integrations loaded")
from app import auth
from app.database import Base, engine
from app import models  # Ensure models are registered
from app.startup_migration import seed_initial_data

# Security & Rate Limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.limiter import limiter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            return response
        except Exception as e:
            logger.error(f"💥 SecurityHeadersMiddleware error: {e}", exc_info=True)
            raise e

app = FastAPI(title="Offdays API", description="Secure Password Management API")
app.state.limiter = limiter
@app.exception_handler(Exception)
async def debug_exception_handler(request: Request, exc: Exception):
    logger.error(f"🔥 Global Debug Exception: {exc}", exc_info=True)
    return Response(status_code=500, content=f"Internal Error: {exc}")

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.on_event("startup")
async def startup_event():
    """Create database tables or seed data on startup."""
    logger.info("⚡️ Startup event triggered")
    try:
        seed_initial_data(engine)
        logger.info("✅ Database seeding completed")
    except Exception as e:
        logger.error(f"❌ Database seeding failed: {e}", exc_info=True)
        # We don't necessarily want to crash the whole app if seeding fails,
        # but in this case, it might be better to know.
        # raise e 

from app.config import settings

# CORS settings
origins = [
    "http://localhost:5173", # Keep localhost for easy dev
]

# Add production frontend URL if configured
if settings.frontend_url:
    origins.append(settings.frontend_url)
    # Also allow version without trailing slash if present, or ensure consistency
    origins.append(settings.frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check(request: Request):
    """Health check endpoint for Cloud Run."""
    logger.info(f"🩺 Health check requested from {request.client.host if request.client else 'unknown'}")
    return {"status": "ok", "service": "offdays-backend"}

app.include_router(auth.router)
app.include_router(users.router)

app.include_router(config.router)
app.include_router(billing.router)
app.include_router(integrations.router)


# Mount static files if directory exists
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
