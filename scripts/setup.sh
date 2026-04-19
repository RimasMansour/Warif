#!/usr/bin/env bash
# scripts/setup.sh
# One-time local environment setup for new contributors.
# Run from repo root:  bash scripts/setup.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "🌱 Warif — First-time setup"
echo "──────────────────────────────────────"

# ── Backend Python env ────────────────────────
echo ""
echo "[1/4] Setting up Python virtual environment…"
cd "$ROOT/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "      ✅ Python env ready"

# ── Copy .env files ───────────────────────────
echo ""
echo "[2/4] Copying .env example files…"
cd "$ROOT"
[ -f .env ]         || cp .env.example .env         && echo "      Created root .env"
cd "$ROOT/backend"
[ -f .env ]         || cp .env.example .env         && echo "      Created backend/.env"
cd "$ROOT/frontend"
[ -f .env ]         || cp .env.example .env         && echo "      Created frontend/.env"
echo "      ✅ .env files ready — fill in your credentials before running"

# ── Frontend Node packages ────────────────────
echo ""
echo "[3/4] Installing frontend Node packages…"
cd "$ROOT/frontend"
npm install -q
echo "      ✅ Node packages installed"

# ── DB setup (optional) ───────────────────────
echo ""
echo "[4/4] Database setup (optional — skip if using Docker)…"
read -p "      Run DB setup now? [y/N] " yn
if [[ "$yn" =~ ^[Yy]$ ]]; then
  cd "$ROOT/backend"
  source .venv/bin/activate
  python scripts/setup_db.py
  read -p "      Seed sample data? [y/N] " yn2
  [[ "$yn2" =~ ^[Yy]$ ]] && python scripts/seed_data.py
fi

echo ""
echo "──────────────────────────────────────"
echo "✅ Setup complete!"
echo ""
echo "Start the full stack:"
echo "  bash scripts/dev.sh"
echo ""
echo "Or with Docker:"
echo "  docker compose up"
echo ""
