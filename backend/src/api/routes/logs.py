from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from src.db.session import get_db
from src.db.models.models import ActivityLog, Farm
from src.core.security import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter()


@router.get("")
async def get_activity_logs(
    farm_id: int = Query(...),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = (
        select(ActivityLog)
        .where(ActivityLog.farm_id == farm_id)
        .order_by(desc(ActivityLog.created_at))
        .limit(limit)
    )
    result = await db.execute(q)
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "device_id": log.device_id,
            "details": log.details,
            "performed_by": log.performed_by,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.post("/add")
async def add_activity_log(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    log = ActivityLog(
        farm_id=payload.get("farm_id"),
        user_id=payload.get("user_id"),
        action_type=payload.get("action_type"),
        device_id=payload.get("device_id"),
        details=payload.get("details"),
        performed_by=payload.get("performed_by", "system"),
    )
    db.add(log)
    await db.commit()
    return {"success": True, "id": log.id}
