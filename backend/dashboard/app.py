# backend/dashboard/app.py
"""
Warif — Streamlit Monitoring Dashboard
Run:  streamlit run dashboard/app.py --server.port 8501
"""
import sys
import os

# Allow imports from backend/src
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import httpx

API_BASE = os.getenv("VITE_API_URL", "http://localhost:8010")

st.set_page_config(
    page_title="Warif Dashboard",
    page_icon="🌱",
    layout="wide",
)

# ── Header ────────────────────────────────────────────────────────────────
st.title("🌱 Warif — Smart Greenhouse Monitor")
st.caption("Live sensor overview • Alerts • ML Predictions")

# ── Fetch latest readings ─────────────────────────────────────────────────
@st.cache_data(ttl=10)
def fetch_latest():
    try:
        r = httpx.get(f"{API_BASE}/api/v1/sensors/latest", timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        st.warning(f"Could not reach API: {e}")
        return []


@st.cache_data(ttl=10)
def fetch_alerts():
    try:
        r = httpx.get(f"{API_BASE}/api/v1/alerts?status=open&limit=20", timeout=5)
        r.raise_for_status()
        return r.json()
    except Exception:
        return []


readings = fetch_latest()
alerts   = fetch_alerts()

# ── Sensor metric cards ───────────────────────────────────────────────────
if readings:
    cols = st.columns(len(readings))
    for col, r in zip(cols, readings):
        delta_color = "normal" if r["status"] == "normal" else "inverse"
        col.metric(
            label=r["sensor_type"].replace("_", " ").title(),
            value=f"{r['value']} {r.get('unit', '')}",
            delta=r["status"],
            delta_color=delta_color,
        )
else:
    st.info("Waiting for sensor data…")

st.divider()

# ── Open alerts ───────────────────────────────────────────────────────────
st.subheader("Open Alerts")
if alerts:
    df = pd.DataFrame(alerts)[["severity", "sensor_type", "message", "created_at"]]
    df.columns = ["Severity", "Sensor", "Message", "Time"]
    st.dataframe(df, use_container_width=True, hide_index=True)
else:
    st.success("No open alerts 🎉")

st.divider()

# ── Sensor history placeholder ────────────────────────────────────────────
st.subheader("Sensor History")
st.info("Select a sensor type and date range to plot history. (TODO: wire to /api/v1/sensors)")

# Auto-refresh every 30 seconds
st.markdown(
    """<meta http-equiv="refresh" content="30">""",
    unsafe_allow_html=True,
)
