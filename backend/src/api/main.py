# backend/src/api/main.py
"""
Warif FastAPI Application Entry Point
=======================================
Initializes the FastAPI app with:
  - CORS middleware configured for Railway and local development
  - All API routers mounted under /api/v1/
  - Background monitoring tasks started on startup:
      * connectivity_monitoring: checks device online/offline status every 60s
      * ml_monitoring: tracks ML recommendation accuracy every 60s

To run locally:
    cd backend
    python -m uvicorn src.api.main:app --reload --port 8000
"""
import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env into os.environ so os.getenv() works in all modules (e.g. tuya_client)
# pydantic-settings reads .env into the Settings model but does NOT populate os.environ
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from src.core.config import settings
# DISABLED LOCALLY - Rimas's work on Chatbot
# from src.chatbot.chatbot_api import router as chatbot_router
from src.api.routes import (
    auth,
    sensors,
    alerts,
    commands,
    ml,
    config,
    farms,
    irrigation,
    recommendations,
    dashboard,
    logs,
)

app = FastAPI(
    title="Warif API",
    description="AI-Toward Digital Twin for Smart Farms — Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(auth.router,            prefix="/api/v1/auth",            tags=["Auth"])
app.include_router(farms.router,           prefix="/api/v1/farms",           tags=["Farms"])
app.include_router(sensors.router,         prefix="/api/v1/sensors",         tags=["Sensors"])
app.include_router(irrigation.router,      prefix="/api/v1/irrigation",      tags=["Irrigation"])
app.include_router(recommendations.router, prefix="/api/v1/recommendations", tags=["Recommendations"])
app.include_router(dashboard.router,       prefix="/api/v1/dashboard",       tags=["Dashboard"])
app.include_router(alerts.router,          prefix="/api/v1/alerts",          tags=["Alerts"])
app.include_router(commands.router,        prefix="/api/v1/commands",        tags=["Commands"])
app.include_router(ml.router,             prefix="/api/v1/ml",              tags=["ML"])
app.include_router(config.router,          prefix="/api/v1/config",          tags=["Config"])
app.include_router(logs.router,            prefix="/api/v1/logs",            tags=["Logs"])
# DISABLED LOCALLY - Rimas's work on Chatbot
# app.include_router(chatbot_router,         prefix="/api/v1/chatbot",         tags=["Chatbot"])

# ── Startup Events ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_monitoring():
    """Start background monitoring tasks when the server boots."""
    import sys
    out = sys.stdout.buffer if hasattr(sys.stdout, 'buffer') else None
    msg = "\n" + "="*70 + "\nWarif - System monitoring started (24/7)\n" + "="*70 + "\n"
    if out:
        out.write(msg.encode('utf-8'))
        out.flush()
    else:
        print(msg)

    async def connectivity_monitoring():
        """Monitor device connectivity — runs independently of ML monitoring."""
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from src.services.connectivity_monitor import ConnectivityMonitor
        from src.db.models.models import Farm
        from sqlalchemy import select

        await asyncio.sleep(5)
        engine = create_async_engine(settings.DATABASE_URL, echo=False)
        async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        while True:
            try:
                async with async_session_maker() as db:
                    result = await db.execute(select(Farm))
                    farms = result.scalars().all()
                    for farm in farms:
                        try:
                            alerts = await ConnectivityMonitor.check_farm_connectivity(farm.id, db)
                            if alerts:
                                print(f"[Connectivity] {len(alerts)} new alert(s) for farm {farm.id}")
                        except Exception as e:
                            print(f"[Connectivity Error] Farm {farm.id}: {e}")
            except Exception as e:
                print(f"[Connectivity Fatal]: {e}")
            await asyncio.sleep(60)

    async def ml_monitoring():
        """Monitor ML feedback accuracy — gracefully handles missing ML libraries."""
        await asyncio.sleep(10)
        while True:
            try:
                from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
                from sqlalchemy.orm import sessionmaker
                from src.ml.feedback_integration import FeedbackLearningBridge
                from src.db.models.models import Farm
                from sqlalchemy import select

                engine = create_async_engine(settings.DATABASE_URL, echo=False)
                async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

                async with async_session_maker() as db:
                    result = await db.execute(select(Farm))
                    farms = result.scalars().all()
                    for farm in farms:
                        try:
                            bridge = FeedbackLearningBridge(db)
                            stats = await bridge.calculate_feedback_accuracy(farm.id, days=7)
                            accuracy = stats['overall_accuracy']
                            total = stats['total_feedback']
                            if total > 0:
                                if accuracy < 80:
                                    print(f"[EMERGENCY] Farm {farm.id}: {accuracy:.1f}%")
                                elif accuracy < 85:
                                    print(f"[WARNING] Farm {farm.id}: {accuracy:.1f}%")
                        except Exception as e:
                            print(f"[ML Monitor Error] Farm {farm.id}: {e}")

                await engine.dispose()
            except Exception as e:
                print(f"[ML Monitor Fatal]: {e}")
            await asyncio.sleep(60)

    asyncio.create_task(connectivity_monitoring())
    asyncio.create_task(ml_monitoring())


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api", "version": "1.0.0"}
