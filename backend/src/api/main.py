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
    allow_origin_regex=r"https://.*\.railway\.app",
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
# app.include_router(chatbot_router,         prefix="/api/v1/chatbot",         tags=["Chatbot"])  # Disabled temporarily

# ── Startup Events ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_monitoring():
    """بدء نظام المراقبة 24/7 عند تشغيل الخادم"""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from src.ml.feedback_integration import FeedbackLearningBridge
    from src.db.models.models import Farm
    from sqlalchemy import select

    async def continuous_monitoring():
        """المراقبة المستمرة للفيدباك والدقة"""
        print("\n" + "="*70)
        print("🚀 نظام المراقبة 24/7 بدأ")
        print("   يراقب الفيدباك والدقة كل دقيقة واحدة")
        print("="*70 + "\n")

        while True:
            try:
                engine = create_async_engine(
                    settings.DATABASE_URL,
                    echo=False,
                )

                async_session_maker = sessionmaker(
                    engine, class_=AsyncSession, expire_on_commit=False
                )

                async with async_session_maker() as db:
                    # جلب قائمة المزارع
                    result = await db.execute(select(Farm))
                    farms = result.scalars().all()

                    for farm in farms:
                        try:
                            bridge = FeedbackLearningBridge(db)

                            # حساب الدقة على آخر 7 أيام
                            stats = await bridge.calculate_feedback_accuracy(farm.id, days=7)
                            accuracy = stats['overall_accuracy']
                            total = stats['total_feedback']

                            if total == 0:
                                continue

                            # 🚨 حالة الطوارئ: الدقة < 80%
                            if accuracy < 80:
                                print(f"\n⚠️  [EMERGENCY] المزرعة {farm.id}: دقة التوصيات = {accuracy:.1f}%")
                                print(f"   {stats['by_category']}")
                                print(f"   بحاجة لإعادة تدريب فورية!")

                            # ⚠️ تحذير: الدقة 80-85%
                            elif accuracy < 85:
                                print(f"\n⚠️  [WARNING] المزرعة {farm.id}: دقة = {accuracy:.1f}%")
                                print(f"   مجدولة إعادة تدريب...")

                            # ✅ عادي: الدقة > 85%
                            else:
                                print(f"✅ المزرعة {farm.id}: دقة = {accuracy:.1f}% | {total} فيدباك")

                        except Exception as e:
                            print(f"❌ خطأ مراقبة المزرعة {farm.id}: {e}")

                await engine.dispose()

                # انتظر دقيقة واحدة قبل الفحص التالي
                await asyncio.sleep(60)

            except Exception as e:
                print(f"❌ خطأ في دورة المراقبة: {e}")
                await asyncio.sleep(60)

    # بدء المراقبة كـ background task
    asyncio.create_task(continuous_monitoring())


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api", "version": "1.0.0"}
