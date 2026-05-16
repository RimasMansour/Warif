"""
Tuya Device Setup — run ONCE before starting the bridge.
Registers all Tuya devices under farm 22 in the Warif database
so sensor readings are linked to the correct farm on the dashboard.

Usage (from the backend/ folder):
    set WARIF_PASSWORD=<mans password>
    python scripts/tuya_setup.py
"""
import os
import sys
import json
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(".env.shared")
load_dotenv(".env")

WARIF_API      = os.getenv("WARIF_API_URL", "http://localhost:8000")
WARIF_USERNAME = os.getenv("WARIF_USERNAME", "mans")
WARIF_PASSWORD = os.getenv("WARIF_PASSWORD", "")
CONFIG_FILE    = Path(__file__).parent.parent / "tuya_devices.json"


def load_config() -> dict:
    with open(CONFIG_FILE) as f:
        return json.load(f)


def login(username: str, password: str) -> str:
    resp = requests.post(
        f"{WARIF_API}/api/v1/auth/login",
        data={"username": username, "password": password},
        timeout=10,
    )
    if resp.status_code != 200:
        print(f"Login failed ({resp.status_code}): {resp.text}")
        sys.exit(1)
    token = resp.json()["access_token"]
    print(f"Logged in as '{username}'")
    return token


def register_device(token: str, farm_id: int, device_id: str, name: str, device_type: str):
    resp = requests.post(
        f"{WARIF_API}/api/v1/farms/{farm_id}/devices",
        json={"device_id": device_id, "name": name, "type": device_type},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if resp.status_code == 201:
        print(f"  Registered: {device_id} ({name})")
    elif resp.status_code == 400 and "already registered" in resp.text.lower():
        print(f"  Already exists: {device_id} — skipping")
    else:
        print(f"  Error registering {device_id}: {resp.status_code} {resp.text}")


def main():
    if not WARIF_PASSWORD:
        print("ERROR: Set WARIF_PASSWORD environment variable before running.")
        print("  Windows:  set WARIF_PASSWORD=yourpassword")
        print("  Linux:    export WARIF_PASSWORD=yourpassword")
        sys.exit(1)

    config   = load_config()
    farm_id  = config["farm_id"]
    token    = login(WARIF_USERNAME, WARIF_PASSWORD)

    print(f"\nRegistering devices under farm {farm_id}...")

    # Sensor devices
    for dev in config.get("sensor_devices", []):
        register_device(token, farm_id, dev["warif_device_id"], dev["warif_name"], "sensor")

    # Actuator devices
    for key, act in config.get("actuators", {}).items():
        register_device(token, farm_id, act["warif_device_id"], act["warif_name"], "actuator")

    print("\nSetup complete. You can now start the bridge:")
    print("  python scripts/tuya_bridge.py")


if __name__ == "__main__":
    main()
