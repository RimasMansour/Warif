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

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Optional
import logging

from chatbot.rag_pipeline import ask, retrieve

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response models ──────────────────────────────────────────────────

class SoilData(BaseModel):
    moisture_percent    : Optional[float] = Field(None, description="Soil moisture % (optimal: 60-80)")
    temperature_celsius : Optional[float] = Field(None, description="Soil temp °C (optimal: 20-30)")
    ph                  : Optional[float] = Field(None, description="Soil pH (optimal: 6.0-6.8)")
    ec                  : Optional[float] = Field(None, description="Electrical conductivity mS/cm (optimal: 1.5-2.5)")


class AirData(BaseModel):
    temperature_celsius : Optional[float] = Field(None, description="Air temp °C (optimal day: 22-28)")
    humidity_percent    : Optional[float] = Field(None, description="Relative humidity % (optimal: 70-85)")
    co2_ppm             : Optional[float] = Field(None, description="CO2 concentration ppm (optimal: 800-1200)")


class SensorSnapshot(BaseModel):
    """
    Live sensor reading from your IoT backend.
    All fields are optional — pass whatever sensors you have available.
    """
    timestamp    : Optional[str]     = None
    farm_id      : Optional[str]     = None
    crop         : Optional[str]     = "cucumber"
    growth_stage : Optional[str]     = None
    soil         : Optional[SoilData]  = None
    air          : Optional[AirData]   = None
    alerts       : Optional[list[str]] = []


class ChatRequest(BaseModel):
    question     : str            = Field(..., min_length=2, description="Farmer's question (Arabic or English)")
    sensor_data  : Optional[SensorSnapshot] = Field(None, description="Live sensor reading (optional)")
    n_chunks     : int            = Field(4, ge=1, le=8, description="Number of knowledge chunks to retrieve")
    language     : str            = Field("ar", description="Response language: 'ar' for Arabic, 'en' for English")


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


# ── Helper: convert Pydantic SensorSnapshot → plain dict for rag_pipeline ─────
def _sensor_to_dict(sensor: Optional[SensorSnapshot]) -> Optional[dict]:
    """Convert Pydantic model to the plain dict format rag_pipeline expects."""
    if sensor is None:
        return None

    d = {
        "timestamp"    : sensor.timestamp,
        "crop"         : sensor.crop,
        "growth_stage" : sensor.growth_stage,
        "alerts"       : sensor.alerts or []
    }
    if sensor.soil:
        d["soil"] = {
            "moisture_percent"   : sensor.soil.moisture_percent,
            "temperature_celsius": sensor.soil.temperature_celsius,
            "ph"                 : sensor.soil.ph,
            "ec"                 : sensor.soil.ec
        }
    if sensor.air:
        d["air"] = {
            "temperature_celsius": sensor.air.temperature_celsius,
            "humidity_percent"   : sensor.air.humidity_percent,
            "co2_ppm"            : sensor.air.co2_ppm
        }
    return d


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=ChatResponse, summary="Ask the farming chatbot")
async def chat(request: ChatRequest = Body(...)):
    """
    Main chat endpoint. Accepts a farmer question and optional live sensor data.
    Returns an answer grounded in the knowledge base and sensor context.

    Example request body:
    ```json
    {
      "question": "My cucumber leaves are turning yellow. What is wrong?",
      "sensor_data": {
        "crop": "cucumber",
        "growth_stage": "fruiting",
        "soil": { "moisture_percent": 45, "ph": 6.4 },
        "air":  { "temperature_celsius": 28, "humidity_percent": 78 }
      }
    }
    ```
    """
    try:
        sensor_dict = _sensor_to_dict(request.sensor_data)

        result = ask(
            question    = request.question,
            sensor_data = sensor_dict,
            n_chunks    = request.n_chunks,
            language    = request.language,
            verbose     = True
        )

        return ChatResponse(
            answer      = result["answer"],
            sources     = result["sources"],
            distances   = result["distances"],
            sensor_used = result["sensor_used"]
        )

    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health", response_model=HealthResponse, summary="Chatbot health check")
async def health():
    """Check if ChromaDB and Groq are connected and working."""
    from chatbot.rag_pipeline import _collection, _groq_client

    chroma_ok    = False
    vector_count = 0
    groq_ok      = _groq_client is not None

    if _collection is not None:
        try:
            vector_count = _collection.count()
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
    Test endpoint that runs a question with simulated sensor readings.
    Useful for checking the full pipeline without a real IoT connection.
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

    result = ask(
        question    = "How is my greenhouse doing right now? What should I do?",
        sensor_data = simulated_sensor,
        n_chunks    = 4,
        verbose     = True
    )

    return ChatResponse(
        answer      = result["answer"],
        sources     = result["sources"],
        distances   = result["distances"],
        sensor_used = result["sensor_used"]
    )
