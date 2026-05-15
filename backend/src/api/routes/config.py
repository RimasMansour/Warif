# backend/src/api/routes/config.py
"""
Config Routes — Warif API
===========================
Handles system configuration endpoints:
  - GET /config/thresholds : retrieve all sensor thresholds (public)
  - PUT /config/thresholds : update sensor thresholds (requires auth)

Sensor thresholds define the optimal, warning, and critical ranges
for each sensor type (soil_moisture, air_temperature, air_humidity, etc.)
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.db.session import get_db
from src.db.models.models import SensorThreshold
from src.api.schemas.schemas import ThresholdIn, ThresholdOut
from src.core.security import get_current_user
router = APIRouter()


# Public endpoint — returns all sensor thresholds for dashboard display
@router.get("/thresholds", response_model=List[ThresholdOut])
async def get_thresholds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SensorThreshold))
    return result.scalars().all()


# Protected endpoint — updates or creates threshold records for each sensor type
@router.put("/thresholds", response_model=List[ThresholdOut])
async def update_thresholds(
    payload: List[ThresholdIn],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    updated = []
    for item in payload:
        result = await db.execute(
            select(SensorThreshold).where(SensorThreshold.sensor_type == item.sensor_type)
        )
        threshold = result.scalar_one_or_none()
        if threshold:
            for k, v in item.model_dump(exclude_unset=True).items():
                setattr(threshold, k, v)
        else:
            threshold = SensorThreshold(**item.model_dump())
            db.add(threshold)
        await db.flush()
        updated.append(threshold)
    return updated
