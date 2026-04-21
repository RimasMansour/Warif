# backend/scripts/device_simulator.py
"""
Warif Device Simulator
Simulates IoT sensors publishing data via MQTT every 5 minutes.
Sensor types: soil_moisture, soil_temperature, air_temperature, air_humidity
"""
import asyncio
import json
import random
import time
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("paho-mqtt not installed. Run: pip install paho-mqtt")
    sys.exit(1)


# ── Configuration ──────────────────────────────────────────────────────────
MQTT_HOST     = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT     = int(os.getenv("MQTT_PORT", "1883"))
FARM_ID       = os.getenv("FARM_ID", "farm_001")
DEVICE_ID     = os.getenv("DEVICE_ID", "simulator_001")
INTERVAL_SEC  = int(os.getenv("SENSOR_INTERVAL", "10"))  # 10s for dev, 300s for prod


# ── Sensor value generators ────────────────────────────────────────────────
def generate_soil_moisture(prev: float) -> float:
    """Soil moisture decreases slowly over time, resets after irrigation."""
    change = random.uniform(-2.0, 0.5)
    value = prev + change
    return round(max(10.0, min(95.0, value)), 2)


def generate_soil_temperature(prev: float) -> float:
    change = random.uniform(-0.5, 0.5)
    value = prev + change
    return round(max(5.0, min(40.0, value)), 2)


def generate_air_temperature(prev: float) -> float:
    change = random.uniform(-1.0, 1.0)
    value = prev + change
    return round(max(5.0, min(50.0, value)), 2)


def generate_air_humidity(prev: float) -> float:
    change = random.uniform(-2.0, 2.0)
    value = prev + change
    return round(max(10.0, min(99.0, value)), 2)


# ── MQTT Publisher ─────────────────────────────────────────────────────────
class WaifSimulator:
    def __init__(self):
        self.client = mqtt.Client(client_id=f"warif-simulator-{DEVICE_ID}")
        self.client.on_connect    = self._on_connect
        self.client.on_disconnect = self._on_disconnect

        # Initial sensor values
        self.state = {
            "soil_moisture":    random.uniform(30.0, 60.0),
            "soil_temperature": random.uniform(18.0, 28.0),
            "air_temperature":  random.uniform(20.0, 35.0),
            "air_humidity":     random.uniform(40.0, 70.0),
        }

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
        else:
            print(f"Failed to connect. Return code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        print(f"Disconnected from MQTT broker. RC: {rc}")

    def connect(self):
        try:
            self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            print(f"Could not connect to MQTT: {e}")
            print("Make sure MQTT broker is running.")
            sys.exit(1)

    def publish_reading(self, sensor_type: str, value: float):
        topic = f"warif/{FARM_ID}/sensor/{sensor_type}"
        payload = json.dumps({
            "device_id":   DEVICE_ID,
            "farm_id":     FARM_ID,
            "sensor_type": sensor_type,
            "value":       value,
            "unit":        self._get_unit(sensor_type),
            "timestamp":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        result = self.client.publish(topic, payload, qos=1)
        if result.rc == 0:
            print(f"  Published {sensor_type}: {value} -> {topic}")
        else:
            print(f"  Failed to publish {sensor_type}")

    def _get_unit(self, sensor_type: str) -> str:
        units = {
            "soil_moisture":    "%",
            "soil_temperature": "C",
            "air_temperature":  "C",
            "air_humidity":     "%",
        }
        return units.get(sensor_type, "")

    def update_state(self):
        self.state["soil_moisture"]    = generate_soil_moisture(self.state["soil_moisture"])
        self.state["soil_temperature"] = generate_soil_temperature(self.state["soil_temperature"])
        self.state["air_temperature"]  = generate_air_temperature(self.state["air_temperature"])
        self.state["air_humidity"]     = generate_air_humidity(self.state["air_humidity"])

    def run(self):
        self.connect()
        print(f"\nWarif Simulator running...")
        print(f"  Farm ID:  {FARM_ID}")
        print(f"  Device:   {DEVICE_ID}")
        print(f"  Interval: {INTERVAL_SEC}s")
        print(f"  Press Ctrl+C to stop\n")

        try:
            while True:
                self.update_state()
                print(f"\n[{time.strftime('%H:%M:%S')}] Publishing sensor readings:")
                for sensor_type, value in self.state.items():
                    self.publish_reading(sensor_type, value)
                time.sleep(INTERVAL_SEC)

        except KeyboardInterrupt:
            print("\nSimulator stopped.")
        finally:
            self.client.loop_stop()
            self.client.disconnect()


if __name__ == "__main__":
    simulator = WaifSimulator()
    simulator.run()