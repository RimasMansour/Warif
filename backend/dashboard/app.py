"""
dashboard/app.py
----------------
Standalone FastAPI sub-application that serves only the dashboard route.
Can be run independently:

    uvicorn dashboard.app:app --port 8001

Or mounted inside the main app (backend/src/api/main.py):

    from dashboard.app import app as dashboard_app
    main_app.mount("/dashboard", dashboard_app)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.dashboard import router as dashboard_router
from src.core.config import settings

app = FastAPI(
    title="Warif Dashboard API",
    description="Farm monitoring dashboard — sensor readings, irrigation status, recommendations",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["Authorization"],
)

app.include_router(dashboard_router, prefix="/farms", tags=["dashboard"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "dashboard"}
