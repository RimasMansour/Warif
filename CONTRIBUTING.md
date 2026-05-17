# Contributing to Warif

Thanks for working on this project. Here's everything you need to know to contribute cleanly.

---

## Project overview

Warif is a smart greenhouse management system with two services:

| Service | Tech | Entry point |
|---|---|---|
| Backend API | Python 3.11 + FastAPI + PostgreSQL | `backend/src/api/main.py` |
| Frontend | React 19 + Vite + Tailwind CSS | `frontend/src/main.jsx` |

**Deployment:** Railway (NIXPACKS — no Docker needed)  
**Database:** Railway PostgreSQL (credentials in `backend/.env`)  
**Real hardware:** Farm 22 via Tuya IoT  
**Simulated farm:** Farm 20 via physics engine simulator

---

## Local setup

### 1. Clone the repo
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
# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Fill in real values in .env (DB credentials, Tuya keys, Groq API key)
```

### 3. Frontend
```bash
cd frontend
npm install

cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000
```

---

## Running locally

Start each in a separate terminal:

```bash
# Backend API
cd backend
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uvicorn src.api.main:app --reload --port 8000

# Frontend dev server
cd frontend
npm run dev

# Farm 20 physics simulator (separate process — keep running)
cd backend
python scripts/physics_engine_simulator.py

# Farm 22 Tuya sensor bridge (only if testing real hardware)
cd backend
python scripts/tuya_bridge.py
```

API docs available at: `http://localhost:8000/docs`

---

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `dev` | Integration — open all PRs here |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `chore/<name>` | Tooling, CI, docs |

**Never push directly to `main`.** Always go through `dev` via a pull request.

---

## Making a change

```bash
# 1. Branch off dev
git checkout dev
git pull
git checkout -b feature/my-feature

# 2. Make your changes

# 3. Test locally
cd backend && pytest tests/unit -v
cd frontend && npm run lint && npm run build

# 4. Commit with a clear message
git commit -m "feat(sensors): add CO2 chart to dashboard"

# 5. Push and open a PR into dev
git push -u origin feature/my-feature
```

---

## Commit message convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

**Scopes:** `backend`, `frontend`, `ml`, `chatbot`, `db`, `sensors`, `irrigation`, `tuya`, `ci`, `docs`

**Examples:**
- `feat(ml): add Prophet growth trajectory endpoint`
- `fix(frontend): correct alert badge count on navbar`
- `feat(irrigation): add auto-stop when soil saturated`
- `chore(ci): pin Node version to 22 in CI workflow`
- `fix(tuya): handle offline device gracefully`

---

## Backend conventions

**Structure:**
```
backend/src/
├── api/
│   ├── main.py          ← FastAPI app, all routers registered here
│   ├── routes/          ← one file per feature (sensors, farms, irrigation, ...)
│   └── schemas/         ← Pydantic request/response models
├── services/            ← business logic (decision_engine, tuya_client, ...)
├── db/
│   └── models/models.py ← all SQLAlchemy models
├── ml/                  ← anomaly detection, continual learning, feedback
├── chatbot/             ← RAG pipeline (ChromaDB + Groq) — currently disabled
└── ai/engine.py         ← autonomous validation loop
```

**Rules:**
- All new endpoints go in `backend/src/api/routes/` and must be registered in `main.py`
- Use Pydantic schemas from `backend/src/api/schemas/schemas.py` for request/response models
- Business logic lives in `backend/src/services/` — keep route handlers thin
- All DB queries use async SQLAlchemy via the `get_db` dependency
- All endpoints (except auth) require JWT via `get_current_user`
- Add at least one unit test in `backend/tests/unit/` for new logic

**Run tests:**
```bash
cd backend
source .venv/bin/activate
pytest tests/unit -v
```

**Lint:**
```bash
pip install ruff
ruff check src tests
```

---

## Frontend conventions

**Structure:**
```
frontend/src/
├── pages/
│   ├── auth/            ← SignIn, ResetPassword
│   └── dashboard/       ← Dashboard, DashboardHome, IrrigationPage, SensorPages, ...
├── services/api.js      ← all API call functions
├── hooks/useWarifData.js← data fetching and state for the dashboard
├── config/api.js        ← HTTP client (retry, timeout, auth headers, auto-logout)
├── i18n.js              ← all Arabic / English translations
├── App.jsx              ← routing
└── main.jsx             ← app entry point
```

**Rules:**
- All API calls go through `src/services/api.js` using `fetchWithRetry` from `src/config/api.js` — never call `fetch` directly in components
- All translations go in `src/i18n.js` — never hardcode Arabic or English strings in components, use `t(lang, 'key')`
- Data-fetching logic goes in `src/hooks/` — keep components focused on rendering
- Pages go in `src/pages/<category>/`

**Lint and build:**
```bash
cd frontend
npm run lint
npm run build
```

---

## Environment files

| File | Committed? | Purpose |
|---|---|---|
| `backend/.env.example` | Yes | Template — shows all required keys with fake values |
| `backend/.env` | No | Your real credentials — never commit |
| `frontend/.env.example` | Yes | Template for frontend vars |
| `frontend/.env.local` | No | Your local frontend vars — never commit |

---

## CI pipeline

Every push and PR runs automatically via GitHub Actions (`.github/workflows/ci.yml`):

- **Backend:** installs dependencies → `ruff` lint → `pytest tests/unit`
- **Frontend:** installs dependencies → `eslint` lint → `vite build`

Both must pass before a PR can be merged.

---

## Code review

- At least one teammate must review and approve before merging
- The CI pipeline (lint + tests + build) must pass
- Keep PRs focused — one feature or fix per PR
- PRs go into `dev`, not `main`
