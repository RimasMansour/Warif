# وارف | Warif
### AI-Toward Digital Twin for Smart Farms

[![CI](https://github.com/RimasMansour/Warif/actions/workflows/ci.yml/badge.svg)](https://github.com/RimasMansour/Warif/actions)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Railway](https://img.shields.io/badge/Deploy-Railway-blueviolet)

> Warif is an AI-powered Digital Twin platform for smart greenhouse management. It provides real-time environmental monitoring, ML-based irrigation prediction, automated decision support, and an interactive dashboard — built as a Final Year Project at Umm Al-Qura University, KSA.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [ML Models](#ml-models)
- [Team](#team)

---

## Overview

Water scarcity is a critical challenge in Saudi Arabia. Warif addresses this by creating a Digital Twin for greenhouse farms — a real-time virtual replica that monitors environmental conditions, predicts irrigation needs using machine learning, and provides actionable recommendations to farmers.

The system integrates IoT sensors, a FastAPI backend, an ensemble ML pipeline, and a bilingual (Arabic/English) React dashboard.

---

## Features

- Real-time monitoring of soil moisture, soil temperature, air temperature, and air humidity via IoT sensors
- ML-based irrigation prediction using a weighted ensemble of Random Forest, LSTM, and XGBoost
- Anomaly detection using SVM and kNN classifiers
- Automated decision engine with safety rules and configurable thresholds
- Recommendation system generating actionable insights per sensor category
- Bilingual dashboard supporting Arabic and English
- Farm and device registration workflow
- Manual, automatic, and scheduled irrigation control
- JWT-based authentication and role-based access
- AI-powered conversational assistant (chatbot) for farmer support
- Camera integration for live farm monitoring

---

## System Architecture

The Warif system is structured around three layers:

Physical Layer — IoT sensors collect soil and air data and publish via MQTT.

Processing Layer — FastAPI backend receives sensor data, runs ML inference through the ensemble pipeline, evaluates the decision engine, and generates recommendations.

Presentation Layer — React dashboard displays real-time readings, irrigation status, recommendations, and supports farm management workflows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.11) |
| Database | PostgreSQL + TimescaleDB |
| ORM | SQLAlchemy 2.0 (async) |
| Authentication | JWT + bcrypt |
| ML Pipeline | scikit-learn, XGBoost, Prophet, LSTM (Keras) |
| IoT Protocol | MQTT (Eclipse Mosquitto) |
| Frontend | React 19 + Vite + Tailwind CSS |
| Deployment | Railway |
| CI/CD | GitHub Actions |

---

## Project Structure
Warif/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/        # auth, farms, sensors, irrigation,
│   │   │   │                  # recommendations, dashboard, ml, alerts
│   │   │   └── schemas/       # Pydantic request/response models
│   │   ├── core/              # config, security (JWT + bcrypt)
│   │   ├── db/
│   │   │   ├── models/        # SQLAlchemy ORM models
│   │   │   └── session.py     # async DB session
│   │   ├── ml/
│   │   │   ├── random_forest.py
│   │   │   ├── lstm_model.py
│   │   │   ├── xgboost_model.py
│   │   │   ├── ensemble.py
│   │   │   ├── anomaly_svm.py
│   │   │   ├── anomaly_knn.py
│   │   │   └── trainers/      # training + validation scripts
│   │   ├── mqtt/              # MQTT client for sensor ingestion
│   │   └── services/
│   │       ├── decision_engine.py
│   │       └── recommendation_service.py
│   ├── scripts/
│   │   ├── setup_db.py        # create all tables
│   │   ├── seed_data.py       # populate sample data
│   │   └── device_simulator.py # simulate IoT sensors via MQTT
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                  # React 19 + Vite (bilingual AR/EN)
├── infrastructure/
│   └── docker/
│       └── mosquitto.conf     # MQTT broker configuration
├── data/
│   └── prepare_data.py        # ML dataset preparation pipeline
├── .github/
│   └── workflows/
│       └── ci.yml             # lint, test, build on every PR
├── railway.json               # Railway deployment configuration
└── README.md

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/setup_db.py
python scripts/seed_data.py
uvicorn src.api.main:app --reload --port 8000
```

### Simulate IoT Sensors

```bash
cd backend
python scripts/device_simulator.py
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## API Documentation

Interactive API docs available at `http://localhost:8000/docs`

| Group | Method | Endpoint |
|---|---|---|
| Auth | POST | /api/v1/auth/login |
| Auth | POST | /api/v1/auth/register |
| Auth | GET | /api/v1/auth/me |
| Farms | POST | /api/v1/farms |
| Farms | GET | /api/v1/farms |
| Farms | POST | /api/v1/farms/{id}/devices |
| Sensors | GET | /api/v1/sensors/latest |
| Irrigation | GET | /api/v1/irrigation/status/{farm_id} |
| Irrigation | POST | /api/v1/irrigation/manual |
| Irrigation | POST | /api/v1/irrigation/schedule |
| Irrigation | POST | /api/v1/irrigation/stop/{device_id} |
| Recommendations | GET | /api/v1/recommendations/{farm_id} |
| Dashboard | GET | /api/v1/dashboard/{farm_id} |
| ML | GET | /api/v1/ml/predictions/yield |
| Alerts | GET | /api/v1/alerts |
| Health | GET | /health |

---

## ML Models

The irrigation prediction pipeline uses a weighted ensemble strategy:

| Model | Role | Strengths |
|---|---|---|
| Random Forest | Baseline prediction | Handles non-linear relationships, interpretable |
| LSTM | Temporal modelling | Captures time-series dependencies |
| XGBoost | High-accuracy regression | Strong regularisation, fast convergence |
| SVM (RBF) | Anomaly detection | Detects sensor faults and stress conditions |
| kNN | Edge anomaly detection | Low-latency real-time monitoring |

Models are evaluated using MAE, RMSE, R2, and MAPE metrics.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| main | Stable, production-ready |
| dev | Integration — merge features here first |
| feature/* | New features |
| fix/* | Bug fixes |

Workflow: feature/xyz → PR into dev → reviewed → merged → PR dev into main

---

## Team

This project was developed by:

| Name | Role |
|---|---|
| Ayah Badr Fallatah | ML Pipeline |
| Ghala Sami Alhajjaji | Backend API |
| Yara Ismail Alsiamy | Frontend |
| Rimas Mansour Alzahrani | Frontend |

Department of Computer Science and Artificial Intelligence
Faculty of Computing — Umm Al-Qura University, KSA
Final Year Project — 2025/2026

---
