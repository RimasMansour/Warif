# backend/src/api/routes/alerts.py
"""
Alerts Routes — Warif API
==========================
Handles all alert management endpoints:
  - GET  /alerts                    : list alerts with optional filters (status, severity, farm_id)
  - POST /alerts/{id}/ack           : acknowledge an alert
  - POST /alerts/{id}/resolve       : mark an alert as resolved
  - POST /alerts/{id}/feedback      : submit helpful/not helpful feedback on an alert

Alerts are generated automatically by:
  - The Simulator (water tank level, anomalies)
  - The Decision Engine (sensor threshold violations)
  - The Anomaly Alert System (kNN + SVM detection)

All endpoints require JWT authentication.
"""
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.core.security import get_current_user
from src.db.models.models import Alert, AlertStatus, Farm
from src.api.schemas.schemas import AlertOut

router = APIRouter()


# Request body schema for alert feedback — farmer rates if alert was useful or not
class AlertFeedbackRequest(BaseModel):
    helpful: bool


# Returns filtered list of alerts scoped to the requesting user's farm
# farm_id is required; ownership is verified before returning any data
@router.get("", response_model=List[dict])
async def list_alerts(
    farm_id:  int           = Query(..., description="Farm ID — required"),
    status:   Optional[str] = Query(None, description="open | acknowledged | resolved"),
    severity: Optional[str] = Query(None),
    limit:    int           = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    farm_check = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == int(current_user["sub"]))
    )
    if not farm_check.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Access denied: Farm not owned by current user")

    q = (
        select(Alert)
        .where(Alert.farm_id == farm_id)
        .order_by(desc(Alert.created_at))
        .limit(limit)
    )
    if status:
        q = q.where(Alert.status == status)
    if severity:
        q = q.where(Alert.severity == severity)
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


# Marks an alert as acknowledged — farmer has seen and noted the alert
@router.post("/{alert_id}/ack", response_model=AlertOut)
async def acknowledge_alert(alert_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    alert = await _get_or_404(alert_id, db)
    alert.status = AlertStatus.acknowledged
    await db.flush()
    return alert


# Marks an alert as resolved — issue has been addressed by the farmer
@router.post("/{alert_id}/resolve", response_model=AlertOut)
async def resolve_alert(alert_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
    current_user: dict = Depends(get_current_user),
):
    """
    Save farmer feedback on an alert (helpful or not).
    This feedback is used to improve anomaly detection and alert quality over time.
    Request body: {"helpful": true/false}
    """
    alert = await _get_or_404(alert_id, db)
    alert.helpful = feedback.helpful
    await db.commit()
    await db.refresh(alert)

    print(f"[Alert Feedback] Alert {alert_id}: {'helpful' if feedback.helpful else 'not helpful'}")

    return {
        "id": alert.id,
        "helpful": alert.helpful,
        "message": "Alert feedback recorded successfully"
    }


async def _get_or_404(alert_id: int, db: AsyncSession) -> Alert:
    """Fetch alert by ID. Raises 404 if not found."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
