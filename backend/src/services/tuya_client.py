"""
Tuya actuator control — called by backend routes to operate
irrigation, fan, and cooling via the Tuya cloud API.

Device config is read from tuya_devices.json at the project root.
All functions are synchronous; wrap with asyncio.to_thread in async routes.
"""
import json
import logging
import os
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

_api = None
_config: Optional[dict] = None


def _get_api():
    global _api
    if _api is not None:
        return _api
    try:
        from tuya_connector import TuyaOpenAPI
        endpoint      = os.getenv("TUYA_API_ENDPOINT", "https://openapi.tuyaeu.com")
        access_id     = os.getenv("TUYA_ACCESS_ID", "")
        access_secret = os.getenv("TUYA_ACCESS_SECRET", "")
        if not access_id or not access_secret:
            log.warning("Tuya credentials missing — actuator control disabled")
            return None
        _api = TuyaOpenAPI(endpoint, access_id, access_secret)
        result = _api.connect()
        if not result.get("success"):
            log.error(f"Tuya connect failed: {result}")
            _api = None
        return _api
    except Exception as e:
        log.error(f"Tuya client init error: {e}")
        return None


def _get_config() -> dict:
    global _config
    if _config:
        return _config
    path = Path(__file__).resolve().parents[2] / "tuya_devices.json"
    if not path.exists():
        log.error(f"tuya_devices.json not found at {path}")
        return {}
    _config = json.loads(path.read_text())
    return _config


def _send_commands(tuya_device_id: str, commands: list, use_v2: bool = False) -> bool:
    """Send a list of {code, value} commands to a Tuya device.
    use_v2=True uses the v2.0 shadow/properties/issue endpoint (needed for devices
    that do not support the v1.0 commands API).
    """
    api = _get_api()
    if api is None:
        return False
    try:
        if use_v2:
            properties = {cmd["code"]: cmd["value"] for cmd in commands}
            resp = api.post(
                f"/v2.0/cloud/thing/{tuya_device_id}/shadow/properties/issue",
                {"properties": properties},
            )
        else:
            resp = api.post(
                f"/v1.0/devices/{tuya_device_id}/commands",
                {"commands": commands},
            )
        if resp.get("success"):
            return True
        log.error(f"Tuya command rejected for {tuya_device_id}: {resp}")
        return False
    except Exception as e:
        log.error(f"Tuya command error for {tuya_device_id}: {e}")
        return False


# ── Farm guard ───────────────────────────────────────────────────────────────

def get_tuya_farm_id() -> int:
    """Return the farm ID configured for Tuya devices (from tuya_devices.json)."""
    return int(_get_config().get("farm_id", -1))


def is_tuya_farm(farm_id: int) -> bool:
    """Return True only if farm_id matches the Tuya-configured farm."""
    return farm_id == get_tuya_farm_id()


# ── Public control functions ──────────────────────────────────────────────────

def control_irrigation(on: bool) -> bool:
    """Open or close the irrigation valve."""
    cfg = _get_config().get("actuators", {}).get("irrigation", {})
    device_id   = cfg.get("tuya_device_id", "")
    switch_code = cfg.get("switch_code", "switch")
    if not device_id:
        log.warning("Irrigation device not configured in tuya_devices.json")
        return False
    ok = _send_commands(device_id, [{"code": switch_code, "value": on}])
    log.info(f"Irrigation → {'ON' if on else 'OFF'}  success={ok}")
    return ok


def control_fan(on: bool) -> bool:
    """Turn the fan (humidity-based) on or off."""
    cfg = _get_config().get("actuators", {}).get("fan", {})
    device_id = cfg.get("tuya_device_id", "")
    codes     = cfg.get("codes", ["Power"])
    use_v2    = cfg.get("command_api", "v1.0") == "v2.0"
    if not device_id:
        log.warning("Fan device not configured in tuya_devices.json")
        return False
    commands = [{"code": c, "value": on} for c in codes]
    ok = _send_commands(device_id, commands, use_v2=use_v2)
    log.info(f"Fan → {'ON' if on else 'OFF'}  success={ok}")
    return ok


def control_cooling(on: bool) -> bool:
    """
    Turn the full cooling unit on or off.
    ON  → sets Power=True  and TEMPONOFF=True  (fan + compressor together)
    OFF → sets Power=False and TEMPONOFF=False
    """
    cfg = _get_config().get("actuators", {}).get("cooling", {})
    device_id = cfg.get("tuya_device_id", "")
    codes     = cfg.get("codes", ["Power", "TEMPONOFF"])
    use_v2    = cfg.get("command_api", "v1.0") == "v2.0"
    if not device_id:
        log.warning("Cooling device not configured in tuya_devices.json")
        return False
    commands = [{"code": c, "value": on} for c in codes]
    ok = _send_commands(device_id, commands, use_v2=use_v2)
    log.info(f"Cooling → {'ON' if on else 'OFF'}  success={ok}")
    return ok
