# 🌱 Warif — Smart Greenhouse Management System

A full-stack IoT-based smart greenhouse management platform. This is a **monorepo** that contains the backend API + ML engine and the React frontend in one unified repository.

> ⚠️ This project is actively in development. Not all features are complete.

---

## 📁 Repository Structure

```
Warif/
├── backend/                  # Python backend (FastAPI + ML + MQTT)
│   ├── src/
│   │   ├── api/              # FastAPI app
│   │   │   ├── routes/       # Endpoint routers
│   │   │   ├── middleware/   # Auth, logging, CORS
│   │   │   └── schemas/      # Pydantic request/response models
│   │   ├── core/             # Config, security, logging
│   │   ├── db/
│   │   │   ├── models/       # SQLAlchemy ORM models
│   │   │   └── migrations/   # Alembic migrations
│   │   ├── ml/
│   │   │   ├── models/       # Trained model artifacts
│   │   │   ├── trainers/     # Training scripts
│   │   │   └── utils/        # Preprocessing helpers
│   │   ├── mqtt/             # MQTT broker integration
│   │   ├── services/         # Business logic layer
│   │   └── workers/          # Background tasks (Celery / APScheduler)
│   ├── dashboard/            # Streamlit monitoring dashboard
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── scripts/              # DB setup, data seeding, utils
│   ├── .env.example
│   ├── Dockerfile
│   ├── requirements.txt
│   └── README.md
│
├── frontend/                 # React 19 + Vite + Tailwind app
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Base UI components (buttons, inputs…)
│   │   │   ├── layout/       # Sidebar, navbar, page shells
│   │   │   ├── charts/       # Data visualization components
│   │   │   ├── sensors/      # Sensor card, reading widgets
│   │   │   └── alerts/       # Alert banners and lists
│   │   ├── pages/            # Route-level page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client calls (axios / fetch)
│   │   ├── store/            # Global state (Zustand / Context)
│   │   ├── utils/            # Formatters, helpers
│   │   └── types/            # TypeScript interfaces
│   ├── public/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── infrastructure/           # Deployment & DevOps
│   ├── docker/               # Per-service Dockerfiles (if split)
│   ├── nginx/                # Reverse proxy config
│   └── monitoring/
│       ├── prometheus/       # Scrape configs
│       └── grafana/          # Dashboard JSONs
│
├── docs/                     # Project-wide documentation
├── scripts/                  # Root-level dev scripts (start all, etc.)
├── .github/
│   ├── workflows/            # CI/CD pipelines
│   └── ISSUE_TEMPLATE/
├── docker-compose.yml        # Local development stack
├── docker-compose.prod.yml   # Production stack
├── .env.example              # Root env template
├── .gitignore
└── README.md                 ← you are here
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Python 3.10+
- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 14+ (if running without Docker)

### Option A — Docker (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/Warif.git
cd Warif

# 2. Set up environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start everything
docker compose up
```

Services will be available at:
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8010 |
| API Docs | http://localhost:8010/docs |
| Streamlit Dashboard | http://localhost:8501 |
| Grafana | http://localhost:3000 |

### Option B — Manual

```bash
# --- Backend ---
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in your DB creds
python scripts/setup_db.py  # create tables
python scripts/seed_data.py # optional sample data
uvicorn src.api.main:app --reload --port 8010

# --- Frontend (new terminal) ---
cd frontend
npm install
cp .env.example .env        # set VITE_API_URL
npm run dev
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend API | FastAPI (Python) |
| Database | PostgreSQL + TimescaleDB |
| ML/AI | scikit-learn, XGBoost, Prophet |
| IoT Protocol | MQTT (Eclipse Mosquitto) |
| Monitoring | Prometheus + Grafana |
| Streamlit Dashboard | Streamlit |
| Containerisation | Docker + Docker Compose |

---

## 🌿 Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, deployable code |
| `dev` | Integration branch — merge features here first |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Tooling, docs, CI |

**Workflow:** `feature/xyz` → PR into `dev` → reviewed → merged → PR `dev` into `main` for releases.

---

## 🤝 Contributing

1. Branch off from `dev` → `feature/your-feature`
2. Make your changes
3. Open a PR targeting `dev`
4. Request review from a teammate
5. Merge after approval

---

## 📄 License

MIT
