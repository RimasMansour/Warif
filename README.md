# وارف | Warif
### AI-Toward Digital Twin for Smart Farms

[![CI](https://github.com/RimasMansour/Warif/actions/workflows/ci.yml/badge.svg)](https://github.com/RimasMansour/Warif/actions)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791)
![Deploy](https://img.shields.io/badge/Deploy-Railway-blueviolet)

> Warif is an AI-powered Digital Twin platform for smart greenhouse management. It provides real-time environmental monitoring, ML-based irrigation prediction, automated decision support, and an interactive bilingual dashboard. Built as a Final Year Project at the Faculty of Computing, Umm Al-Qura University, KSA.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [ML Models & Performance](#ml-models--performance)
- [IoT Integration](#iot-integration)
- [Chatbot](#chatbot)
- [Branch Strategy](#branch-strategy)
- [Contributing](#contributing)
- [Team](#team)

---

## Overview

Water scarcity is a critical challenge in Saudi Arabia. Warif addresses this by creating a Digital Twin for greenhouse farms — a real-time virtual replica that monitors environmental conditions, predicts irrigation needs using machine learning, and provides actionable recommendations to farmers.

The system integrates two farm modes:

- **Farm 22** — real greenhouse hardware connected via the Tuya IoT platform
- **Farm 20** — a physics engine simulator that replicates realistic soil and climate dynamics for development and testing

The ML pipeline has been validated to reduce water usage by **29.81%** compared to a naive timer-based scheduling baseline.

---

## Features

| Category | Capability |
|---|---|
| Monitoring | Real-time soil moisture, soil temperature, air temperature, and air humidity via IoT sensors |
| ML Prediction | Weighted ensemble (Random Forest + LSTM + XGBoost) for irrigation need prediction |
| Anomaly Detection | KNN and Isolation Forest classifiers to detect sensor faults and stress conditions |
| Decision Engine | Rule-based safety evaluation with configurable thresholds per farm |
| Recommendations | Per-sensor actionable insights generated after each reading cycle |
| Dashboard | Bilingual (Arabic / English) React dashboard with charts and real-time status |
| Farm Management | Farm and device registration, multi-farm support |
| Irrigation Control | Manual, automatic, and scheduled irrigation with Tuya actuator integration |
| Authentication | JWT-based auth with bcrypt password hashing and role-based access control |
| Chatbot | RAG-based conversational assistant (ChromaDB + Groq) with Arabic language support |
| Monitoring Loops | Background connectivity monitoring, ML feedback accuracy tracking every 60 s |
| Observability | Prometheus metrics, structured logging via structlog |

---

## System Architecture

The Warif system is organised into three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Presentation Layer                                             │
│  React 19 + Vite + Tailwind CSS  ·  Bilingual (AR / EN)        │
│  Dashboard · Irrigation · Sensors · Decision Support · Chatbot  │
└─────────────────────┬───────────────────────────────────────────┘
                      │  REST API (HTTP/JSON)
┌─────────────────────▼───────────────────────────────────────────┐
│  Processing Layer                                               │
│  FastAPI (Python 3.11)                                          │
│  ├── API Routes (auth, farms, sensors, irrigation, ...)         │
│  ├── ML Ensemble Pipeline (RF + LSTM + XGBoost)                 │
│  ├── Anomaly Detection (KNN + Isolation Forest)                 │
│  ├── Decision Engine + Recommendation Service                   │
│  ├── Background Tasks (connectivity, ML monitoring, Tuya bridge)│
│  └── Chatbot RAG Pipeline (ChromaDB + Groq)                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│  Physical Layer                                                 │
│  Farm 22 → Tuya IoT (real sensors + actuators)                  │
│  Farm 20 → Physics Engine Simulator (async background task)     │
└─────────────────────────────────────────────────────────────────┘
```

On startup the backend automatically launches four background async tasks:

1. **Physics simulation** — drives Farm 20's virtual sensor readings
2. **Tuya bridge** — polls Farm 22's real hardware via the Tuya OpenAPI
3. **Connectivity monitor** — checks device online/offline status every 60 s
4. **ML monitor** — evaluates recommendation feedback accuracy every 60 s and raises alerts when accuracy drops below 85%

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI 0.111 · Python 3.11 |
| Database | PostgreSQL 14+ |
| ORM | SQLAlchemy 2.0 (async) · Alembic migrations |
| Authentication | JWT (python-jose) · bcrypt (passlib) |
| Task Scheduling | APScheduler 3.10 |
| ML Pipeline | scikit-learn · XGBoost · Prophet · Keras (LSTM) · pandas · numpy |
| Anomaly Detection | scikit-learn (KNN, Isolation Forest) · joblib |
| IoT Integration | Tuya OpenAPI (tuya-connector-python) |
| Chatbot / RAG | Groq (Llama 3.1) · ChromaDB · sentence-transformers (CAMeL-Lab Arabic BERT) |
| Observability | Prometheus (prometheus-fastapi-instrumentator) · structlog |
| Frontend | React 19 · Vite · Tailwind CSS |
| HTTP Client | HTTPX |
| Deployment | Railway (NIXPACKS — no Docker required) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
Warif/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── main.py            # FastAPI app, all routers + startup tasks
│   │   │   ├── routes/            # auth, farms, sensors, irrigation,
│   │   │   │                      # recommendations, dashboard, alerts,
│   │   │   │                      # commands, ml, config, logs
│   │   │   └── schemas/           # Pydantic request/response models
│   │   ├── core/
│   │   │   └── config.py          # pydantic-settings, JWT, allowed origins
│   │   ├── db/
│   │   │   ├── models/models.py   # all SQLAlchemy ORM models
│   │   │   └── session.py         # async DB session + get_db dependency
│   │   ├── ml/
│   │   │   ├── anomaly_detector.py
│   │   │   ├── anomaly_isolation_forest.py
│   │   │   ├── anomaly_knn.py
│   │   │   ├── continual_learning.py
│   │   │   ├── feedback_integration.py
│   │   │   ├── train_models.py
│   │   │   ├── models/            # serialised .pkl / .keras model files
│   │   │   └── evaluation/        # metrics reports, predictions CSVs, plots
│   │   ├── services/
│   │   │   ├── decision_engine.py
│   │   │   ├── recommendation_service.py
│   │   │   ├── anomaly_alert_system.py
│   │   │   ├── connectivity_monitor.py
│   │   │   ├── risk_engine.py
│   │   │   ├── presentation_formatter.py
│   │   │   ├── tuya_client.py
│   │   │   └── tuya_bridge_service.py
│   │   └── chatbot/
│   │       ├── chatbot_api.py     # /api/v1/chatbot router
│   │       ├── rag_pipeline.py    # ChromaDB + Groq RAG pipeline
│   │       └── chroma_db_warif_arabic/  # vector store
│   ├── scripts/
│   │   ├── setup_db.py            # create all database tables
│   │   └── physics_engine_simulator.py  # simulate Farm 20 IoT sensors
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── tuya_devices.json          # Farm 22 actuator config (not committed)
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── railway.json               # Railway deployment config
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/              # SignIn, ResetPassword
│   │   │   └── dashboard/         # Dashboard, DashboardHome, IrrigationPage,
│   │   │                          # SensorPages, DecisionSupportPage,
│   │   │                          # AccountAndSettings, DashboardCharts
│   │   ├── services/api.js        # all API call functions
│   │   ├── hooks/useWarifData.js  # data fetching and state management
│   │   ├── config/api.js          # HTTP client (retry, timeout, auth, auto-logout)
│   │   ├── i18n.js                # all Arabic / English translation strings
│   │   ├── App.jsx                # route definitions
│   │   └── main.jsx               # app entry point
│   ├── package.json
│   └── vite.config.js
├── data/
│   └── prepare_data.py            # ML dataset preparation pipeline
├── CONTRIBUTING.md
├── railway.json
└── README.md
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| PostgreSQL | 14+ |

### 1. Clone the Repository

```bash
git clone https://github.com/RimasMansour/Warif.git
cd Warif
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and fill in all required values (see Environment Variables below)

# Create database tables
python scripts/setup_db.py

# Start the API server
uvicorn src.api.main:app --reload --port 8000
```

> **Note:** The physics engine simulator (Farm 20) and Tuya bridge (Farm 22) are started **automatically** as background tasks when the API server boots. You do not need to run them separately in production.

### 3. Frontend Setup

Open a second terminal:

```bash
cd frontend

npm install

cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000

npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### 4. Running Tests

```bash
# Backend unit tests
cd backend
pytest tests/unit -v

# Frontend lint and build check
cd frontend
npm run lint
npm run build
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `warif` |
| `DB_USER` | Database user | `warif_user` |
| `DB_PASSWORD` | Database password | `changeme` |
| `JWT_SECRET_KEY` | Long random secret for signing JWTs | `change-this-to-a-long-random-secret` |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token expiry duration in minutes | `60` |
| `TUYA_ACCESS_ID` | Tuya OpenAPI access ID | — |
| `TUYA_ACCESS_SECRET` | Tuya OpenAPI access secret | — |
| `TUYA_API_ENDPOINT` | Tuya regional endpoint | `https://openapi.tuyaeu.com` |
| `TUYA_POLL_INTERVAL` | Tuya polling interval in seconds | `30` |
| `GROQ_API_KEY` | Groq API key for the chatbot LLM | — |
| `CHROMA_DB_PATH` | Path to ChromaDB vector store | `./src/chatbot/chroma_db_warif_arabic` |
| `GROQ_MODEL` | Groq model ID | `llama-3.1-8b-instant` |
| `DEBUG` | Enable debug mode | `false` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |

> **Security:** Never commit `.env` or `.env.local` files. Only `.env.example` files are tracked in git.

---

## API Reference

Interactive API docs are available at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc` (ReDoc) when the backend is running.

### Endpoint Summary

| Group | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | GET | `/health` | Service health check |
| **Auth** | POST | `/api/v1/auth/register` | Register a new user |
| **Auth** | POST | `/api/v1/auth/login` | Obtain a JWT access token |
| **Auth** | GET | `/api/v1/auth/me` | Get current user profile |
| **Farms** | GET | `/api/v1/farms` | List all farms for the user |
| **Farms** | POST | `/api/v1/farms` | Create a new farm |
| **Farms** | POST | `/api/v1/farms/{id}/devices` | Register a device to a farm |
| **Sensors** | GET | `/api/v1/sensors/latest` | Get latest sensor readings |
| **Irrigation** | GET | `/api/v1/irrigation/status/{farm_id}` | Get irrigation status |
| **Irrigation** | POST | `/api/v1/irrigation/manual` | Trigger manual irrigation |
| **Irrigation** | POST | `/api/v1/irrigation/schedule` | Create a scheduled irrigation event |
| **Irrigation** | POST | `/api/v1/irrigation/stop/{device_id}` | Stop an active irrigation event |
| **Recommendations** | GET | `/api/v1/recommendations/{farm_id}` | Get current recommendations |
| **Dashboard** | GET | `/api/v1/dashboard/{farm_id}` | Get full dashboard data payload |
| **Alerts** | GET | `/api/v1/alerts` | List active alerts |
| **Commands** | POST | `/api/v1/commands` | Send actuator commands |
| **ML** | GET | `/api/v1/ml/predictions/yield` | Get ML yield predictions |
| **Config** | GET/PUT | `/api/v1/config` | Read or update farm thresholds |
| **Logs** | GET | `/api/v1/logs` | Retrieve audit logs |
| **Chatbot** | POST | `/api/v1/chatbot` | Send a message to the RAG assistant |

> All endpoints except `/health`, `/api/v1/auth/register`, and `/api/v1/auth/login` require a valid JWT in the `Authorization: Bearer <token>` header.

---

## ML Models & Performance

The irrigation prediction pipeline uses a **two-stage hybrid evaluation framework** across a weighted ensemble of three models.

### Stage 1 — Irrigation Classification

Predicts whether irrigation is needed at each time step.

| Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
|---|---|---|---|---|---|
| Random Forest | 0.9875 | 0.9857 | 0.9904 | 0.9881 | 0.9996 |
| XGBoost | 0.9900 | 0.9904 | 0.9904 | 0.9904 | 0.9997 |
| LSTM (Recurrent) | 0.9650 | 0.9535 | 0.9809 | 0.9670 | 0.9959 |
| **Weighted Ensemble (Warif)** | **0.9900** | **0.9904** | **0.9904** | **0.9904** | **0.9998** |

### Stage 2 — Resource Efficiency

Evaluates water volume optimisation using the soil water deficit formula:

```
V = Area × Root_Depth × (Field_Capacity − Current_Soil_Moisture)
```

| Metric | Value |
|---|---|
| Evaluation set size | 400 time-steps |
| Naive baseline water used | 2,000.00 L |
| Warif optimised water used | 1,403.82 L |
| **Water saved** | **596.18 L (29.81%)** |

### Anomaly Detection

| Model | Accuracy | Precision | Recall | F1-Score | False Alarm Rate | ROC-AUC |
|---|---|---|---|---|---|---|
| KNN | 0.9083 | 0.8451 | 1.0000 | 0.9160 | 0.1833 | 0.9583 |
| **Isolation Forest** | **0.9250** | **0.9527** | **0.8944** | **0.9226** | **0.0444** | **0.9892** |
| Rule-based Detector | 0.1333 | 1.0000 | 0.0250 | 0.0488 | 0.0000 | 0.5125 |

> The rule-based detector is evaluated on streaming scenarios. KNN and Isolation Forest are evaluated on a balanced validation set with intentionally injected anomalies.

### Model Roles

| Model | Role |
|---|---|
| Random Forest | Baseline prediction — handles non-linear feature relationships |
| LSTM | Temporal modelling — captures time-series dependencies across readings |
| XGBoost | High-accuracy regression — strong regularisation, fast convergence |
| KNN | Real-time anomaly detection — low latency, high recall |
| Isolation Forest | Robust anomaly detection — low false alarm rate |

All models are evaluated using MAE, RMSE, R², MAPE, F1-Score, and ROC-AUC. Serialised model files are stored in `backend/src/ml/models/`.

---

## IoT Integration

### Farm 22 — Real Hardware (Tuya)

Farm 22 uses physical sensors and actuators connected through the **Tuya IoT OpenAPI**. Device configuration is stored in `backend/tuya_devices.json` (excluded from version control). The Tuya bridge polls device state every `TUYA_POLL_INTERVAL` seconds and is started automatically as a background task.

### Farm 20 — Physics Engine Simulator

Farm 20 is driven by `backend/scripts/physics_engine_simulator.py`, which simulates realistic soil moisture dynamics, temperature fluctuations, and evapotranspiration. It runs as an async background task and publishes readings to the same database tables used by real sensors.

---

## Chatbot

The Warif chatbot is a **Retrieval-Augmented Generation (RAG)** assistant designed for Arabic-speaking farmers.

- **Vector store:** ChromaDB with an Arabic agricultural knowledge base
- **Embeddings:** CAMeL-Lab Arabic BERT (`CAMeL-Lab/bert-base-arabic-camelbert-mix`)
- **LLM:** Groq Llama 3.1 8B Instant
- **Endpoint:** `POST /api/v1/chatbot`

> The chatbot is currently disabled in production. To enable it, set `GROQ_API_KEY` in your `.env` file and ensure the ChromaDB vector store is populated.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable — never push directly |
| `dev` | Integration branch — all PRs target this branch |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, CI, documentation changes |

**Workflow:** `feature/xyz` → PR into `dev` → reviewed and CI passes → merged → PR `dev` into `main`

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide, including:

- Local setup instructions for all services
- Backend and frontend code conventions
- Commit message format (Conventional Commits)
- How to run tests and linting
- PR and code review requirements

---

## Team

This project was developed as a Final Year Project at the Department of Computer Science and Artificial Intelligence, Faculty of Computing — Umm Al-Qura University, KSA (2025/2026).

| Name |
|---|
| Ayah Badr Fallatah |
| Ghala Sami Alhajjaji |
| Yara Ismail Alsiamy |
| Rimas Mansour Alzahrani |

---
