"""
Tuya → Warif Bridge
Polls real sensors from Tuya every 30 seconds and pushes readings
to the Warif backend API so they appear on the dashboard.

Run AFTER tuya_setup.py (devices must be registered first).

Usage (from the backend/ folder):
    python scripts/tuya_bridge.py
"""
import os
import sys
import json
import time
import logging
from pathlib import Path

import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))
load_dotenv(".env.shared")
load_dotenv(".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tuya_bridge")

WARIF_API     = os.getenv("WARIF_API_URL", "http://localhost:8000")
POLL_INTERVAL = int(os.getenv("TUYA_POLL_INTERVAL", "30"))
CONFIG_FILE   = Path(__file__).parent.parent / "tuya_devices.json"


# ── Tuya API helpers ──────────────────────────────────────────────────────────

def _get_tuya_api():
    try:
        from tuya_connector import TuyaOpenAPI
    except ImportError:
        log.error("Run: pip install tuya-connector-python")
        sys.exit(1)

    access_id     = os.getenv("TUYA_ACCESS_ID", "")
    access_secret = os.getenv("TUYA_ACCESS_SECRET", "")
    endpoint      = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaeu.com")

    if not access_id or not access_secret:
        log.error("TUYA_ACCESS_ID and TUYA_ACCESS_SECRET must be set in .env.shared")
        sys.exit(1)

    api = TuyaOpenAPI(endpoint, access_id, access_secret)
    result = api.connect()
    if not result.get("success"):
        log.error(f"Tuya connection failed: {result}")
        sys.exit(1)

    log.info(f"Connected to Tuya API: {endpoint}")
    return api


def _fetch_device_status(api, tuya_id: str, poll_api: str) -> dict:
    """Return {code: value} for a device. Empty dict on failure."""
    if poll_api == "v2.0":
        resp = api.get(f"/v2.0/cloud/thing/{tuya_id}/shadow/properties")
    else:
        resp = api.get(f"/v1.0/devices/{tuya_id}/status")

    if not resp.get("success"):
        return {}

    raw = resp.get("result", [])
    if isinstance(raw, list):
        return {item["code"]: item["value"] for item in raw}
    if isinstance(raw, dict):
        props = raw.get("properties", raw)
        if isinstance(props, list):
            return {item["code"]: item["value"] for item in props}
        return props
    return {}


# ── Warif API helper ──────────────────────────────────────────────────────────

def _push_reading(warif_device_id: str, sensor_type: str, value: float, unit: str):
    try:
        resp = requests.post(
            f"{WARIF_API}/api/v1/sensors",
            json={"device_id": warif_device_id, "sensor_type": sensor_type,
                  "value": value, "unit": unit},
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            log.warning(f"Push failed [{sensor_type}]: {resp.status_code}")
    except requests.RequestException as e:
        log.warning(f"Push error [{sensor_type}]: {e}")


# ── Poll loop ─────────────────────────────────────────────────────────────────

def poll_once(api, config: dict):
    for dev in config.get("sensor_devices", []):
        label          = dev["label"]
        tuya_id        = dev["tuya_device_id"]
        warif_id       = dev["warif_device_id"]
        poll_api       = dev.get("poll_api", "v1.0")
        skip_if_offline = dev.get("skip_if_offline", False)

        status = _fetch_device_status(api, tuya_id, poll_api)

        if not status:
            if not skip_if_offline:
                log.warning(f"{label}: no data returned from Tuya")
            else:
                log.debug(f"{label}: offline — skipping")
            continue

        pushed = 0
        for code, mapping in dev["properties"].items():
            if code not in status:
                continue
            raw   = status[code]
            value = round(float(raw) * mapping["scale"], 3)
            _push_reading(warif_id, mapping["sensor_type"], value, mapping["unit"])
            pushed += 1

        if pushed:
            log.info(f"{label}: pushed {pushed} reading(s)")


def run():
    config = json.loads(CONFIG_FILE.read_text())
    api    = _get_tuya_api()

    log.info(f"Bridge running — polling every {POLL_INTERVAL}s → {WARIF_API}")
    log.info("Press Ctrl+C to stop\n")

    while True:
        try:
            poll_once(api, config)
        except Exception as e:
            log.error(f"Poll cycle error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
