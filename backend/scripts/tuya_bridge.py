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
        log.error("TUYA_ACCESS_ID and TUYA_ACCESS_SECRET must be set in .env")
        sys.exit(1)

    api = TuyaOpenAPI(endpoint, access_id, access_secret)
    result = api.connect()
    if not result.get("success"):
        log.error(f"Tuya connection failed: {result}")
        sys.exit(1)

    log.info(f"Connected to Tuya API: {endpoint}")
    return api


def _is_device_online(api, tuya_id: str) -> bool:
    """Return True only if Tuya confirms the device is currently online."""
    try:
        resp = api.get(f"/v1.0/devices/{tuya_id}")
        return bool(resp.get("result", {}).get("online", False))
    except Exception:
        return False


def _fetch_device_status(api, tuya_id: str, poll_api: str) -> dict:
    """Return {code: value} for a device. Empty dict on failure."""
    if poll_api == "v2.0":
        resp = api.get(f"/v2.0/cloud/thing/{tuya_id}/shadow/properties")
    else:
        resp = api.get(f"/v1.0/devices/{tuya_id}/status")

    if not resp.get("success"):
        log.warning(f"Tuya API failed for {tuya_id}: {resp.get('msg', resp.get('code', 'unknown error'))}")
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


# ── Warif API helper ──────────────────────────────────────────────────────────

def _push_reading(warif_device_id: str, sensor_type: str, value: float, unit: str, farm_id: int = None):
    payload = {"device_id": warif_device_id, "sensor_type": sensor_type,
               "value": value, "unit": unit}
    if farm_id is not None:
        payload["farm_id"] = farm_id
    try:
        resp = requests.post(
            f"{WARIF_API}/api/v1/sensors",
            json=payload,
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            log.warning(f"Push failed [{sensor_type}]: {resp.status_code}")
    except requests.RequestException as e:
        log.warning(f"Push error [{sensor_type}]: {e}")


def _mark_offline(warif_device_id: str):
    """Immediately mark a device offline in the DB without waiting for the 5-min timeout."""
    try:
        requests.post(f"{WARIF_API}/api/v1/sensors/offline/{warif_device_id}", timeout=5)
    except requests.RequestException:
        pass


# ── Poll loop ─────────────────────────────────────────────────────────────────

def poll_once(api, config: dict):
    for dev in config.get("sensor_devices", []):
        label    = dev["label"]
        tuya_id  = dev["tuya_device_id"]
        warif_id = dev["warif_device_id"]
        poll_api = dev.get("poll_api", "v1.0")

        if not _is_device_online(api, tuya_id):
            log.warning(f"{label} ({tuya_id}): offline (Tuya confirms device is down)")
            _mark_offline(warif_id)
            continue

        status = _fetch_device_status(api, tuya_id, poll_api)

        if not status:
            log.warning(f"{label} ({tuya_id}): no data returned from Tuya — property codes may have changed")
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

    # ── Poll actuator devices to keep connectivity status up to date ──────────
    # Fetch status once per unique Tuya device, then push heartbeats to ALL
    # warif_device_ids that share that physical device (e.g. fan + cooling).
    farm_id = config.get("farm_id")
    tuya_status_cache: dict = {}   # tuya_id -> status dict (None = offline)

    for name, act in config.get("actuators", {}).items():
        tuya_id  = act.get("tuya_device_id", "")
        warif_id = act.get("warif_device_id", "")
        if not tuya_id or not warif_id:
            continue

        # Fetch from Tuya only once per physical device
        if tuya_id not in tuya_status_cache:
            if not _is_device_online(api, tuya_id):
                log.warning(f"actuator/{name} ({tuya_id}): offline (Tuya confirms device is down)")
                tuya_status_cache[tuya_id] = None
            else:
                poll_api = act.get("command_api", "v1.0")
                st = _fetch_device_status(api, tuya_id, poll_api)
                tuya_status_cache[tuya_id] = st if st else None
                if not st:
                    log.warning(f"actuator/{name} ({tuya_id}): no status data returned")

        status = tuya_status_cache.get(tuya_id)
        if status is None:
            _mark_offline(warif_id)
            continue

        # Push heartbeat for every warif_device_id so each gets its own last_seen update
        switch_code = act.get("switch_code") or (act.get("codes") or [None])[0]
        if switch_code and switch_code in status:
            value = 1.0 if status[switch_code] else 0.0
            _push_reading(warif_id, "valve_state", value, "bool", farm_id=farm_id)
            log.info(f"actuator/{name}: online  ({switch_code}={status[switch_code]})")


def _register_actuators(config: dict):
    """Ensure every actuator device exists as a Device record in the Warif DB.
    Called once at startup. Uses farm_id from config so sensors.py auto-creates
    the Device row if it is missing. Safe to call repeatedly — sensors.py skips
    creation if the record already exists.
    """
    farm_id = config.get("farm_id")
    if not farm_id:
        return
    seen = set()
    for name, act in config.get("actuators", {}).items():
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
                log.warning(f"Registration push failed for {warif_id}: {resp.status_code}")
        except requests.RequestException as e:
            log.warning(f"Registration push error for {warif_id}: {e}")


def run():
    config = json.loads(CONFIG_FILE.read_text())
    api    = _get_tuya_api()

    log.info(f"Bridge running — polling every {POLL_INTERVAL}s → {WARIF_API}")
    log.info("Press Ctrl+C to stop\n")

    _register_actuators(config)

    while True:
        try:
            poll_once(api, config)
        except Exception as e:
            log.error(f"Poll cycle error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
