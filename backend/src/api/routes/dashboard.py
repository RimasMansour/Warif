# backend/src/api/routes/dashboard.py
"""
Dashboard Routes — Warif API
=============================
Handles dashboard and weather endpoints:
  - GET /{farm_id}        : full farm summary (sensors, irrigation, recommendations)
  - GET /weather/current  : real-time weather proxy from Open-Meteo API

All endpoints require JWT authentication.
Farm ownership is verified on every request.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
import httpx

from src.db.session import get_db
from src.db.models.models import (
    Farm, Device, SensorReading, SensorThreshold,
    Recommendation, IrrigationEvent, IrrigationCommand,
    Actuator, IrrigationStatus
)
from src.api.schemas.schemas import DashboardOut
from src.core.security import get_current_user

router = APIRouter()


# Returns a complete snapshot of the farm state for the dashboard home page
# Combines: sensor readings, irrigation status, water usage, and latest recommendation
@router.get("/{farm_id}", response_model=DashboardOut)
async def get_dashboard(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):

    farm = await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    # ── Latest sensor readings ──────────────────────────────────────────
    sensor_map = await _get_latest_sensors(farm_id, db)

    # ── Irrigation status ───────────────────────────────────────────────
    irrigation_status = await _get_irrigation_status(farm_id, db)

    # ── Latest unread recommendation ────────────────────────────────────
    rec_result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.is_read == False,
        )
        .order_by(desc(Recommendation.created_at))
        .limit(1)
    )
    latest_rec = rec_result.scalar_one_or_none()

    # Calculate water tank percentage
    water_tank_level = 0.0
    if farm.water_tank_capacity > 0:
        water_tank_level = (farm.current_water_level / farm.water_tank_capacity) * 100

    # ── Daily Water Consumption ─────────────────────────────────────────
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    water_result = await db.execute(
        select(func.sum(SensorReading.value))
        .join(Device, SensorReading.device_id == Device.device_id)
        .where(
            Device.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= today
        )
    )
    daily_water_usage = water_result.scalar_one_or_none() or 0.0

    return DashboardOut(
        soil_moisture=sensor_map.get("soil_moisture"),
        soil_temperature=sensor_map.get("soil_temperature"),
        air_temperature=sensor_map.get("air_temperature"),
        air_humidity=sensor_map.get("air_humidity"),
        water_tank_level=water_tank_level,
        water_usage=daily_water_usage,
        energy_kwh=farm.total_energy_kwh,
        light_intensity=sensor_map.get("light_intensity"),
        irrigation_status=irrigation_status,
        latest_recommendation=latest_rec.message if latest_rec else None,
        timestamp=sensor_map.get("_timestamp"),
    )
 
 
# Proxies weather data from Open-Meteo to avoid browser CORS restrictions
# Uses farm GPS coordinates (lat/lon) passed as query parameters
@router.get("/weather/current")
async def get_weather(lat: float, lon: float):
    """
    Proxy request to Open-Meteo to avoid CORS issues in some environments.
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&timezone=auto"
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch weather from provider")
        return response.json()


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_farm_or_404(farm_id: int, user_id: int, db: AsyncSession) -> Farm:
    """Fetch farm by ID and verify it belongs to the requesting user. Raises 404 if not found."""
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


async def _get_latest_sensors(farm_id: int, db: AsyncSession) -> dict:
    """Return latest value for each sensor type linked to this farm."""
    sub = (
        select(
            SensorReading.sensor_type,
            func.max(SensorReading.timestamp).label("max_ts"),
        )
        .join(Device, SensorReading.device_id == Device.device_id)
        .where(Device.farm_id == farm_id)
        .group_by(SensorReading.sensor_type)
        .subquery()
    )
    result = await db.execute(
        select(SensorReading)
        .join(
            sub,
            (SensorReading.sensor_type == sub.c.sensor_type)
            & (SensorReading.timestamp == sub.c.max_ts),
        )
    )
    readings = result.scalars().all()

    sensor_map = {}
    for r in readings:
        sensor_map[r.sensor_type] = r.value
        sensor_map["_timestamp"] = r.timestamp
    return sensor_map


async def _get_irrigation_status(farm_id: int, db: AsyncSession) -> str:
    """Return latest irrigation event status for this farm."""
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(Device.farm_id == farm_id)
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(1)
    )
    event = result.scalar_one_or_none()
    if not event:
        return "idle"
    return event.status.value if hasattr(event.status, "value") else str(event.status or "idle")
