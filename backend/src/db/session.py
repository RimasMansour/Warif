# backend/src/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from src.core.config import settings

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
