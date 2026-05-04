# backend/src/api/routes/alerts.py
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import Alert, AlertStatus
from src.api.schemas.schemas import AlertOut
from src.services.presentation_formatter import PresentationFormatter

router = APIRouter()
formatter = PresentationFormatter()


@router.get("", response_model=List[dict])
async def list_alerts(
    status:   Optional[str] = Query(None, description="open | acknowledged | resolved"),
    severity: Optional[str] = Query(None),
    farm_id:  Optional[int] = Query(None),
    limit:    int           = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if status:
        q = q.where(Alert.status == status)
    if severity:
        q = q.where(Alert.severity == severity)
    if farm_id:
        q = q.where(Alert.farm_id == farm_id)
    result = await db.execute(q)
    alerts = result.scalars().all()

    # تنسيق احترافي للبيانات
    professional_alerts = []
    for alert in alerts:
        # استخراج معلومات الجهاز من device_id
        device_name = alert.device_id if alert.device_id else "جهاز"

        if alert.sensor_type and alert.actual_value is not None:
            # تنسيق متخصص حسب نوع الحساس
            if alert.sensor_type == "soil_moisture":
                formatted = formatter.format_soil_moisture_alert(
                    current=alert.actual_value,
                    optimal_min=55,
                    optimal_max=70
                )
            elif alert.sensor_type == "air_temperature":
                formatted = formatter.format_temperature_alert(alert.actual_value)
            elif alert.sensor_type == "air_humidity":
                formatted = formatter.format_humidity_alert(alert.actual_value)
            else:
                formatted = formatter.format_alert(
                    alert_type="anomaly_detected",
                    current_value=alert.actual_value,
                    sensor_name=alert.sensor_type,
                    device_name=device_name
                )
        else:
            # fallback للتنبيهات بدون بيانات مفصلة
            formatted = formatter.format_alert(
                alert_type="anomaly_detected",
                sensor_name=alert.sensor_type or "System",
                device_name=device_name,
                current_str=f"Value: {alert.actual_value}" if alert.actual_value else "Unknown"
            )

        professional_alerts.append({
            "id": alert.id,
            "icon": formatted.icon,
            "title": formatted.title,
            "severity": formatted.severity,
            "current_value": formatted.current_value,
            "expected_value": formatted.expected_value,
            "difference": formatted.difference,
            "reason": formatted.reason,
            "action": formatted.action,
            "urgency": formatted.urgency,
            "timestamp": formatted.timestamp,
            "status": alert.status,
            "sensor_type": alert.sensor_type,
        })

    return professional_alerts


@router.post("/{alert_id}/ack", response_model=AlertOut)
async def acknowledge_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await _get_or_404(alert_id, db)
    alert.status = AlertStatus.acknowledged
    await db.flush()
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await _get_or_404(alert_id, db)
    alert.status = AlertStatus.resolved
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return alert


async def _get_or_404(alert_id: int, db: AsyncSession) -> Alert:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
