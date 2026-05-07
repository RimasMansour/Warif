# backend/src/api/routes/sensors.py
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

logger = logging.getLogger(__name__)

router = APIRouter()
RIYADH_TZ = ZoneInfo("Asia/Riyadh")


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


@router.get("/latest")
async def get_latest_readings(
    farm_id: int = Query(..., description="Farm ID"),
    db: AsyncSession = Depends(get_db)
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

        SENSOR_LABELS = {
            "soil_moisture":    "رطوبة التربة",
            "soil_temperature": "حرارة التربة",
            "air_temperature":  "درجة الحرارة",
            "air_humidity":     "رطوبة الهواء",
        }

        # 1. Lookup device to find its farm_id
        device_obj = None
        device_id = payload.get("device_id", "unknown")
        device_result = await db.execute(
            select(Device).where(Device.device_id == device_id)
        )
        device_obj = device_result.scalar_one_or_none()
        
        farm_id = device_obj.farm_id if device_obj else None

        reading = SensorReading(
            device_id=device_id,
            farm_id=farm_id,
            sensor_type=sensor_type,
            value=value,
            unit=payload.get("unit", ""),
        )
        db.add(reading)
        await db.flush()

        thresh_result = await db.execute(
            select(SensorThreshold).where(SensorThreshold.sensor_type == sensor_type)
        )
        threshold = thresh_result.scalar_one_or_none()

        if threshold:
            alert_status = _compute_status(value, threshold)
            if alert_status in ("warning", "critical"):
                severity = AlertSeverity.critical if alert_status == "critical" else AlertSeverity.warning
                label = SENSOR_LABELS.get(sensor_type, sensor_type)
                if alert_status == "critical":
                    message = f"انحراف حرج في {label} - القيمة الحالية ({value:.1f} {reading.unit}) تجاوزت الحد الأمثل ({threshold.max_value or threshold.min_value} {reading.unit}). الإجراء: مراجعة النظام فوراً."
                else:
                    message = f"انحراف طفيف في {label} - القيمة الحالية ({value:.1f} {reading.unit}) قريبة من الحد المتوقع ({threshold.warning_max or threshold.warning_min} {reading.unit}). التوصية: مراقبة التطور."

                # Alert logic here skipped to avoid duplication (handled by Decision Engine)
                pass

        full_sensor_data = {}
        device_obj = None
        try:
            device_result = await db.execute(
                select(Device).where(Device.device_id == payload.get("device_id", "unknown"))
            )
            device_obj = device_result.scalar_one_or_none()

            if device_obj and device_obj.farm_id:
                from sqlalchemy import func
                sub = (
                    select(SensorReading.sensor_type, func.max(SensorReading.timestamp).label("max_ts"))
                    .join(Device, SensorReading.device_id == Device.device_id)
                    .where(Device.farm_id == device_obj.farm_id)
                    .group_by(SensorReading.sensor_type)
                    .subquery()
                )
                recent_result = await db.execute(
                    select(SensorReading).join(sub, (SensorReading.sensor_type == sub.c.sensor_type) & (SensorReading.timestamp == sub.c.max_ts))
                )
                for r in recent_result.scalars().all():
                    full_sensor_data[r.sensor_type] = r.value
                full_sensor_data[sensor_type] = value
        except Exception as data_err:
            logger.warning(f"Data gathering failed: {data_err}")

        try:
            import sys, os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))
            anomaly_features = {
                "air_temperature":  full_sensor_data.get("air_temperature", 25.0),
                "air_humidity":     full_sensor_data.get("air_humidity", 50.0),
                "soil_moisture":    full_sensor_data.get("soil_moisture", 50.0),
                "soil_temperature": full_sensor_data.get("soil_temperature", 25.0),
                "co2":              650.0,
                "cum_irr":          2.0,
            }
            from src.ml.anomaly_knn import predict as knn_predict
            from src.ml.anomaly_svm import predict as svm_predict
            knn_result = knn_predict(anomaly_features)
            svm_result = svm_predict(anomaly_features)
            is_anomaly = knn_result.get("is_anomaly", False) or svm_result.get("is_anomaly", False)
            if is_anomaly:
                confidence = max(knn_result.get("confidence", 0), svm_result.get("confidence", 0))
                rule_violated = knn_result.get("rule_violated") or svm_result.get("rule_violated")
                anomaly_severity = AlertSeverity.critical if confidence >= 0.8 else AlertSeverity.warning
                label = SENSOR_LABELS.get(sensor_type, sensor_type)

                if rule_violated:
                    anomaly_msg = f"انحراف غير طبيعي في {label} - القيمة الحالية ({value:.1f} {reading.unit}) تنحرف عن النمط الطبيعي ({rule_violated}). الثقة: {confidence*100:.0f}%. الإجراء: فحص الحساس والنظام."
                else:
                    anomaly_msg = f"قراءة استثنائية في {label} - القيمة ({value:.1f} {reading.unit}) غير طبيعية بناءً على البيانات التاريخية. الثقة: {confidence*100:.0f}%. التوصية: تحقق من حالة الحساس."

                # Alert logic here skipped to avoid duplication (handled by Decision Engine)
                pass
                logger.info(f"[ANOMALY DETECTED] {sensor_type}={value} | kNN={knn_result['is_anomaly']} | SVM={svm_result['is_anomaly']}")
        except Exception as anomaly_err:
            logger.warning(f"Anomaly detection skipped: {anomaly_err}")

        if device_obj and device_obj.farm_id:
            try:
                from src.services.decision_engine import SmartDecisionEngine
                from src.db.models.models import Recommendation, RecommendationCategory, RecommendationSeverity, Alert, AlertSeverity, AlertStatus

                engine = SmartDecisionEngine()

                # استخدم القرار الذكي الشامل (مع Anomaly Detection + Risk Assessment)
                intelligence_report = await engine.analyze_with_intelligence(full_sensor_data, device_obj.farm_id)

                # Log the intelligence report
                logger.info(f"[DIGITAL_TWIN] Farm {device_obj.farm_id}: {intelligence_report['overall_intelligence']['status']}")
                logger.debug(f"Risk Level: {intelligence_report['overall_intelligence']['risk_level']}")

                # Handle anomalies
                for anomaly in intelligence_report.get('anomalies', []):
                    if anomaly['severity'] in ['critical', 'high']:
                        cooldown_time = datetime.now(timezone.utc) - timedelta(minutes=30)
                        existing_alert = await db.execute(
                            select(Alert).where(
                                Alert.sensor_type == anomaly['sensor'],
                                Alert.farm_id == (device_obj.farm_id if hasattr(device_obj, 'farm_id') else None),
                                Alert.status == AlertStatus.open,
                                Alert.created_at >= cooldown_time
                            )
                        )
                        if existing_alert.scalar_one_or_none() is not None:
                            continue

                        anomaly_message = f"🚨 شذوذ: {anomaly['sensor']} - {anomaly['description']}"
                        db.add(Alert(
                            sensor_type=anomaly['sensor'],
                            message=anomaly_message,
                            severity=AlertSeverity.critical if anomaly['severity'] == 'critical' else AlertSeverity.warning,
                            status=AlertStatus.open,
                            farm_id=device_obj.farm_id if hasattr(device_obj, 'farm_id') else None,
                        ))

                smart_recs = intelligence_report['recommendations']

                cat_map = {"irrigation": RecommendationCategory.irrigation, "temperature": RecommendationCategory.temperature, "humidity": RecommendationCategory.humidity, "soil": RecommendationCategory.soil}
                sev_map = {"normal": RecommendationSeverity.normal, "warning": RecommendationSeverity.warning, "urgent": RecommendationSeverity.urgent}

                for sr in smart_recs:
                    if sr.severity != "normal" or sr.category == "irrigation":
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

        await db.commit()
        return {
            "status": "ok",
            "sensor_type": sensor_type,
            "value": value,
            "alert_generated": threshold is not None and _compute_status(value, threshold) in ("warning", "critical")
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
    if threshold is None:
        return "normal"
    if (threshold.min_value is not None and value < threshold.min_value) or \
       (threshold.max_value is not None and value > threshold.max_value):
        return "critical"
    if (threshold.warning_min is not None and value < threshold.warning_min) or \
       (threshold.warning_max is not None and value > threshold.warning_max):
        return "warning"
    return "normal"
