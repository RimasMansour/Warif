# Contributing to Warif

Thanks for working on this project! Here's everything you need to know to contribute cleanly.

---

## Getting started

```bash
git clone https://github.com/your-org/Warif.git
cd Warif
bash scripts/setup.sh   # sets up Python venv, Node packages, and .env files
bash scripts/dev.sh     # starts all services locally
```

---

## Branch strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `dev` | Integration — open PRs here |
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
cd backend && pytest tests/unit
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

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Scopes: `backend`, `frontend`, `ml`, `mqtt`, `db`, `infra`, `docs`

Examples:
- `feat(ml): add Prophet growth trajectory endpoint`
- `fix(frontend): correct alert badge count on navbar`
- `chore(ci): pin Node version to 20 in CI workflow`

---

## Backend conventions

- All new endpoints go in `backend/src/api/routes/`
- Use Pydantic schemas from `backend/src/api/schemas/schemas.py` for request/response models
- Business logic lives in `backend/src/services/` — keep routes thin
- All DB queries use async SQLAlchemy via `get_db` dependency
- Add at least one unit test in `backend/tests/unit/` for new logic

Run tests:
```bash
cd backend
source .venv/bin/activate
pytest tests/unit -v
```

---

## Frontend conventions

- Components go in `src/components/<category>/`
- Pages go in `src/pages/`
- All API calls go through `src/services/api.js` — never call `fetch` / `axios` directly in components
- Use `src/hooks/` for data-fetching logic
- Use the `cn()` utility from `src/utils/` for conditional Tailwind classes

---

## Code review

- At least one teammate must review and approve before merging
- The CI pipeline (lint + tests + build) must pass
- Keep PRs focused — one feature or fix per PR
