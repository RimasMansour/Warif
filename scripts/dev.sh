#!/usr/bin/env bash
# scripts/dev.sh
# Starts the full local dev stack without Docker.
# Requires: Python venv already set up, Node packages installed, PostgreSQL running.
#
# Usage:  bash scripts/dev.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "🌱 Warif — Starting local dev stack"
echo "────────────────────────────────────"

# ── Backend ───────────────────────────────────
echo "▶  Starting FastAPI backend on :8010 …"
(
  cd "$BACKEND"
  source .venv/bin/activate 2>/dev/null || true
  uvicorn src.api.main:app --host 0.0.0.0 --port 8010 --reload
) &
BACKEND_PID=$!

# ── Streamlit dashboard ───────────────────────
echo "▶  Starting Streamlit dashboard on :8501 …"
(
  cd "$BACKEND"
  source .venv/bin/activate 2>/dev/null || true
  streamlit run dashboard/app.py --server.port 8501 --server.address 0.0.0.0
) &
DASHBOARD_PID=$!

# ── Frontend ──────────────────────────────────
echo "▶  Starting React frontend on :5173 …"
(
  cd "$FRONTEND"
  npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "✅ All services started:"
echo "   Frontend  →  http://localhost:5173"
echo "   API       →  http://localhost:8010"
echo "   API Docs  →  http://localhost:8010/docs"
echo "   Dashboard →  http://localhost:8501"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

# Wait and clean up on exit
trap "kill $BACKEND_PID $DASHBOARD_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '🛑 All services stopped.'" EXIT
wait
