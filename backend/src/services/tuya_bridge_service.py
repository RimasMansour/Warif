"""
Device Bridge Service
=====================
Polls sensor and actuator data from the external devices API every
TUYA_POLL_INTERVAL seconds and pushes readings to the Warif ingestion endpoint.

Runs automatically as a background thread when the backend starts.
Can also be run standalone via scripts/tuya_bridge.py.

Requires in .env:
    EXTERNAL_DEVICES_API_URL   (default: https://backend.aihajjservices.com)
    EXTERNAL_DEVICES_API_KEY
"""
import os
import time
import logging

import requests
from . import external_api_client as ext_api
from .tuya_client import get_device_config

log = logging.getLogger("tuya_bridge")

_port = os.getenv("PORT", "8000")
WARIF_API     = os.getenv("WARIF_API_URL", f"http://localhost:{_port}")
POLL_INTERVAL = int(os.getenv("TUYA_POLL_INTERVAL", "120"))


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

def poll_once(config: dict):
    farm_id      = config.get("farm_id")
    status_cache = ext_api.get_all_statuses()  # single HTTP call for all devices

    # Sensors
    for dev in config.get("sensor_devices", []):
        label    = dev["label"]
        tuya_id  = dev["tuya_device_id"]
        warif_id = dev["warif_device_id"]

        status = status_cache.get(tuya_id, {})
        if not status:
            log.warning(f"{label} ({tuya_id}): offline or no data")
            _mark_offline(warif_id)
            continue

        pushed = 0
        for code, mapping in dev["properties"].items():
            if code not in status:
                continue
            value = round(float(status[code]) * mapping["scale"], 3)
            _push_reading(warif_id, mapping["sensor_type"], value, mapping["unit"], farm_id=farm_id)
            pushed += 1

        if pushed:
            log.info(f"{label}: pushed {pushed} reading(s)")

    # Actuators
    for name, act in config.get("actuators", {}).items():
        tuya_id  = act.get("tuya_device_id", "")
        warif_id = act.get("warif_device_id", "")
        if not tuya_id or not warif_id:
            continue

        status = status_cache.get(tuya_id, {})
        if not status:
            log.warning(f"actuator/{name} ({tuya_id}): offline or no data")
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
    config = get_device_config()
    if not config:
        log.warning("[Bridge] Device config missing or empty — bridge disabled")
        return

    log.info(f"Bridge running — polling every {POLL_INTERVAL}s → {WARIF_API}")
    _register_actuators(config)

    while True:
        try:
            poll_once(config)
        except Exception as e:
            log.error(f"Poll cycle error: {e}")
        time.sleep(POLL_INTERVAL)
