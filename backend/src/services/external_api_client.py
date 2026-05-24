"""
External Devices API Client
===========================
Single HTTP wrapper for backend.aihajjservices.com.
Handles both reading device status and sending control commands.

Replaces direct Tuya SDK usage in tuya_client.py and tuya_bridge_service.py.

Requires in .env:
    EXTERNAL_DEVICES_API_URL   (default: https://backend.aihajjservices.com)
    EXTERNAL_DEVICES_API_KEY
"""
import os
import logging
import requests

log = logging.getLogger(__name__)

_BASE_URL = os.getenv("EXTERNAL_DEVICES_API_URL", "https://backend.aihajjservices.com")
_API_KEY  = os.getenv("EXTERNAL_DEVICES_API_KEY", "")
_TIMEOUT  = 10


def _headers() -> dict:
    return {"x-api-key": _API_KEY, "Content-Type": "application/json"}


def _parse_status(device: dict) -> dict:
    raw = device.get("status", device.get("properties", []))
    if isinstance(raw, list):
        return {item["code"]: item["value"] for item in raw if isinstance(item, dict)}
    if isinstance(raw, dict):
        return raw
    return {}


# ── Read ──────────────────────────────────────────────────────────────────────

def get_devices() -> list:
    """Return the full device list from the external API."""
    try:
        resp = requests.get(
            f"{_BASE_URL}/api/tuya/devices/",
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else data.get("devices", data.get("result", []))
    except requests.RequestException as e:
        log.error(f"get_devices failed: {e}")
        return []


def get_all_statuses() -> dict:
    """
    Fetch all devices in one HTTP call.
    Returns {tuya_device_id: {code: value}} for every device.
    Use this in poll loops to avoid one request per device.
    """
    return {
        device["id"]: _parse_status(device)
        for device in get_devices()
        if device.get("id")
    }


# ── Control ───────────────────────────────────────────────────────────────────

def send_command(tuya_device_id: str, commands: list, use_v2: bool = False) -> bool:
    """
    Send control commands to a device.
    commands: list of {"code": str, "value": any} dicts.
    use_v2:   True sends properties dict (v2 shadow style), False sends commands list.

    NOTE: update the URL below if the control endpoint differs from this convention.
    """
    payload = (
        {"properties": {cmd["code"]: cmd["value"] for cmd in commands}}
        if use_v2
        else {"commands": commands}
    )
    try:
        resp = requests.post(
            f"{_BASE_URL}/api/tuya/devices/{tuya_device_id}/commands/",
            headers=_headers(),
            json=payload,
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except requests.RequestException as e:
        log.error(f"send_command failed for {tuya_device_id}: {e}")
        return False
