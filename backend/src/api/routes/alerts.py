# backend/src/api/routes/alerts.py
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import Alert, AlertStatus
from src.api.schemas.schemas import AlertOut

router = APIRouter()


@router.get("", response_model=List[AlertOut])
async def list_alerts(
    status:   Optional[str] = Query(None, description="open | acknowledged | resolved"),
    severity: Optional[str] = Query(None),
    limit:    int           = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    q = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
    if status:
        q = q.where(Alert.status == status)
    if severity:
        q = q.where(Alert.severity == severity)
    result = await db.execute(q)
    return result.scalars().all()


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
