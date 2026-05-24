"""
Actuator control — sends commands to devices via the external devices API.
Public interface is unchanged; call sites in irrigation.py and commands.py
require no modification.

All functions are synchronous; wrap with asyncio.to_thread in async routes.
"""
import json
import logging
from pathlib import Path
from typing import Optional

from . import external_api_client as ext_api

log = logging.getLogger(__name__)

_config: Optional[dict] = None


def get_device_config() -> dict:
    global _config
    if _config:
        return _config
    path = Path(__file__).resolve().parents[2] / "tuya_devices.json"
    if not path.exists():
        log.error(f"tuya_devices.json not found at {path}")
        return {}
    _config = json.loads(path.read_text())
    return _config


# ── Farm guard ────────────────────────────────────────────────────────────────

def get_tuya_farm_id() -> int:
    return int(get_device_config().get("farm_id", -1))


def is_tuya_farm(farm_id: int) -> bool:
    return farm_id == get_tuya_farm_id()


# ── Actuator control ──────────────────────────────────────────────────────────

def _control_actuator(name: str, on: bool) -> bool:
    cfg       = get_device_config().get("actuators", {}).get(name, {})
    device_id = cfg.get("tuya_device_id", "")
    if not device_id:
        log.warning(f"{name.title()} device not configured in tuya_devices.json")
        return False
    # irrigation stores a single switch_code; fan/cooling store a codes list
    switch = cfg.get("switch_code")
    codes  = [switch] if switch else cfg.get("codes", ["Power"])
    use_v2 = cfg.get("command_api", "v1.0") == "v2.0"
    ok = ext_api.send_command(device_id, [{"code": c, "value": on} for c in codes], use_v2=use_v2)
    log.info(f"{name.title()} → {'ON' if on else 'OFF'}  success={ok}")
    return ok


def control_irrigation(on: bool) -> bool:
    return _control_actuator("irrigation", on)


def control_fan(on: bool) -> bool:
    return _control_actuator("fan", on)


def control_cooling(on: bool) -> bool:
    return _control_actuator("cooling", on)
