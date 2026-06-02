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
from sqlalchemy import text

from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env into os.environ so os.getenv() works in all modules (e.g. tuya_client)
# pydantic-settings reads .env into the Settings model but does NOT populate os.environ
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from src.core.config import settings  # noqa: E402
from src.db.session import engine  # noqa: E402
from src.chatbot.chatbot_api import router as chatbot_router  # noqa: E402
from src.api.routes import (  # noqa: E402
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

_background_tasks: list[asyncio.Task] = []

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
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1):.*|https://.*\.railway\.app|https://.*\.up\.railway\.app)",
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
app.include_router(chatbot_router,         prefix="/api/v1/chatbot",         tags=["Chatbot"])

async def physics_simulation():
    """Run physics engine simulator as a background task. Auto-restarts on crash."""
    await asyncio.sleep(3)
    while True:
        try:
            from scripts.physics_engine_simulator import engine_loop
            await engine_loop()
        except Exception as e:
            print(f"[Physics Engine] Crashed: {e} — restarting in 15s")
        await asyncio.sleep(15)

async def seed_tuya_devices():
    """Ensure Tuya actuator devices from tuya_devices.json exist in the DB."""
    import json
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select
    from src.db.models.models import Device, Actuator

    _actuator_type_map = {
        "irrigation": "irrigation_valve",
        "fan":        "fan",
        "cooling":    "cooler",
    }

    config_path = Path(__file__).resolve().parents[2] / "tuya_devices.json"
    if not config_path.exists():
        return

    cfg = json.loads(config_path.read_text())
    farm_id = int(cfg.get("farm_id", -1))
    actuators_cfg = cfg.get("actuators", {})
    if farm_id < 0 or not actuators_cfg:
        return

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session_maker() as db:
            for key, info in actuators_cfg.items():
                device_id    = info.get("warif_device_id")
                name         = info.get("warif_name", key)
                actuator_type = _actuator_type_map.get(key, "irrigation_valve")
                if not device_id:
                    continue

                existing = await db.execute(select(Device).where(Device.device_id == device_id))
                existing_device = existing.scalar_one_or_none()
                if existing_device:
                    if existing_device.farm_id != farm_id:
                        existing_device.farm_id = farm_id
                        print(f"[Seed] Reassigned Tuya device: {device_id} -> farm {farm_id}")

                    actuator_result = await db.execute(select(Actuator).where(Actuator.device_id == device_id))
                    if actuator_result.scalar_one_or_none() is None:
                        db.add(Actuator(device_id=device_id, actuator_type=actuator_type, state="off"))
                    continue

                db.add(Device(farm_id=farm_id, device_id=device_id, name=name, type="actuator"))
                await db.flush()
                db.add(Actuator(device_id=device_id, actuator_type=actuator_type, state="off"))
                print(f"[Seed] Registered Tuya device: {device_id} ({name}) → farm {farm_id}")

            await db.commit()
    except Exception as e:
        print(f"[Seed] Tuya device seeding failed: {e}")
    finally:
        await engine.dispose()


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

    async with engine.begin() as conn:
        column_type = "JSONB" if settings.DATABASE_URL.startswith(("postgresql", "postgres")) else "JSON"
        await conn.execute(text(f"ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS execution_action {column_type}"))
        await conn.execute(text(f"ALTER TABLE alerts ADD COLUMN IF NOT EXISTS execution_action {column_type}"))
        await conn.execute(text("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_status VARCHAR(20)"))
        await conn.execute(text(f"ALTER TABLE alerts ADD COLUMN IF NOT EXISTS action_result {column_type}"))

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

    async def tuya_bridge():
        """Run the Tuya polling bridge in a background thread. Auto-restarts on crash."""
        await asyncio.sleep(5)  # wait for the DB to be ready
        while True:
            try:
                from src.services.tuya_bridge_service import run as bridge_run
                print("[Tuya Bridge] Starting...")
                await asyncio.to_thread(bridge_run)
            except Exception as e:
                print(f"[Tuya Bridge] Stopped: {e} — restarting in 15s")
            await asyncio.sleep(15)

    async def tuya_closed_loop_cooling():
        """Run the Tuya closed-loop cooling controller. Auto-restarts on crash."""
        await asyncio.sleep(8)  # wait for the DB to be ready
        while True:
            try:
                from src.services.tuya_closed_loop import run as loop_run
                print("[Tuya Closed-Loop] Starting...")
                await loop_run()
            except Exception as e:
                print(f"[Tuya Closed-Loop] Stopped: {e} — restarting in 15s")
            await asyncio.sleep(15)

    tasks = [
        asyncio.create_task(connectivity_monitoring()),
        asyncio.create_task(ml_monitoring()),
        asyncio.create_task(tuya_bridge()),
        asyncio.create_task(tuya_closed_loop_cooling()),
        asyncio.create_task(seed_tuya_devices()),
    ]
    if not getattr(app.state, "physics_task_started", False):
        tasks.append(asyncio.create_task(physics_simulation()))
        app.state.physics_task_started = True
    _background_tasks.extend(tasks)


@app.on_event("shutdown")
async def shutdown_event():
    """Cancel background tasks and close DB connections before the process exits."""
    from src.db.session import engine

    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)

    await engine.dispose()


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api", "version": "1.0.0"}
