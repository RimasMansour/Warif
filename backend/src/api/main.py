# backend/src/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
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
app.include_router(ml.router,              prefix="/api/v1/ml",              tags=["ML"])
app.include_router(config.router,          prefix="/api/v1/config",          tags=["Config"])

# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "warif-api", "version": "1.0.0"}
