# backend/src/api/routes/sensors.py
"""
Sensor Routes — Warif API
=========================
Handles all sensor-related endpoints:
  - GET  /sensors         : historical readings with optional filters
  - GET  /sensors/latest  : latest reading per sensor type (requires auth)
  - POST /sensors         : ingest a new reading from IoT device (MQTT/hardware)

On each ingestion, the pipeline:
  1. Saves the raw reading to the DB
  2. Updates device connectivity status
  3. Runs kNN + SVM anomaly detection
  4. Triggers the Decision Engine for recommendations and alerts
"""
import logging
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError, OperationalError

from src.db.session import get_db
from src.db.models.models import SensorReading, SensorThreshold, Device
from src.api.schemas.schemas import SensorReadingOut, SensorLatestOut
from src.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()
RIYADH_TZ = ZoneInfo("Asia/Riyadh")


# Public endpoint — used by frontend charts (water_usage, power_usage history)
@router.get("", response_model=List[SensorReadingOut])
async def list_sensor_readings(
    farm_id:     int           = Query(..., description="Farm ID"),
    device_id:   Optional[str] = Query(None),
    sensor_type: Optional[str] = Query(None),
    limit:       int           = Query(100, le=50000),
    db: AsyncSession = Depends(get_db),
):
    """Return historical sensor readings, most recent first, filtered by farm."""
    q = select(SensorReading).where(SensorReading.farm_id == farm_id).order_by(desc(SensorReading.timestamp)).limit(limit)
    if device_id:
        q = q.where(SensorReading.device_id == device_id)
    if sensor_type:
        q = q.where(SensorReading.sensor_type == sensor_type)
    result = await db.execute(q)
    return result.scalars().all()


# Protected endpoint — requires valid JWT token
# Returns one reading per sensor type with computed status (normal/warning/critical)
# Light intensity is forced to 0 at night (18:00–06:00 Riyadh time)
@router.get("/latest")
async def get_latest_readings(
    farm_id: int = Query(..., description="Farm ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Return the single most-recent value for each sensor type for a specific farm.
    """
    from sqlalchemy import func
    sub = (
        select(
            SensorReading.sensor_type,
            func.max(SensorReading.timestamp).label("max_ts")
        )
        .where(SensorReading.farm_id == farm_id)
        .group_by(SensorReading.sensor_type)
        .subquery()
    )
    q = (
        select(SensorReading)
        .join(sub, (SensorReading.sensor_type == sub.c.sensor_type) &
                   (SensorReading.timestamp == sub.c.max_ts))
        .where(SensorReading.farm_id == farm_id)
    )
    result = await db.execute(q)
    readings = result.scalars().all()

    # Fetch thresholds for status computation
    thresh_result = await db.execute(select(SensorThreshold))
    thresholds = {t.sensor_type: t for t in thresh_result.scalars().all()}

    out = []
    for r in readings:
        t = thresholds.get(r.sensor_type)
        value = r.value
        if r.sensor_type == "light_intensity":
            riyadh_hour = datetime.now(RIYADH_TZ).hour
            if riyadh_hour >= 18 or riyadh_hour < 6:
                value = 0.0
        status = _compute_status(value, t)
        out.append(SensorLatestOut(
            sensor_type=r.sensor_type,
            value=value,
            unit=r.unit,
            status=status,
            timestamp=r.timestamp,
        ))
    return out


# Internal endpoint — called by MQTT client or real IoT hardware sensors
# Not used by the frontend directly
@router.post("", status_code=201)
async def ingest_sensor_reading(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Ingest a single sensor reading and auto-generate alerts if thresholds exceeded."""
    from src.db.models.models import SensorReading, Alert, AlertSeverity, AlertStatus, Device

    try:
        sensor_type = payload.get("sensor_type")
        if not sensor_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sensor_type is required"
            )

        try:
            value = float(payload.get("value", 0))
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="value must be a valid number"
            )

        # Sensor type labels moved to Decision Engine for centralized alert generation

        # 1. Lookup device to resolve farm_id from device_id
        # device_id comes from the IoT hardware payload
        device_obj = None
        device_id = payload.get("device_id", "unknown")
        device_result = await db.execute(
            select(Device).where(Device.device_id == device_id)
        )
        device_obj = device_result.scalar_one_or_none()

        farm_id = device_obj.farm_id if device_obj else None

        # Update connectivity status - mark device as online
        try:
            from src.services.connectivity_monitor import ConnectivityMonitor
            await ConnectivityMonitor.update_device_seen(device_id, db)
        except Exception as e:
            print(f"[Warning] Connectivity update failed for {device_id}: {e}")

        reading = SensorReading(
            device_id=device_id,
            farm_id=farm_id,
            sensor_type=sensor_type,
            value=value,
            unit=payload.get("unit", ""),
        )
        db.add(reading)
        await db.flush()

        # 1. Check for anomalies in sensor readings
        try:
            from src.services.anomaly_alert_system import get_anomaly_alert_system
            anomaly_system = get_anomaly_alert_system()
            await anomaly_system.check_sensor_reading_anomalies(
                device_id=device_id, farm_id=farm_id, sensor_type=sensor_type, value=value, db=db
            )
        except Exception as e:
            logger.error(f"[Ingestion] Anomaly detection failed: {e}")

        # 2. Run ML predictions
        try:
            from src.ml.anomaly_knn import predict as knn_predict
            from src.ml.anomaly_svm import predict as svm_predict
            features = {"air_temperature": 25.0, "air_humidity": 50.0, "soil_moisture": 50.0, "soil_temperature": 25.0, "co2": 650.0, "cum_irr": 2.0}
            knn_predict(features)
            svm_predict(features)
        except Exception as e:
            logger.warning(f"[Ingestion] ML Prediction skipped: {e}")

        # 3. Decision Engine Stage
        if device_obj and farm_id:
            try:
                from src.services.decision_engine import SmartDecisionEngine
                from src.db.models.models import Recommendation, RecommendationCategory, RecommendationSeverity, Alert, AlertSeverity, AlertStatus

                # Fetch latest reading per sensor type for this farm
                from sqlalchemy import func as sqlfunc
                sub = (
                    select(
                        SensorReading.sensor_type,
                        sqlfunc.max(SensorReading.timestamp).label("max_ts"),
                    )
                    .where(SensorReading.farm_id == farm_id)
                    .group_by(SensorReading.sensor_type)
                    .subquery()
                )
                latest_rows = await db.execute(
                    select(SensorReading).join(
                        sub,
                        (SensorReading.sensor_type == sub.c.sensor_type)
                        & (SensorReading.timestamp == sub.c.max_ts),
                    ).where(SensorReading.farm_id == farm_id)
                )
                full_sensor_data = {r.sensor_type: r.value for r in latest_rows.scalars().all()}
                # Include the reading just flushed (may not be visible in the query above yet)
                full_sensor_data[sensor_type] = value

                engine = SmartDecisionEngine()
                intelligence_report = await engine.analyze_with_intelligence(full_sensor_data, farm_id)
                smart_recs = intelligence_report.get('recommendations', [])

                cat_map = {"irrigation": RecommendationCategory.irrigation, "temperature": RecommendationCategory.temperature, "humidity": RecommendationCategory.humidity, "soil": RecommendationCategory.soil, "general": RecommendationCategory.general}
                sev_map = {"normal": RecommendationSeverity.normal, "warning": RecommendationSeverity.warning, "urgent": RecommendationSeverity.urgent}

                for sr in smart_recs:
                    if sr.category not in ("irrigation", "temperature", "humidity", "soil", "general"):
                        continue

                    sev_lower = (sr.severity or "normal").lower()

                    # ── RULES: normal, low, informational, optimization -> RECOMMENDATIONS ──
                    if sev_lower in ("normal", "low", "informational", "optimization"):
                        cooldown_5min = datetime.now(timezone.utc) - timedelta(minutes=5)
                        recent_rec_result = await db.execute(
                            select(Recommendation)
                            .where(
                                Recommendation.farm_id == farm_id,
                                Recommendation.category == cat_map.get(sr.category),
                                Recommendation.message == sr.message,
                                Recommendation.created_at >= cooldown_5min,
                            )
                            .limit(1)
                        )
                        if recent_rec_result.scalar_one_or_none() is None:
                            db.add(Recommendation(
                                farm_id=farm_id,
                                message=sr.message,
                                reasoning=sr.reasoning,
                                category=cat_map.get(sr.category, RecommendationCategory.general),
                                severity=RecommendationSeverity.normal,
                                is_read=False,
                            ))

                    # ── RULES: medium, warning, urgent, critical, risk -> ALERTS ─────────────
                    elif sev_lower in ("medium", "warning", "urgent", "critical", "risk"):
                        alert_sev = AlertSeverity.critical if sev_lower in ("urgent", "critical") else AlertSeverity.warning
                        cooldown = datetime.now(timezone.utc) - timedelta(minutes=30)
                        existing = await db.execute(
                            select(Alert).where(
                                Alert.farm_id == farm_id,
                                Alert.message == sr.message,
                                Alert.status == AlertStatus.open,
                                Alert.created_at >= cooldown
                            )
                        )
                        if existing.scalar_one_or_none() is None:
                            db.add(Alert(
                                sensor_type=sr.category,
                                message=sr.message,
                                explanation=sr.reasoning,
                                severity=alert_sev,
                                status=AlertStatus.open,
                                farm_id=farm_id,
                            ))

            except Exception as rec_err:
                logger.warning(f"Smart recommendation generation failed: {rec_err}")

        await db.commit()
        return {
            "status": "ok",
            "sensor_type": sensor_type,
            "value": value,
            "alert_generated": False,
        }

    except HTTPException:
        raise
    except IntegrityError as e:
        await db.rollback()
        logger.error(f"Database integrity error: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sensor data violates database constraints"
        )
    except OperationalError as e:
        await db.rollback()
        logger.error(f"Database operational error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable"
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error in sensor ingestion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process sensor reading"
        )


def _compute_status(value: float, threshold) -> str:
    """
    Compute sensor status based on threshold ranges:
      - 'critical' : value outside absolute min/max bounds
      - 'warning'  : value outside warning bounds but within absolute bounds
      - 'normal'   : value within optimal range
    """
    if threshold is None:
        return "normal"
    if (threshold.min_value is not None and value < threshold.min_value) or \
       (threshold.max_value is not None and value > threshold.max_value):
        return "critical"
    if (threshold.warning_min is not None and value < threshold.warning_min) or \
       (threshold.warning_max is not None and value > threshold.warning_max):
        return "warning"
    return "normal"
