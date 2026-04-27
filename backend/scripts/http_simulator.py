#!/usr/bin/env python
# backend/scripts/http_simulator.py
"""
Warif HTTP Simulator
Sends sensor readings directly to the Backend API via HTTP.
No MQTT broker needed.
"""
import time
import random
import requests
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

API_BASE    = os.getenv("API_URL", "http://localhost:8000")
DEVICE_ID   = os.getenv("DEVICE_ID", "sensor_001")
INTERVAL    = int(os.getenv("SENSOR_INTERVAL", "10"))
USERNAME    = os.getenv("DEMO_USERNAME", "demo_farmer")
PASSWORD    = os.getenv("DEMO_PASSWORD", "demo1234")

def get_token():
    res = requests.post(
        f"{API_BASE}/api/v1/auth/login",
        data={"username": USERNAME, "password": PASSWORD},
    )
    if res.status_code == 200:
        token = res.json()["access_token"]
        print(f"[OK] Logged in as {USERNAME}")
        return token
    print(f"[ERROR] Login failed: {res.text}")
    sys.exit(1)

def send_reading(token, sensor_type, value, unit):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "device_id":   DEVICE_ID,
        "sensor_type": sensor_type,
        "value":       value,
        "unit":        unit,
    }
    res = requests.post(
        f"{API_BASE}/api/v1/sensors",
        json=payload,
        headers=headers,
    )
    return res.status_code

state = {
    "soil_moisture":    random.uniform(35.0, 60.0),
    "soil_temperature": random.uniform(20.0, 28.0),
    "air_temperature":  random.uniform(25.0, 38.0),
    "air_humidity":     random.uniform(45.0, 70.0),
}

UNITS = {
    "soil_moisture":    "%",
    "soil_temperature": "C",
    "air_temperature":  "C",
    "air_humidity":     "%",
}

def update_state():
    state["soil_moisture"]    = max(10.0, min(90.0, state["soil_moisture"]    + random.uniform(-2.0, 0.5)))
    state["soil_temperature"] = max(10.0, min(40.0, state["soil_temperature"] + random.uniform(-0.5, 0.5)))
    state["air_temperature"]  = max(15.0, min(50.0, state["air_temperature"]  + random.uniform(-1.0, 1.0)))
    state["air_humidity"]     = max(20.0, min(95.0, state["air_humidity"]     + random.uniform(-2.0, 2.0)))

if __name__ == "__main__":
    print("Warif HTTP Simulator")
    print(f"  API:      {API_BASE}")
    print(f"  Device:   {DEVICE_ID}")
    print(f"  Interval: {INTERVAL}s")
    print(f"  Press Ctrl+C to stop\n")

    token = get_token()

    try:
        while True:
            update_state()
            print(f"[{time.strftime('%H:%M:%S')}] Sending readings:")
            for sensor_type, value in state.items():
                value_rounded = round(value, 2)
                status = send_reading(token, sensor_type, value_rounded, UNITS[sensor_type])
                print(f"  {sensor_type}: {value_rounded} {UNITS[sensor_type]} -> {status}")
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        print("\nSimulator stopped.")
