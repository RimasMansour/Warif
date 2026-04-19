# backend/src/api/routes/config.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models.models import SensorThreshold
from src.api.schemas.schemas import ThresholdIn, ThresholdOut

router = APIRouter()


@router.get("/thresholds", response_model=List[ThresholdOut])
async def get_thresholds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SensorThreshold))
    return result.scalars().all()


@router.put("/thresholds", response_model=List[ThresholdOut])
async def update_thresholds(
    payload: List[ThresholdIn],
    db: AsyncSession = Depends(get_db),
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
