# Contributing to Warif

This guide covers everything you need to work on the Warif codebase — local setup, conventions, testing, and the PR workflow.

---

## Project Overview

Warif is a smart greenhouse management platform with two services:

| Service | Tech | Entry Point |
|---|---|---|
| Backend API | Python 3.11 + FastAPI + PostgreSQL | `backend/src/api/main.py` |
| Frontend | React 19 + Vite + Tailwind CSS | `frontend/src/main.jsx` |

**Deployment:** Railway (NIXPACKS — no Docker needed)  
**Database:** Railway PostgreSQL (credentials in `backend/.env`)  
**Real hardware:** Farm 22 via Tuya IoT  
**Simulated farm:** Farm 20 via physics engine (runs as a background task on startup)

---

## Local Setup

### 1. Clone the Repository

```bash
git clone https://github.com/RimasMansour/Warif.git
cd Warif
```

### 2. Backend

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Fill in real values — DB credentials, Tuya keys, Groq API key
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000
```

---

## Running Locally

Start each in a separate terminal:

```bash
# Terminal 1 — Backend API
cd backend
source .venv/bin/activate      # or .venv\Scripts\activate on Windows
uvicorn src.api.main:app --reload --port 8000
```

```bash
# Terminal 2 — Frontend dev server
cd frontend
npm run dev
```

> The **physics engine simulator** (Farm 20) and the **Tuya bridge** (Farm 22) start automatically as background async tasks when the API boots. You do not need to run them separately.

API docs: `http://localhost:8000/docs`  
Frontend: `http://localhost:5173`

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main-merge` | Primary working branch — all development and deployment runs from here |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, CI, documentation |

**All work targets `main-merge`.** Never push directly to it — always go through a pull request.

---

## Making a Change

```bash
# 1. Branch off main-merge (your deployment branch)
git checkout main-merge
git pull
git checkout -b feature/my-feature

# 2. Make your changes

# 3. Test locally (see Testing section below)

# 4. Commit with a clear message (see Commit Convention below)
git commit -m "feat(sensors): add CO2 chart to dashboard"

# 5. Push and open a PR into main-merge
git push -u origin feature/my-feature
```

---

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

**Scopes:** `backend`, `frontend`, `ml`, `chatbot`, `db`, `sensors`, `irrigation`, `tuya`, `ci`, `docs`

**Examples:**

```
feat(ml): add Prophet growth trajectory endpoint
fix(frontend): correct alert badge count on navbar
feat(irrigation): add auto-stop when soil is saturated
chore(ci): pin Node version to 20 in CI workflow
fix(tuya): handle offline device gracefully
docs(readme): update environment variables table
```

---

## Testing

### Backend

Tests live in `backend/tests/unit/`. Each new piece of business logic must have at least one unit test.

```bash
cd backend
source .venv/bin/activate
pytest tests/unit -v
```

Tests use `asyncio_mode = auto` — async test functions work without any extra decorators.

### Frontend

There is no frontend test suite yet. Run lint and a production build to catch errors:

```bash
cd frontend
npm run lint
npm run build
```

---

## Linting

### Backend — Ruff

```bash
cd backend
pip install ruff
ruff check src tests
```

### Frontend — ESLint

```bash
cd frontend
npm run lint
```

Both lint checks run automatically in CI on every push and PR. A failing lint blocks the merge.

---

## Backend Conventions

### Structure

```
backend/src/
├── api/
│   ├── main.py          ← FastAPI app; all routers registered here
│   ├── routes/          ← one file per feature (auth, farms, sensors,
│   │                       irrigation, recommendations, dashboard,
│   │                       alerts, commands, ml, config, logs)
│   └── schemas/         ← Pydantic request/response models
├── services/            ← business logic (decision_engine, tuya_client,
│                           recommendation_service, connectivity_monitor, ...)
├── db/
│   └── models/models.py ← all SQLAlchemy ORM models
├── ml/                  ← anomaly detection, continual learning, feedback
│   └── models/          ← serialised .pkl / .keras model files
├── chatbot/             ← RAG pipeline (ChromaDB + Groq) — currently disabled
└── core/config.py       ← pydantic-settings configuration
```

### Rules

- All new endpoints go in `backend/src/api/routes/` and must be registered in `main.py`
- Use Pydantic schemas from `backend/src/api/schemas/schemas.py` for all request/response models
- Business logic goes in `backend/src/services/` — keep route handlers thin
- All DB queries use async SQLAlchemy via the `get_db` dependency
- All endpoints (except `/health`, `/auth/register`, `/auth/login`) require JWT via `get_current_user`
- Add at least one unit test in `backend/tests/unit/` for any new logic

---

## Frontend Conventions

### Structure

```
frontend/src/
├── pages/
│   ├── auth/            ← SignIn, ResetPassword
│   └── dashboard/       ← Dashboard, DashboardHome, IrrigationPage,
│                           SensorPages, DecisionSupportPage,
│                           AccountAndSettings, DashboardCharts
├── services/api.js      ← all API call functions
├── hooks/useWarifData.js← data fetching and state for the dashboard
├── config/api.js        ← HTTP client (retry, timeout, auth headers, auto-logout)
├── i18n.js              ← all Arabic / English translation strings
├── App.jsx              ← route definitions
└── main.jsx             ← app entry point
```

### Rules

- All API calls go through `src/services/api.js` using `fetchWithRetry` from `src/config/api.js` — never call `fetch` directly inside a component
- All UI strings go in `src/i18n.js` — never hardcode Arabic or English text in components; use `t(lang, 'key')`
- Data-fetching logic goes in `src/hooks/` — keep components focused on rendering
- New pages go in `src/pages/<category>/`

---

## Environment Files

| File | Committed | Purpose |
|---|---|---|
| `backend/.env.example` | Yes | Template — all required keys with placeholder values |
| `backend/.env` | No | Your real credentials — never commit |
| `frontend/.env.example` | Yes | Template for frontend vars |
| `frontend/.env.local` | No | Your local frontend vars — never commit |

---

## CI Pipeline

Every push and PR runs automatically via GitHub Actions (`.github/workflows/ci.yml`):

- **Backend:** install dependencies → `ruff` lint → `pytest tests/unit`
- **Frontend:** install dependencies → `eslint` lint → `vite build`

Both must pass before a PR can be merged.

---

## Code Review

- At least one teammate must review and approve before merging
- The full CI pipeline (lint + tests + build) must pass
- Keep PRs focused — one feature or fix per PR
- All PRs target `main-merge` — the deployment branch
