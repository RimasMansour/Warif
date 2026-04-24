# backend/src/api/routes/sensors.py
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import SensorReading, SensorThreshold
from src.api.schemas.schemas import SensorReadingOut, SensorLatestOut

router = APIRouter()


@router.get("", response_model=List[SensorReadingOut])
async def list_sensor_readings(
    device_id:   Optional[str] = Query(None),
    sensor_type: Optional[str] = Query(None),
    limit:       int           = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Return historical sensor readings, most recent first."""
    q = select(SensorReading).order_by(desc(SensorReading.timestamp)).limit(limit)
    if device_id:
        q = q.where(SensorReading.device_id == device_id)
    if sensor_type:
        q = q.where(SensorReading.sensor_type == sensor_type)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/latest", response_model=List[SensorLatestOut])
async def get_latest_readings(db: AsyncSession = Depends(get_db)):
    """
    Return the single most-recent value for each sensor type,
    with a computed status (normal / warning / critical).
    """
    # Subquery: max timestamp per sensor_type
    from sqlalchemy import func
    sub = (
        select(SensorReading.sensor_type, func.max(SensorReading.timestamp).label("max_ts"))
        .group_by(SensorReading.sensor_type)
        .subquery()
    )
    q = (
        select(SensorReading)
        .join(sub, (SensorReading.sensor_type == sub.c.sensor_type) &
                   (SensorReading.timestamp == sub.c.max_ts))
    )
    result = await db.execute(q)
    readings = result.scalars().all()

    # Fetch thresholds for status computation
    thresh_result = await db.execute(select(SensorThreshold))
    thresholds = {t.sensor_type: t for t in thresh_result.scalars().all()}

    out = []
    for r in readings:
        t = thresholds.get(r.sensor_type)
        status = _compute_status(r.value, t)
        out.append(SensorLatestOut(
            sensor_type=r.sensor_type,
            value=r.value,
            unit=r.unit,
            status=status,
            timestamp=r.timestamp,
        ))
    return out


@router.post("", status_code=201)
async def ingest_sensor_reading(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Ingest a single sensor reading from a device or simulator."""
    from src.db.models.models import SensorReading
    reading = SensorReading(
        device_id=payload.get("device_id", "unknown"),
        sensor_type=payload.get("sensor_type"),
        value=float(payload.get("value", 0)),
        unit=payload.get("unit", ""),
    )
    db.add(reading)
    await db.commit()
    return {"status": "ok", "sensor_type": reading.sensor_type, "value": reading.value}


def _compute_status(value: float, threshold) -> str:
    if threshold is None:
        return "normal"
    if (threshold.min_value is not None and value < threshold.min_value) or \
       (threshold.max_value is not None and value > threshold.max_value):
        return "critical"
    if (threshold.warning_min is not None and value < threshold.warning_min) or \
       (threshold.warning_max is not None and value > threshold.warning_max):
        return "warning"
    return "normal"
