#!/usr/bin/env python
# backend/scripts/setup_db.py
"""
Creates all database tables defined in the ORM models.
Run once on a fresh database:  python scripts/setup_db.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db.session import engine, Base

# Import all models so their tables are registered on Base.metadata
from src.db.models.models import (  # noqa: F401
    User,
    Farm,
    Device,
    SensorReading,
    Actuator,
    IrrigationCommand,
    IrrigationEvent,
    Recommendation,
    Prediction,
    Alert,
    DeviceCommand,
    SensorThreshold,
)


async def create_tables():
    print("Creating Warif database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created:")
    print("   - users")
    print("   - farms")
    print("   - devices")
    print("   - sensor_readings")
    print("   - actuators")
    print("   - irrigation_commands")
    print("   - irrigation_events")
    print("   - recommendations")
    print("   - predictions")
    print("   - alerts")
    print("   - device_commands")
    print("   - sensor_thresholds")


if __name__ == "__main__":
    asyncio.run(create_tables())
