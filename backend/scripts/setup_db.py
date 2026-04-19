#!/usr/bin/env python
# backend/scripts/setup_db.py
"""
Creates all database tables defined in the ORM models.
Run once on a fresh database:  python scripts/setup_db.py
"""
import asyncio
import sys
import os

# Allow running from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db.session import engine, Base
# Import all models so their tables are registered on Base.metadata
from src.db.models.models import (  # noqa: F401
    SensorReading, Alert, Tray, DeviceCommand, SensorThreshold
)


async def create_tables():
    print("Creating database tables…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ All tables created successfully.")


if __name__ == "__main__":
    asyncio.run(create_tables())
