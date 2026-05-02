# backend/src/api/routes/sensors.py
import logging
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import SensorReading, SensorThreshold, Device
from src.api.schemas.schemas import SensorReadingOut, SensorLatestOut

logger = logging.getLogger(__name__)

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
    """Ingest a single sensor reading and auto-generate alerts if thresholds exceeded."""
    from src.db.models.models import SensorReading, Alert, AlertSeverity, AlertStatus

    sensor_type = payload.get("sensor_type")
    value       = float(payload.get("value", 0))

    # 1. Save the reading
    reading = SensorReading(
        device_id=payload.get("device_id", "unknown"),
        sensor_type=sensor_type,
        value=value,
        unit=payload.get("unit", ""),
    )
    db.add(reading)
    await db.flush()

    # 2. Check thresholds and generate alert if needed
    thresh_result = await db.execute(
        select(SensorThreshold).where(SensorThreshold.sensor_type == sensor_type)
    )
    threshold = thresh_result.scalar_one_or_none()

    if threshold:
        status = _compute_status(value, threshold)

        if status in ("warning", "critical"):
            severity = AlertSeverity.critical if status == "critical" else AlertSeverity.warning

            SENSOR_LABELS = {
                "soil_moisture":    "رطوبة التربة",
                "soil_temperature": "حرارة التربة",
                "air_temperature":  "درجة الحرارة",
                "air_humidity":     "رطوبة الهواء",
            }
            label = SENSOR_LABELS.get(sensor_type, sensor_type)

            if status == "critical":
                message = f"{label} خارج النطاق الآمن: {value:.1f} {reading.unit}"
            else:
                message = f"{label} تحتاج انتباه: {value:.1f} {reading.unit}"

            alert = Alert(
                sensor_type=sensor_type,
                message=message,
                severity=severity,
                status=AlertStatus.open,
            )
            db.add(alert)

    # ── Smart Recommendation Generation ──────────────────────────────
    try:
        # Get farm_id from device
        device_result = await db.execute(
            select(Device).where(Device.device_id == payload.get("device_id", "unknown"))
        )
        device_obj = device_result.scalar_one_or_none()

        if device_obj and device_obj.farm_id:
            # Gather all recent sensor readings for this farm (last 10 per type)
            from sqlalchemy import func
            sub = (
                select(
                    SensorReading.sensor_type,
                    func.max(SensorReading.timestamp).label("max_ts"),
                )
                .join(Device, SensorReading.device_id == Device.device_id)
                .where(Device.farm_id == device_obj.farm_id)
                .group_by(SensorReading.sensor_type)
                .subquery()
            )
            recent_result = await db.execute(
                select(SensorReading).join(
                    sub,
                    (SensorReading.sensor_type == sub.c.sensor_type)
                    & (SensorReading.timestamp == sub.c.max_ts),
                )
            )
            recent_readings = recent_result.scalars().all()

            # Build complete sensor_data dict
            full_sensor_data = {}
            for r in recent_readings:
                full_sensor_data[r.sensor_type] = r.value

            # Also include current reading
            full_sensor_data[sensor_type] = value

            # Run smart decision engine
            from src.services.decision_engine import SmartDecisionEngine
            from src.db.models.models import (
                Recommendation, RecommendationCategory, RecommendationSeverity
            )

            engine = SmartDecisionEngine()
            smart_recs = await engine.analyze(full_sensor_data)

            cat_map = {
                "irrigation":  RecommendationCategory.irrigation,
                "temperature": RecommendationCategory.temperature,
                "humidity":    RecommendationCategory.humidity,
                "soil":        RecommendationCategory.soil,
            }
            sev_map = {
                "normal":  RecommendationSeverity.normal,
                "warning": RecommendationSeverity.warning,
                "urgent":  RecommendationSeverity.urgent,
            }

            for sr in smart_recs:
                # Only save non-normal OR irrigation recommendations
                if sr.severity != "normal" or sr.category == "irrigation":
                    # Check if this exact recommendation was recently created
                    recent_rec_result = await db.execute(
                        select(Recommendation)
                        .where(
                            Recommendation.farm_id == device_obj.farm_id,
                            Recommendation.category == cat_map.get(sr.category),
                            Recommendation.severity == sev_map.get(sr.severity),
                            Recommendation.message == sr.message
                        )
                        .order_by(desc(Recommendation.created_at))
                        .limit(1)
                    )
                    recent_rec = recent_rec_result.scalar_one_or_none()

                    # Only save if no identical recommendation exists or if older than 5 minutes
                    should_save = True
                    if recent_rec:
                        time_diff = datetime.now(timezone.utc) - recent_rec.created_at.replace(tzinfo=timezone.utc)
                        if time_diff < timedelta(minutes=5):
                            should_save = False

                    if should_save:
                        rec = Recommendation(
                            farm_id=device_obj.farm_id,
                            message=sr.message,
                            reasoning=sr.reasoning,
                            category=cat_map.get(sr.category, RecommendationCategory.irrigation),
                            severity=sev_map.get(sr.severity, RecommendationSeverity.normal),
                            is_read=False,
                        )
                        db.add(rec)

    except Exception as rec_err:
        logger.warning(f"Smart recommendation generation failed: {rec_err}")
    # ── End Smart Recommendation Generation ──────────────────────────

    await db.commit()
    return {
        "status": "ok",
        "sensor_type": sensor_type,
        "value": value,
        "alert_generated": threshold is not None and _compute_status(value, threshold) in ("warning", "critical")
    }


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
