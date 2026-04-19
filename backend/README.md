# Warif — Backend

Python backend for the Warif smart greenhouse system. Built with **FastAPI**, **PostgreSQL + TimescaleDB**, **MQTT**, and **ML models** for yield prediction and anomaly detection.

## Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── routes/           # One file per resource (sensors, alerts, trays, ml, …)
│   │   ├── middleware/       # Auth (JWT), CORS, request logging
│   │   └── schemas/          # Pydantic models for request/response validation
│   ├── core/
│   │   ├── config.py         # Settings loaded from .env via pydantic-settings
│   │   ├── security.py       # JWT helpers, password hashing
│   │   └── logging.py        # Structured logger setup
│   ├── db/
│   │   ├── session.py        # SQLAlchemy engine + session factory
│   │   ├── models/           # ORM table definitions
│   │   └── migrations/       # Alembic migration files
│   ├── ml/
│   │   ├── models/           # Saved model artifacts (.pkl, .joblib) — gitignored
│   │   ├── trainers/         # Training scripts (run manually or via scheduler)
│   │   └── utils/            # Feature engineering, preprocessing
│   ├── mqtt/
│   │   └── client.py         # Paho-MQTT subscription + message handlers
│   ├── services/             # Business logic (alert engine, sensor service, …)
│   └── workers/              # Background tasks (alert checker, ML retraining, …)
├── dashboard/
│   └── app.py                # Streamlit monitoring dashboard
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── setup_db.py           # Create DB schema
│   ├── seed_data.py          # Populate with sample sensor readings
│   └── device_simulator.py   # Simulate IoT device MQTT messages
├── .env.example
├── Dockerfile
└── requirements.txt
```

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/setup_db.py
uvicorn src.api.main:app --reload --port 8010
```

## Running Tests

```bash
pytest tests/unit
pytest tests/integration
```

## API Docs

Available at http://localhost:8010/docs (Swagger UI) when the server is running.
