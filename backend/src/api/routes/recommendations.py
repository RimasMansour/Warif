# backend/src/api/routes/recommendations.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import Recommendation, Farm
from src.api.schemas.schemas import RecommendationOut
from src.core.security import get_current_user
from src.services.presentation_formatter import PresentationFormatter

router = APIRouter()
formatter = PresentationFormatter()


@router.get("/{farm_id}", response_model=List[dict])
async def list_recommendations(
    farm_id: int,
    category: Optional[str] = Query(None, description="irrigation | temperature | humidity | soil | general"),
    severity: Optional[str] = Query(None, description="normal | warning | urgent"),
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List recommendations for a farm, filterable by category and severity."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    q = (
        select(Recommendation)
        .where(Recommendation.farm_id == farm_id)
        .order_by(desc(Recommendation.created_at))
        .limit(limit)
    )
    if category:
        q = q.where(Recommendation.category == category)
    if severity:
        q = q.where(Recommendation.severity == severity)
    if unread_only:
        q = q.where(Recommendation.is_read == False)

    result = await db.execute(q)
    recommendations = result.scalars().all()

    # تنسيق احترافي للبيانات
    professional_recs = []
    for rec in recommendations:
        # تنسيق مخصص حسب نوع التوصية
        formatted = formatter.format_recommendation(
            rec_type=f"{rec.category}" if rec.category else "general",
            data_insight=rec.reasoning or rec.message,
            category=rec.category or "general"
        )

        professional_recs.append({
            "id": rec.id,
            "title": formatted.title,
            "data_insight": formatted.data_insight,
            "reason": formatted.reason,
            "suggestion": formatted.suggestion,
            "benefit": formatted.benefit,
            "timing": formatted.timing,
            "priority": formatted.priority,
            "category": formatted.category,
            "is_read": rec.is_read,
            "created_at": rec.created_at.isoformat() if rec.created_at else None,
            "severity": rec.severity,
            "message": rec.message,
        })

    return professional_recs


@router.post("/{farm_id}/mark-read/{recommendation_id}", response_model=RecommendationOut)
async def mark_as_read(
    farm_id: int,
    recommendation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark a recommendation as read."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    result = await db.execute(
        select(Recommendation).where(
            Recommendation.id == recommendation_id,
            Recommendation.farm_id == farm_id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.is_read = True
    await db.commit()
    await db.refresh(rec)
    return rec


@router.post("/{farm_id}/mark-all-read", response_model=dict)
async def mark_all_read(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark all recommendations for a farm as read."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    result = await db.execute(
        select(Recommendation).where(
            Recommendation.farm_id == farm_id,
            Recommendation.is_read == False,
        )
    )
    recs = result.scalars().all()
    for rec in recs:
        rec.is_read = True

    await db.commit()
    return {"marked_read": len(recs)}


async def _get_farm_or_404(farm_id: int, user_id: int, db: AsyncSession) -> Farm:
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm
