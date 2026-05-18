"""
Tuya Bridge Service
===================
Polls real Tuya sensors every TUYA_POLL_INTERVAL seconds and pushes readings
to the Warif sensor ingestion endpoint so they appear on the dashboard.

Runs automatically as a background thread when the backend starts.
Can also be run standalone via scripts/tuya_bridge.py.

Requires in .env:
    TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, TUYA_API_ENDPOINT (optional)
"""
import os
import json
import time
import logging
from pathlib import Path

import requests

log = logging.getLogger("tuya_bridge")

_port = os.getenv("PORT", "8000")
WARIF_API = os.getenv("WARIF_API_URL", f"http://localhost:{_port}")
POLL_INTERVAL = int(os.getenv("TUYA_POLL_INTERVAL", "30"))
CONFIG_FILE   = Path(__file__).resolve().parents[2] / "tuya_devices.json"


# ── Tuya helpers ──────────────────────────────────────────────────────────────

def _get_tuya_api():
    try:
        from tuya_connector import TuyaOpenAPI
    except ImportError:
        raise RuntimeError("tuya-connector-python not installed. Run: pip install tuya-connector-python")

    access_id     = os.getenv("TUYA_ACCESS_ID", "")
    access_secret = os.getenv("TUYA_ACCESS_SECRET", "")
    endpoint      = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaeu.com")

    if not access_id or not access_secret:
        raise RuntimeError("TUYA_ACCESS_ID and TUYA_ACCESS_SECRET must be set in .env")

    api = TuyaOpenAPI(endpoint, access_id, access_secret)
    result = api.connect()
    if not result.get("success"):
        raise RuntimeError(f"Tuya connection failed: {result}")

    log.info(f"Connected to Tuya API: {endpoint}")
    return api


def _is_device_online(api, tuya_id: str) -> bool:
    try:
        resp = api.get(f"/v1.0/devices/{tuya_id}")
        return bool(resp.get("result", {}).get("online", False))
    except Exception:
        return False


def _fetch_device_status(api, tuya_id: str, poll_api: str) -> dict:
    if poll_api == "v2.0":
        resp = api.get(f"/v2.0/cloud/thing/{tuya_id}/shadow/properties")
    else:
        resp = api.get(f"/v1.0/devices/{tuya_id}/status")

    if not resp.get("success"):
        log.warning(f"Tuya API failed for {tuya_id}: {resp.get('msg', resp.get('code', 'unknown'))}")
        return {}

    raw = resp.get("result", [])
    if isinstance(raw, list):
        return {item["code"]: item["value"] for item in raw if isinstance(item, dict)}
    if isinstance(raw, dict):
        props = raw.get("properties", raw)
        if isinstance(props, list):
            return {item["code"]: item["value"] for item in props if isinstance(item, dict)}
        if isinstance(props, dict):
            return props
    log.warning(f"Unexpected Tuya response format for {tuya_id}: {raw}")
    return {}


# ── Warif API helpers ─────────────────────────────────────────────────────────

def _push_reading(warif_device_id: str, sensor_type: str, value: float, unit: str, farm_id: int = None):
    payload = {"device_id": warif_device_id, "sensor_type": sensor_type, "value": value, "unit": unit}
    if farm_id is not None:
        payload["farm_id"] = farm_id
    try:
        resp = requests.post(f"{WARIF_API}/api/v1/sensors", json=payload, timeout=10)
        if resp.status_code not in (200, 201):
            log.warning(f"Push failed [{sensor_type}]: {resp.status_code}")
    except requests.RequestException as e:
        log.warning(f"Push error [{sensor_type}]: {e}")


def _mark_offline(warif_device_id: str):
    try:
        requests.post(f"{WARIF_API}/api/v1/sensors/offline/{warif_device_id}", timeout=5)
    except requests.RequestException:
        pass


def _register_actuators(config: dict):
    """Ensure every actuator exists as a Device row in the DB. Safe to call repeatedly."""
    farm_id = config.get("farm_id")
    if not farm_id:
        return
    seen = set()
    for act in config.get("actuators", {}).values():
        warif_id = act.get("warif_device_id", "")
        if not warif_id or warif_id in seen:
            continue
        seen.add(warif_id)
        try:
            resp = requests.post(
                f"{WARIF_API}/api/v1/sensors",
                json={"device_id": warif_id, "sensor_type": "valve_state",
                      "value": 0.0, "unit": "bool", "farm_id": farm_id},
                timeout=10,
            )
            if resp.status_code in (200, 201):
                log.info(f"Registered actuator device in DB: {warif_id}")
            else:
                log.warning(f"Registration failed for {warif_id}: {resp.status_code}")
        except requests.RequestException as e:
            log.warning(f"Registration error for {warif_id}: {e}")


# ── Poll cycle ────────────────────────────────────────────────────────────────

def poll_once(api, config: dict):
    for dev in config.get("sensor_devices", []):
        label    = dev["label"]
        tuya_id  = dev["tuya_device_id"]
        warif_id = dev["warif_device_id"]
        poll_api = dev.get("poll_api", "v1.0")

        if not _is_device_online(api, tuya_id):
            log.warning(f"{label} ({tuya_id}): offline")
            _mark_offline(warif_id)
            continue

        status = _fetch_device_status(api, tuya_id, poll_api)
        if not status:
            log.warning(f"{label} ({tuya_id}): no data returned from Tuya")
            continue

        pushed = 0
        for code, mapping in dev["properties"].items():
            if code not in status:
                continue
            value = round(float(status[code]) * mapping["scale"], 3)
            _push_reading(warif_id, mapping["sensor_type"], value, mapping["unit"])
            pushed += 1

        if pushed:
            log.info(f"{label}: pushed {pushed} reading(s)")

    farm_id = config.get("farm_id")
    tuya_status_cache: dict = {}

    for name, act in config.get("actuators", {}).items():
        tuya_id  = act.get("tuya_device_id", "")
        warif_id = act.get("warif_device_id", "")
        if not tuya_id or not warif_id:
            continue

        if tuya_id not in tuya_status_cache:
            if not _is_device_online(api, tuya_id):
                log.warning(f"actuator/{name} ({tuya_id}): offline")
                tuya_status_cache[tuya_id] = None
            else:
                st = _fetch_device_status(api, tuya_id, act.get("command_api", "v1.0"))
                tuya_status_cache[tuya_id] = st or None
                if not st:
                    log.warning(f"actuator/{name} ({tuya_id}): no status data")

        status = tuya_status_cache.get(tuya_id)
        if status is None:
            _mark_offline(warif_id)
            continue

        switch_code = act.get("switch_code") or (act.get("codes") or [None])[0]
        if switch_code and switch_code in status:
            value = 1.0 if status[switch_code] else 0.0
            _push_reading(warif_id, "valve_state", value, "bool", farm_id=farm_id)
            log.info(f"actuator/{name}: online  ({switch_code}={status[switch_code]})")


# ── Entry point ───────────────────────────────────────────────────────────────

def run():
    """Blocking poll loop. Run in a thread via asyncio.to_thread() or standalone."""
    if not CONFIG_FILE.exists():
        log.warning(f"[Tuya Bridge] Config not found at {CONFIG_FILE} — bridge disabled")
        return

    config = json.loads(CONFIG_FILE.read_text())
    api    = _get_tuya_api()

    log.info(f"Bridge running — polling every {POLL_INTERVAL}s → {WARIF_API}")
    _register_actuators(config)

    while True:
        try:
            poll_once(api, config)
        except Exception as e:
            log.error(f"Poll cycle error: {e}")
        time.sleep(POLL_INTERVAL)
