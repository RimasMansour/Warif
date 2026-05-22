"""
chatbot_api.py
--------------
FastAPI router for the Warif chatbot.
Mount this into your existing Warif FastAPI app with:

    from chatbot.chatbot_api import router as chatbot_router
    app.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])

Endpoints:
    POST /chatbot/ask           — main chat endpoint
    GET  /chatbot/health        — health check
    GET  /chatbot/test-sensor   — test with simulated sensor data
"""

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc, case
from sqlalchemy.ext.asyncio import AsyncSession

from src.chatbot.rag_pipeline import ask, get_collection, get_groq_client
from src.core.security import get_current_user
from src.db.models.models import Alert, AlertSeverity, AlertStatus, Farm, SensorReading
from src.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# Readings older than this are flagged as stale and the LLM is warned
SENSOR_MAX_AGE_HOURS = int(os.getenv("SENSOR_MAX_AGE_HOURS", "2"))


# ── Request / Response models ──────────────────────────────────────────────────

class ConversationMessage(BaseModel):
    role    : Literal["user", "assistant"]
    content : str


class ChatRequest(BaseModel):
    question : str = Field(..., min_length=2, description="Farmer's question (Arabic or English)")
    farm_id  : int = Field(..., description="Farm ID — sensor data and alerts are fetched automatically")
    n_chunks : int = Field(4, ge=1, le=8, description="Number of knowledge chunks to retrieve")
    language : str = Field("ar", description="Response language: 'ar' for Arabic, 'en' for English")
    history  : list[ConversationMessage] = Field(default_factory=list, description="Previous turns — append {role, content} pairs to enable follow-up questions")


class ChatResponse(BaseModel):
    answer       : str
    sources      : list[str]
    distances    : list[float]
    sensor_used  : bool
    model        : str = "groq/llama-3.1-8b-instant"


class HealthResponse(BaseModel):
    status       : str
    chroma_ok    : bool
    groq_ok      : bool
    vector_count : int


# ── DB helper: fetch latest sensor readings + active (unfixed) alerts ──────────
async def fetch_farm_context(farm_id: int, user_id: int, db: AsyncSession) -> dict | None:
    """
    Build the sensor context dict for the RAG pipeline:
    - Verifies the requesting user owns this farm (403 if not)
    - Fetches the latest reading per sensor type via MAX(timestamp) subquery
    - Flags readings older than SENSOR_MAX_AGE_HOURS as stale
    - Fetches only open/acknowledged alerts, ordered by severity then recency
    Returns None if the farm doesn't exist or isn't owned by this user.
    """
    farm_result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = farm_result.scalar_one_or_none()
    if farm is None:
        return None

    # Latest reading per sensor_type — subquery on MAX(timestamp)
    subq = (
        select(
            SensorReading.sensor_type,
            func.max(SensorReading.timestamp).label("max_ts")
        )
        .where(SensorReading.farm_id == farm_id)
        .group_by(SensorReading.sensor_type)
        .subquery()
    )
    readings_result = await db.execute(
        select(SensorReading)
        .join(
            subq,
            (SensorReading.sensor_type == subq.c.sensor_type) &
            (SensorReading.timestamp   == subq.c.max_ts)
        )
        .where(SensorReading.farm_id == farm_id)
    )
    latest_readings = readings_result.scalars().all()

    # Active alerts only — resolved alerts mean the issue is fixed, skip them
    # Order: critical first, then warning, then info; newest within each severity
    severity_order = case(
        (Alert.severity == AlertSeverity.critical, 0),
        (Alert.severity == AlertSeverity.warning,  1),
        else_=2
    )
    alerts_result = await db.execute(
        select(Alert)
        .where(Alert.farm_id == farm_id)
        .where(Alert.status.in_([AlertStatus.open, AlertStatus.acknowledged]))
        .order_by(severity_order, desc(Alert.created_at))
        .limit(10)
    )
    active_alerts = alerts_result.scalars().all()

    # Build soil/air dicts from the sensor map
    sensor_map = {r.sensor_type: r.value for r in latest_readings}

    soil: dict = {}
    if "soil_moisture"    in sensor_map: soil["moisture_percent"]    = sensor_map["soil_moisture"]
    if "soil_temperature" in sensor_map: soil["temperature_celsius"] = sensor_map["soil_temperature"]
    if "soil_ph"          in sensor_map: soil["ph"]                  = sensor_map["soil_ph"]
    if "soil_ec"          in sensor_map: soil["ec"]                  = sensor_map["soil_ec"]

    air: dict = {}
    if "air_temperature" in sensor_map: air["temperature_celsius"] = sensor_map["air_temperature"]
    if "air_humidity"    in sensor_map: air["humidity_percent"]    = sensor_map["air_humidity"]
    if "co2_ppm"         in sensor_map: air["co2_ppm"]             = sensor_map["co2_ppm"]
    elif "co2"           in sensor_map: air["co2_ppm"]             = sensor_map["co2"]

    # Only pass agricultural/environmental alerts to the LLM.
    # Sensor hardware anomalies (stuck sensor, unrealistic jump, etc.) have
    # explanation set to the anomaly_type — they are irrelevant to crop advice
    # and confuse the LLM into giving nonsensical recommendations.
    alert_messages = [
        a.message for a in active_alerts
        if not a.explanation or a.explanation not in (
            "sensor_stuck", "unrealistic_jump", "pattern_break", "threshold_violation"
        )
    ]

    # Stale data check — find the most recent timestamp across all sensor readings
    if latest_readings:
        newest_ts = max(r.timestamp for r in latest_readings)
        # Make both datetimes timezone-aware for comparison
        if newest_ts.tzinfo is None:
            newest_ts = newest_ts.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - newest_ts
        if age > timedelta(hours=SENSOR_MAX_AGE_HOURS):
            hours_old = int(age.total_seconds() // 3600)
            alert_messages.insert(
                0,
                f"⚠ Sensor data is {hours_old}h old — live readings may be unavailable"
            )
    else:
        alert_messages.insert(0, "⚠ No sensor readings found for this farm")

    return {
        "farm_id" : farm_id,
        "crop"    : farm.crop_type or "cucumber",
        "soil"    : soil if soil else None,
        "air"     : air  if air  else None,
        "alerts"  : alert_messages,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=ChatResponse, summary="Ask the farming chatbot")
async def chat(
    request      : ChatRequest   = Body(...),
    db           : AsyncSession  = Depends(get_db),
    current_user : dict          = Depends(get_current_user),
):
    """
    Main chat endpoint. Automatically fetches the latest sensor readings and all
    unresolved alerts for the given farm, then answers the farmer's question.
    Only the farm's owner can query it.

    Example request body:
    ```json
    {
      "question": "My cucumber leaves are turning yellow. What is wrong?",
      "farm_id": 1
    }
    ```
    """
    try:
        sensor_dict = await fetch_farm_context(
            farm_id  = request.farm_id,
            user_id  = int(current_user["sub"]),
            db       = db,
        )
        if sensor_dict is None:
            raise HTTPException(status_code=403, detail="Farm not found or access denied")

        # ask() is synchronous (ChromaDB + Groq HTTP) — run in a thread to avoid
        # blocking the event loop while other requests are waiting
        result = await asyncio.to_thread(
            ask,
            question    = request.question,
            sensor_data = sensor_dict,
            n_chunks    = request.n_chunks,
            language    = request.language,
            history     = [m.model_dump() for m in request.history],
            verbose     = True,
        )

        return ChatResponse(
            answer      = result["answer"],
            sources     = result["sources"],
            distances   = result["distances"],
            sensor_used = result["sensor_used"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse, summary="Chatbot health check")
async def health():
    """Check if ChromaDB and Groq are connected and working."""
    chroma_col   = get_collection()
    groq_client  = get_groq_client()

    chroma_ok    = False
    vector_count = 0
    groq_ok      = groq_client is not None

    if chroma_col is not None:
        try:
            vector_count = chroma_col.count()
            chroma_ok    = True
        except Exception as e:
            logger.warning(f"ChromaDB health check failed: {e}")

    overall = "ok" if (chroma_ok and groq_ok) else "degraded"
    return HealthResponse(
        status       = overall,
        chroma_ok    = chroma_ok,
        groq_ok      = groq_ok,
        vector_count = vector_count
    )


@router.get("/test-sensor", response_model=ChatResponse, summary="Test with simulated sensor data")
async def test_with_sensor():
    """
    Test endpoint that runs a question with hardcoded sensor readings.
    Useful for checking the full pipeline without a real farm or IoT connection.
    """
    simulated_sensor = {
        "timestamp"    : "2026-04-13T10:00:00Z",
        "crop"         : "cucumber",
        "growth_stage" : "fruiting",
        "soil": {
            "moisture_percent"   : 43,
            "temperature_celsius": 25.0,
            "ph"                 : 6.5,
            "ec"                 : 2.0
        },
        "air": {
            "temperature_celsius": 31.0,
            "humidity_percent"   : 82,
            "co2_ppm"            : 620
        },
        "alerts": [
            "Soil moisture below optimal (43% < 60%)",
            "CO2 below recommended level (620 ppm < 800 ppm)"
        ]
    }

    result = await asyncio.to_thread(
        ask,
        question    = "How is my greenhouse doing right now? What should I do?",
        sensor_data = simulated_sensor,
        n_chunks    = 4,
        verbose     = True,
    )

    return ChatResponse(
        answer      = result["answer"],
        sources     = result["sources"],
        distances   = result["distances"],
        sensor_used = result["sensor_used"],
    )
