# backend/src/api/main.py
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.chatbot.chatbot_api import router as chatbot_router
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
# app.include_router(chatbot_router,         prefix="/api/v1/chatbot",         tags=["Chatbot"])  # Disabled temporarily

# ── Startup Events ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_monitoring():
    """بدء نظام المراقبة 24/7 عند تشغيل الخادم"""
    print("\n" + "="*70)
    print("🚀 Warif نظام المراقبة 24/7 بدأ")
    print("   يراقب الفيدباك والدقة...")
    print("="*70 + "\n")

    async def continuous_monitoring():
        """المراقبة المستمرة للفيدباك والدقة"""
        await asyncio.sleep(5)  # انتظر 5 ثواني حتى يبدأ الـ API

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
                                    print(f"⚠️  [EMERGENCY] المزرعة {farm.id}: {accuracy:.1f}%")
                                elif accuracy < 85:
                                    print(f"⚠️  [WARNING] المزرعة {farm.id}: {accuracy:.1f}%")

                        except Exception as e:
                            pass  # خطأ صامت لتجنب إغلاق الـ task

                await engine.dispose()
                await asyncio.sleep(60)

            except Exception as e:
                await asyncio.sleep(60)

    # بدء المراقبة كـ background task
    asyncio.create_task(continuous_monitoring())


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api", "version": "1.0.0"}
