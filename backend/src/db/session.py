# backend/src/db/session.py
"""
Database Session — Warif Backend
==================================
Configures the async SQLAlchemy engine and session factory for Railway PostgreSQL.

Key components:
  - engine          : async connection pool (10 base + 15 overflow connections)
  - AsyncSessionLocal: session factory used by the simulator and background tasks
  - Base            : DeclarativeBase inherited by all ORM models in models.py
  - get_db()        : FastAPI dependency — injects a DB session per HTTP request

Connection settings are tuned for Railway PostgreSQL with:
  - pool_pre_ping   : validates connections before use (handles Railway restarts)
  - pool_recycle    : recycles connections every 30 min to prevent stale connections
  - application_name: identifies this app in Railway PostgreSQL logs
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings

# Async PostgreSQL engine — connection string loaded from DATABASE_URL env variable
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,           # Increased from 3 to handle concurrent farm processing
    max_overflow=15,        # Increased from 5 to max 25 total connections
    pool_timeout=60,        # Increased from 30s to handle heavier operations
    pool_recycle=1800,      # Recycle connections every 30 min
    pool_pre_ping=True,     # Test connection before using it
    connect_args={
        "server_settings": {
            "application_name": "warif_backend"
        }
    }
)

# Session factory used directly by simulator and background monitoring tasks
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
