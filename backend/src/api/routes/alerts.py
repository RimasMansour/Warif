# backend/src/api/routes/alerts.py
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import Alert, AlertStatus
from src.api.schemas.schemas import AlertOut

router = APIRouter()


class AlertFeedbackRequest(BaseModel):
    helpful: bool


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

    alert_list = []
    for alert in alerts:
        try:
            severity_value = alert.severity.value if hasattr(alert.severity, 'value') else str(alert.severity)
            status_value = alert.status.value if hasattr(alert.status, 'value') else str(alert.status)

            alert_list.append({
                "id": alert.id,
                "message": alert.message,
                "severity": severity_value,
                "status": status_value,
                "sensor_type": alert.sensor_type,
                "category": alert.sensor_type,
                "device_id": alert.device_id,
                "actual_value": alert.actual_value,
                "threshold": alert.threshold,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
            })
        except Exception as e:
            print(f"[ERROR] Alert {alert.id}: {e}")
            continue

    return alert_list


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


@router.post("/{alert_id}/feedback")
async def submit_alert_feedback(
    alert_id: int,
    feedback: AlertFeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    حفظ تقييم المستخدم على التنبيه (مفيد أم إزعاج).
    هذا الفيدباك يُستخدم لتحسين نظام اكتشاف الشذوذ والتنبيهات.

    Request body: {"helpful": true/false}
    """
    alert = await _get_or_404(alert_id, db)
    alert.helpful = feedback.helpful
    await db.commit()
    await db.refresh(alert)

    print(f"[Alert Feedback] التنبيه {alert_id}: {'✅ مفيد' if feedback.helpful else '❌ إزعاج'}")

    return {
        "id": alert.id,
        "helpful": alert.helpful,
        "message": "Alert feedback recorded successfully"
    }


async def _get_or_404(alert_id: int, db: AsyncSession) -> Alert:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
