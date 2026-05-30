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

from src.core.config import settings  # noqa: E402
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
                if existing.scalar_one_or_none():
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

    _background_tasks.extend([
        asyncio.create_task(connectivity_monitoring()),
        asyncio.create_task(ml_monitoring()),
        asyncio.create_task(physics_simulation()),
        asyncio.create_task(tuya_bridge()),
        asyncio.create_task(seed_tuya_devices()),
    ])


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


# ── Irrigation Diagnostic (temporary) ─────────────────────────────────────
@app.post("/api/v1/debug/irrigation/{action}", tags=["Debug"])
async def debug_irrigation(action: str):
    """
    Diagnostic endpoint — tests each layer independently.
    action: 'on' | 'off' | 'status'
    Returns a step-by-step report so you can see exactly where the failure is.
    """
    import os
    import json
    from src.services import tuya_client

    report = {}

    # Step 1: check config file
    config_path = Path(__file__).resolve().parents[2] / "tuya_devices.json"
    report["config_file_exists"] = config_path.exists()
    if config_path.exists():
        cfg = json.loads(config_path.read_text())
        irr = cfg.get("actuators", {}).get("irrigation", {})
        report["tuya_device_id"] = irr.get("tuya_device_id", "MISSING")
        report["switch_code"]    = irr.get("switch_code", "MISSING")
        report["farm_id"]        = cfg.get("farm_id", "MISSING")

    # Step 2: check env credentials
    report["TUYA_ACCESS_ID_set"]     = bool(os.getenv("TUYA_ACCESS_ID", ""))
    report["TUYA_ACCESS_SECRET_set"] = bool(os.getenv("TUYA_ACCESS_SECRET", ""))
    report["TUYA_API_ENDPOINT"]      = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaeu.com")

    # Step 3: try to connect
    try:
        api = await asyncio.to_thread(tuya_client._get_api)
        report["tuya_connect"] = "ok" if api is not None else "FAILED — check credentials or endpoint"
    except Exception as e:
        report["tuya_connect"] = f"EXCEPTION: {e}"

    # Step 4: send the command and capture the raw Tuya response
    if action in ("on", "off"):
        turn_on = action == "on"
        report["valve_command_sent"] = turn_on
        try:
            def _raw_command():
                api = tuya_client._get_api()
                if api is None:
                    return None, "API not connected"
                device_id   = irr.get("tuya_device_id", "")
                switch_code = irr.get("switch_code", "switch")
                resp = api.post(
                    f"/v1.0/devices/{device_id}/commands",
                    {"commands": [{"code": switch_code, "value": turn_on}]},
                )
                return resp, None

            resp, err = await asyncio.to_thread(_raw_command)
            if err:
                report["valve_command_result"] = f"FAILED: {err}"
            else:
                report["tuya_raw_response"] = resp
                report["valve_command_result"] = "SUCCESS" if resp.get("success") else "FAILED"
        except Exception as e:
            report["valve_command_result"] = f"EXCEPTION: {e}"

    return report
