# backend/src/api/routes/ml.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import datetime

router = APIRouter()


# ── Response schemas ───────────────────────────────────────────────────────

class YieldPrediction(BaseModel):
    tray_id:          Optional[int]
    crop_type:        Optional[str]
    predicted_yield_g: float
    confidence:       float        # 0–1
    model:            str


class GrowthPoint(BaseModel):
    date:             datetime.date
    predicted_height_cm: float
    lower_bound:      float
    upper_bound:      float


class RetrainResponse(BaseModel):
    status:  str
    message: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/predictions/yield", response_model=List[YieldPrediction])
async def get_yield_predictions():
    """
    Return ML yield predictions for each active tray.
    TODO: wire up to the actual ML service / model inference.
    """
    # Placeholder until ML service is integrated
    return [
        YieldPrediction(
            tray_id=1,
            crop_type="lettuce",
            predicted_yield_g=320.5,
            confidence=0.82,
            model="xgboost_v1",
        )
    ]


@router.get("/predictions/growth-trajectory", response_model=List[GrowthPoint])
async def get_growth_trajectory():
    """
    Return a 14-day growth forecast using Prophet.
    TODO: wire up to Prophet model inference.
    """
    today = datetime.date.today()
    return [
        GrowthPoint(
            date=today + datetime.timedelta(days=i),
            predicted_height_cm=5.0 + i * 0.8,
            lower_bound=4.0 + i * 0.7,
            upper_bound=6.0 + i * 0.9,
        )
        for i in range(14)
    ]


@router.post("/models/retrain", response_model=RetrainResponse)
async def retrain_models():
    """
    Trigger async model retraining.
    TODO: dispatch to a background worker / Celery task.
    """
    return RetrainResponse(status="queued", message="Model retraining job has been queued.")
