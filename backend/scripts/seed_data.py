#!/usr/bin/env python
# backend/scripts/seed_data.py
"""
Populates the database with sample sensor readings, thresholds, and a demo tray.
Run after setup_db.py:  python scripts/seed_data.py
"""
import asyncio
import sys, os, random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db.session import AsyncSessionLocal
from src.db.models.models import (
    User, Farm, Device, SensorReading, SensorThreshold,
    Actuator, Recommendation, RecommendationCategory, RecommendationSeverity
)


SENSOR_TYPES = {
    "temperature":   (18.0, 28.0, "°C"),
    "humidity":      (50.0, 80.0, "%"),
    "light":         (2000, 8000, "lux"),
    "soil_moisture": (40.0, 70.0, "%"),
    "ec":            (1.2,  2.4,  "mS/cm"),
    "co2":           (400,  1000, "ppm"),
}

DEFAULT_THRESHOLDS = [
    dict(sensor_type="temperature",   min_value=10, max_value=35, warning_min=15, warning_max=30),
    dict(sensor_type="humidity",      min_value=30, max_value=95, warning_min=45, warning_max=85),
    dict(sensor_type="light",         min_value=500, max_value=10000, warning_min=1000, warning_max=9000),
    dict(sensor_type="soil_moisture", min_value=20, max_value=90, warning_min=35, warning_max=80),
    dict(sensor_type="ec",            min_value=0.5, max_value=3.5, warning_min=1.0, warning_max=3.0),
    dict(sensor_type="co2",           min_value=300, max_value=1500, warning_min=350, warning_max=1200),
]


async def seed():
    async with AsyncSessionLocal() as db:
        # ── Thresholds ──────────────────────────────
        print("Seeding thresholds…")
        for t in DEFAULT_THRESHOLDS:
            db.add(SensorThreshold(**t))

        # ── Demo user ────────────────────────────────
        print("Seeding demo user...")
        from src.core.security import hash_password
        user = User(
            username="demo_farmer",
            email="demo@warif.com",
            password_hash=hash_password("demo1234"),
            language="ar",
        )
        db.add(user)
        await db.flush()

        # ── Demo farm ────────────────────────────────
        print("Seeding demo farm...")
        farm = Farm(
            user_id=user.id,
            name="مزرعة الاختبار",
            farm_type="greenhouse",
            crop_type="tomatoes",
        )
        db.add(farm)
        await db.flush()

        # ── Demo device ──────────────────────────────
        print("Seeding demo device...")
        device = Device(
            farm_id=farm.id,
            device_id="sensor_001",
            name="Sensor Node 1",
            type="sensor",
            status="active",
        )
        db.add(device)
        await db.flush()

        # ── Sensor readings (last 24 h, every 10 min) ──
        print("Seeding sensor readings (24 h of data)…")
        now = datetime.now(timezone.utc)
        for minutes_ago in range(0, 24 * 60, 10):
            ts = now - timedelta(minutes=minutes_ago)
            for s_type, (lo, hi, unit) in SENSOR_TYPES.items():
                db.add(SensorReading(
                    device_id=device.device_id,
                    sensor_type=s_type,
                    value=round(random.uniform(lo, hi), 2),
                    unit=unit,
                    timestamp=ts,
                ))

        await db.commit()
    print("[OK] Seed data inserted successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
