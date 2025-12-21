from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from urllib.parse import parse_qs, urlparse

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy import pool

# Compute paths so we can import from app/
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
APP_DIR = os.path.join(BASE_DIR, "app")
if APP_DIR not in sys.path:
    sys.path.append(APP_DIR)

from app.config import settings
from app.database import Base
from app import models  # important: this imports all models so Base.metadata is filled

config = context.config

# Use the same DB URL as the app
db_url = settings.database_url
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _safe_db_fingerprint(url: str) -> str:
    """
    Return a safe, non-secret fingerprint of the database URL for logs.
    Shows driver, host (or Cloud SQL socket host query param), and database name.
    """
    p = urlparse(url)
    dbname = (p.path or "").lstrip("/")
    host = p.hostname or ""
    qs = parse_qs(p.query or "")
    socket_host = qs.get("host", [""])[0]
    shown_host = host or socket_host or "(none)"
    shown_db = dbname or "(none)"
    return f"driver={p.scheme} host={shown_host} db={shown_db}"


print(f"🐜 Alembic DB: {_safe_db_fingerprint(db_url)}")


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(
        db_url,
        # poolclass=pool.NullPool, # DISABLED: Let SQLAlchemy use default pool (SingletonThreadPool for SQLite)
    )

    with connectable.connect() as connection:
        # Log where we actually connected (truth source)
        try:
            # Log where we actually connected (truth source)
            # Note: This query is PostgreSQL specific
            row = connection.exec_driver_sql(
                "SELECT current_database(), current_user, inet_server_addr();"
            ).fetchone()
            print(f"🐜 Connected to: db={row[0]} user={row[1]} server_addr={row[2]}")
        except Exception:
            # Fallback for SQLite or other dialects
            print(f"🐜 Connected to: {db_url.split('://')[0]} (local/sqlite)")

        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True
        )

        with context.begin_transaction():
            context.run_migrations()
        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
