# backend/src/api/routes/dashboard.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from src.db.session import get_db
from src.db.models.models import (
    Farm, Device, SensorReading, SensorThreshold,
    Recommendation, IrrigationEvent, IrrigationCommand,
    Actuator, IrrigationStatus
)
from src.api.schemas.schemas import DashboardOut
from src.core.security import get_current_user

router = APIRouter()


@router.get("/{farm_id}", response_model=DashboardOut)
async def get_dashboard(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Return a summary of the current farm state:
    latest sensor readings, irrigation status, and latest recommendation.
    """
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

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

    return DashboardOut(
        soil_moisture=sensor_map.get("soil_moisture"),
        soil_temperature=sensor_map.get("soil_temperature"),
        air_temperature=sensor_map.get("air_temperature"),
        air_humidity=sensor_map.get("air_humidity"),
        irrigation_status=irrigation_status,
        latest_recommendation=latest_rec.message if latest_rec else None,
        timestamp=sensor_map.get("_timestamp"),
    )


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_farm_or_404(farm_id: int, user_id: int, db: AsyncSession) -> Farm:
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
    return event.status.value
