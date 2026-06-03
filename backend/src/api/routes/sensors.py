# backend/src/api/routes/sensors.py
"""
Sensor Routes — Warif API
=========================
Handles all sensor-related endpoints:
  - GET  /sensors         : historical readings with optional filters
  - GET  /sensors/latest  : latest reading per sensor type (requires auth)
  - POST /sensors         : ingest a new reading from IoT device or hardware

On each ingestion, the pipeline:
  1. Saves the raw reading to the DB
  2. Updates device connectivity status
  3. Runs kNN + Isolation Forest anomaly detection
  4. Triggers the Decision Engine for recommendations and alerts
"""
import logging
import re
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.exc import IntegrityError, OperationalError

from src.db.session import get_db
from src.db.models.models import SensorReading, SensorThreshold, Device
from src.api.schemas.schemas import SensorReadingOut, SensorLatestOut
from src.core.security import get_current_user
from src.services import tuya_client

logger = logging.getLogger(__name__)

router = APIRouter()
RIYADH_TZ = ZoneInfo("Asia/Riyadh")

# Singleton — initialized once on first use, reused for all requests
def _get_decision_engine():
    from src.services.decision_engine import get_engine
    return get_engine()


# Public endpoint — used by frontend charts (water_usage, power_usage history)
@router.get("", response_model=List[SensorReadingOut])
async def list_sensor_readings(
    farm_id:     int                      = Query(..., description="Farm ID"),
    device_id:   Optional[str]            = Query(None),
    sensor_type: Optional[str]            = Query(None),
    limit:       int                      = Query(100, le=50000),
    since:       Optional[datetime]       = Query(None, description="Return only readings at or after this UTC timestamp (ISO 8601)"),
    db: AsyncSession = Depends(get_db),
):
    """Return historical sensor readings, most recent first, filtered by farm."""
    q = select(SensorReading).where(SensorReading.farm_id == farm_id)
    if device_id:
        q = q.where(SensorReading.device_id == device_id)
    if sensor_type:
        q = q.where(SensorReading.sensor_type == sensor_type)
    if since:
        since_utc = since.replace(tzinfo=timezone.utc) if since.tzinfo is None else since
        q = q.where(SensorReading.timestamp >= since_utc)
    q = q.order_by(desc(SensorReading.timestamp)).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/aggregate")
async def aggregate_sensor_readings(
    farm_id:     int                      = Query(..., description="Farm ID"),
    sensor_type: str                      = Query(...),
    bucket:      str                      = Query("day", pattern="^(minute|hour|day|month)$"),
    since:       Optional[datetime]       = Query(None, description="Return only readings at or after this UTC timestamp (ISO 8601)"),
    until:       Optional[datetime]       = Query(None, description="Return only readings before this UTC timestamp (ISO 8601)"),
    db: AsyncSession = Depends(get_db),
):
    """Return compact chart-ready averages instead of raw high-frequency readings."""
    bucket_ts = func.date_trunc(bucket, SensorReading.timestamp).label("timestamp")
    q = (
        select(
            bucket_ts,
            func.avg(SensorReading.value).label("value"),
            func.min(SensorReading.device_id).label("device_id"),
            func.min(SensorReading.unit).label("unit"),
        )
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == sensor_type,
        )
    )
    if since:
        since_utc = since.replace(tzinfo=timezone.utc) if since.tzinfo is None else since
        q = q.where(SensorReading.timestamp >= since_utc)
    if until:
        until_utc = until.replace(tzinfo=timezone.utc) if until.tzinfo is None else until
        q = q.where(SensorReading.timestamp < until_utc)

    q = q.group_by(bucket_ts).order_by(bucket_ts)
    result = await db.execute(q)
    return [
        {
            "id": index + 1,
            "device_id": row.device_id or "",
            "sensor_type": sensor_type,
            "value": float(row.value or 0),
            "unit": row.unit,
            "timestamp": row.timestamp,
            "count": 0,
        }
        for index, row in enumerate(result.all())
    ]


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


# Called by tuya_bridge when a device fails the Tuya online check — marks it offline immediately
# without waiting for the 5-minute connectivity monitor timeout.
@router.post("/offline/{device_id}")
async def mark_device_offline(device_id: str, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    if device and device.is_online:
        device.is_online = False
        device.connection_lost_at = datetime.now(timezone.utc)
        await db.commit()
    return {"ok": True}


# Internal endpoint — called by real IoT hardware sensors, not the frontend directly
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

        # Auto-register unknown actuator devices when farm_id is provided in payload
        # (used by tuya_bridge.py to register irrigation/fan/cooling actuators)
        payload_farm_id = payload.get("farm_id")
        if payload_farm_id and _is_reserved_simulator_device_for_farm(int(payload_farm_id), device_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Simulator device IDs cannot be registered on the Tuya farm",
            )
        if device_obj is not None and payload_farm_id and device_obj.farm_id != int(payload_farm_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Device belongs to a different farm",
            )
        if device_obj is None and payload_farm_id:
            device_obj = Device(
                farm_id=int(payload_farm_id),
                device_id=device_id,
                name=device_id.replace("_", " ").title(),
                type="actuator",
                is_online=True,
            )
            db.add(device_obj)
            await db.flush()

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

        # 2. Decision Engine Stage
        if device_obj and farm_id:
            try:
                from src.db.models.models import Recommendation, RecommendationCategory, RecommendationSeverity, Alert, AlertSeverity, AlertStatus, Farm

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
                # Build the analysis snapshot only from persisted sensor_readings.
                # The current reading was flushed above, so the transaction can see it
                # without injecting raw payload values directly into the ML/decision path.
                full_sensor_data = {r.sensor_type: r.value for r in latest_rows.scalars().all()}
                farm_result = await db.execute(select(Farm).where(Farm.id == farm_id).limit(1))
                farm = farm_result.scalar_one_or_none()
                if farm and getattr(farm, "crop_type", None):
                    full_sensor_data["crop_type"] = farm.crop_type

                # ML anomaly detection — reuses the already-fetched sensor snapshot
                from src.services.anomaly_alert_system import get_anomaly_alert_system
                await get_anomaly_alert_system().check_ml_anomalies(
                    full_sensor_data,
                    farm_id,
                    db,
                    source_device_id=device_id,
                    source_sensor_type=sensor_type,
                )

                engine = _get_decision_engine()
                intelligence_report = await engine.analyze_with_intelligence(full_sensor_data, farm_id)
                smart_recs = intelligence_report.get('recommendations', [])
                farm_auto_mode = bool(getattr(farm, "auto_mode", False))
                saved_recommendations = []
                saved_alerts = []

                cat_map = {"irrigation": RecommendationCategory.irrigation, "temperature": RecommendationCategory.temperature, "humidity": RecommendationCategory.humidity, "soil": RecommendationCategory.soil}

                for sr in smart_recs:
                    if sr.category not in ("irrigation", "temperature", "humidity", "soil"):
                        continue

                    if sr.category in ("irrigation", "temperature", "humidity", "soil"):
                        from src.services.recommendation_suppression import get_recommendation_suppression
                        suppression = await get_recommendation_suppression(
                            db=db,
                            farm_id=farm_id,
                            category=sr.category,
                            message=sr.message,
                            decision=getattr(sr, "execution_action", None),
                            auto_mode=farm_auto_mode,
                        )
                        if suppression.get("suppress"):
                            logger.info(
                                "[Recommendation Suppressed] farm_id=%s category=%s state=%s reason=%s",
                                farm_id,
                                sr.category,
                                suppression.get("state"),
                                suppression.get("reason"),
                            )
                            continue

                    sev_lower = (sr.severity or "normal").lower()

                    rec_severity = RecommendationSeverity.normal
                    if sev_lower in ("urgent", "critical"):
                        rec_severity = RecommendationSeverity.urgent
                    elif sev_lower in ("medium", "warning", "risk"):
                        rec_severity = RecommendationSeverity.warning

                    # Store every Decision Engine item as a recommendation.
                    # Warning/urgent items may also create alert cards below, but alerts are kept separate.
                    if sev_lower in ("normal", "low", "informational", "optimization", "medium", "warning", "urgent", "critical", "risk"):
                        duplicate_window = datetime.now(timezone.utc) - timedelta(minutes=30)
                        duplicate_signature = _recommendation_signature(
                            sr.category,
                            sr.message,
                            sr.reasoning,
                            getattr(sr, "execution_action", None),
                        )
                        recent_rec_result = await db.execute(
                            select(Recommendation)
                            .where(
                                Recommendation.farm_id == farm_id,
                                Recommendation.category == cat_map.get(sr.category),
                                Recommendation.created_at >= duplicate_window,
                            )
                            .order_by(desc(Recommendation.created_at))
                        )
                        duplicate_rec = next(
                            (
                                rec
                                for rec in recent_rec_result.scalars().all()
                                if _recommendation_signature(
                                    rec.category.value if hasattr(rec.category, "value") else str(rec.category),
                                    rec.message,
                                    rec.reasoning,
                                    getattr(rec, "execution_action", None),
                                ) == duplicate_signature
                            ),
                            None,
                        )
                        if duplicate_rec is None:
                            rec = Recommendation(
                                farm_id=farm_id,
                                message=sr.message,
                                reasoning=sr.reasoning,
                                category=cat_map.get(sr.category, RecommendationCategory.irrigation),
                                severity=rec_severity,
                                is_read=False,
                                is_alert=False,
                                mode="auto" if farm_auto_mode else None,
                                execution_action=getattr(sr, "execution_action", None),
                            )
                            db.add(rec)
                            saved_recommendations.append((rec, sr))
                        elif farm_auto_mode and _is_executable_decision(getattr(sr, "execution_action", None)):
                            if duplicate_rec.mode not in {"executed", "ignored", "stale"}:
                                duplicate_rec.execution_action = getattr(sr, "execution_action", None)
                                saved_recommendations.append((duplicate_rec, sr))

                    # ── RULES: medium, warning, urgent, critical, risk -> ALERTS ─────────────
                    if sev_lower in ("medium", "warning", "urgent", "critical", "risk"):
                        alert_sev = AlertSeverity.critical if sev_lower in ("urgent", "critical") else AlertSeverity.warning
                        cooldown = datetime.now(timezone.utc) - timedelta(minutes=30)
                        existing = await db.execute(
                            select(Alert).where(
                                Alert.farm_id == farm_id,
                                Alert.message == sr.message,
                                Alert.status == AlertStatus.open,
                                Alert.created_at >= cooldown
                            ).limit(1)
                        )
                        if existing.scalar_one_or_none() is None:
                            category_value = full_sensor_data.get(sr.category)
                            alert = Alert(
                                sensor_type=sr.category,
                                message=sr.message,
                                explanation=sr.reasoning,
                                severity=alert_sev,
                                status=AlertStatus.open,
                                farm_id=farm_id,
                                actual_value=category_value,
                                execution_action=getattr(sr, "execution_action", None),
                            )
                            db.add(alert)
                            saved_alerts.append((alert, sr))

                try:
                    await db.flush()
                    automation_result = {"executed": False, "results": {}, "reason": "farm is in manual mode"}
                    if farm_auto_mode:
                        from src.services.automation_executor import execute_auto_decisions
                        executable_decisions = _action_decisions_from_saved_recommendations(saved_recommendations)
                        automation_result = await execute_auto_decisions(
                            db=db,
                            farm_id=farm_id,
                            sensor_data=full_sensor_data,
                            action_decisions=executable_decisions,
                        )
                    _apply_auto_recommendation_statuses(saved_recommendations, automation_result, farm_auto_mode)
                    _apply_auto_alert_statuses(saved_alerts, automation_result, farm_auto_mode)
                    if automation_result.get("executed"):
                        logger.info("[Automation] Executed auto decision for farm_id=%s: %s", farm_id, automation_result)
                except Exception as auto_err:
                    logger.warning("[Automation] Auto execution failed for farm_id=%s: %s", farm_id, auto_err)

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


def _is_reserved_simulator_device_for_farm(farm_id: int, device_id: str) -> bool:
    if not tuya_client.is_tuya_farm(farm_id):
        return False
    reserved_ids = {
        f"soil_sensor_{farm_id}",
        f"climate_sensor_{farm_id}",
        f"irrigation_{farm_id}",
        f"irrigation_valve_{farm_id}",
        f"fan_unit_{farm_id}",
        f"cooling_unit_{farm_id}",
    }
    return device_id in reserved_ids


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


def _recommendation_signature(category: str, message: Optional[str], reasoning: Optional[str], decision: Optional[dict]) -> str:
    action = (decision or {}).get("action") or ""
    text = f"{message or ''} {reasoning or ''}".lower()
    text = re.sub(r"\d+(?:\.\d+)?\s*(?:%|°?\s*c|م|lux)?", "#", text)
    text = re.sub(r"\s+", " ", text).strip()
    return f"{category}:{action}:{text[:180]}"


def _is_executable_decision(decision: Optional[dict]) -> bool:
    return (decision or {}).get("action") in {"start", "stop", "cooling_full", "fan_only"}


def _apply_auto_recommendation_statuses(saved_recommendations: list, automation_result: dict, farm_auto_mode: bool) -> None:
    if not saved_recommendations:
        return
    if not farm_auto_mode:
        for rec, _sr in saved_recommendations:
            rec.mode = None
        return

    results = (automation_result or {}).get("results") or {}
    for rec, sr in saved_recommendations:
        decision = getattr(sr, "execution_action", None) or {}
        domain = _execution_domain(decision, sr.category)
        decision_action = decision.get("action")
        result = results.get(domain) if domain else None

        if result and result.get("executed"):
            rec.mode = "executing"
        elif result and _already_in_desired_state(result.get("reason")):
            rec.mode = "executing"
        elif _is_deferred_decision(decision, result):
            rec.mode = "deferred"
        elif result:
            rec.mode = "deferred"
        elif decision_action in {"start", "stop", "cooling_full", "fan_only"}:
            rec.mode = "deferred"
        else:
            rec.mode = "deferred"


def _action_decisions_from_saved_recommendations(saved_recommendations: list) -> dict:
    action_decisions = {}
    for rec, sr in saved_recommendations:
        decision = getattr(sr, "execution_action", None) or {}
        action = decision.get("action")
        if action not in {"start", "stop", "cooling_full", "fan_only"}:
            continue
        domain = _execution_domain(decision, sr.category)
        if domain not in {"irrigation", "climate"}:
            continue
        decision = {
            **decision,
            "execution_source": "saved_recommendation",
            "saved_recommendation_id": getattr(rec, "id", None),
        }
        if domain == "irrigation":
            action_decisions["irrigation"] = decision
        elif domain == "climate":
            action_decisions["climate"] = decision
    return action_decisions


def _execution_domain(decision: Optional[dict], fallback_category: Optional[str]) -> Optional[str]:
    decision = decision or {}
    domain = decision.get("domain")
    action = decision.get("action")
    if domain in {"irrigation", "climate"}:
        return domain
    if action in {"start", "stop"}:
        return "irrigation"
    if action in {"cooling_full", "fan_only"}:
        return "climate"
    if fallback_category == "irrigation":
        return "irrigation"
    if fallback_category in {"temperature", "humidity"}:
        return "climate"
    return None


def _apply_auto_alert_statuses(saved_alerts: list, automation_result: dict, farm_auto_mode: bool) -> None:
    if not saved_alerts:
        return
    if not farm_auto_mode:
        for alert, _sr in saved_alerts:
            alert.action_status = None
        return

    results = (automation_result or {}).get("results") or {}
    for alert, sr in saved_alerts:
        decision = getattr(sr, "execution_action", None) or {}
        domain = _execution_domain(decision, sr.category)
        decision_action = decision.get("action")
        result = results.get(domain) if domain else None
        alert.action_result = result

        if result and result.get("executed"):
            alert.action_status = "executing"
        elif result and _already_in_desired_state(result.get("reason")):
            alert.action_status = "executing"
        elif _is_deferred_decision(decision, result):
            alert.action_status = "deferred"
        elif result:
            alert.action_status = "deferred"
        elif decision_action in {"start", "stop", "cooling_full", "fan_only"}:
            alert.action_status = "deferred"
        else:
            alert.action_status = None


def _already_in_desired_state(reason: Optional[str]) -> bool:
    text = (reason or "").lower()
    return "already active" in text or "already stopped" in text or "mode already active" in text


def _is_deferred_decision(decision: dict, result: Optional[dict]) -> bool:
    text = f"{decision.get('reason') or ''} {(result or {}).get('reason') or ''}".lower()
    safety = decision.get("safety") or {}
    if safety.get("blocked"):
        return True
    return (
        decision.get("action") == "hold"
        or "blocked" in text
        or "safety" in text
        or "ليل" in text
        or "فطر" in text
        or "night" in text
        or "fungal" in text
    )
