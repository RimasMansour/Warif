# backend/src/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.api.routes import sensors, alerts, trays, commands, ml, config, auth

app = FastAPI(
    title="Warif API",
    description="Smart Greenhouse Management System — Backend API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────
app.include_router(auth.router,     prefix="/api/v1/auth",    tags=["Auth"])
app.include_router(sensors.router,  prefix="/api/v1/sensors", tags=["Sensors"])
app.include_router(alerts.router,   prefix="/api/v1/alerts",  tags=["Alerts"])
app.include_router(trays.router,    prefix="/api/v1/trays",   tags=["Trays"])
app.include_router(commands.router, prefix="/api/v1/commands",tags=["Commands"])
app.include_router(ml.router,       prefix="/api/v1/ml",      tags=["ML"])
app.include_router(config.router,   prefix="/api/v1/config",  tags=["Config"])


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api"}
