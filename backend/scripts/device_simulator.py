#!/usr/bin/env python
# backend/scripts/device_simulator.py
"""
Simulates an IoT device publishing sensor readings over MQTT.
Useful for local development without real hardware.

Usage:  python scripts/device_simulator.py
"""
import sys, os, time, json, random, logging
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import paho.mqtt.client as mqtt
from src.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

DEVICE_ID = "gh-sensor-sim-01"
INTERVAL_S = 10   # publish every 10 seconds

SENSORS = {
    "temperature":   (20.0, 26.0, "°C"),
    "humidity":      (55.0, 75.0, "%"),
    "light":         (3000, 7000, "lux"),
    "soil_moisture": (45.0, 65.0, "%"),
    "ec":            (1.4,  2.2,  "mS/cm"),
    "co2":           (450,  900,  "ppm"),
}


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if settings.MQTT_USERNAME:
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

    client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT)
    client.loop_start()
    logger.info(f"Simulator started — publishing every {INTERVAL_S}s as device '{DEVICE_ID}'")

    try:
        while True:
            for sensor_type, (lo, hi, unit) in SENSORS.items():
                payload = {
                    "device_id":   DEVICE_ID,
                    "sensor_type": sensor_type,
                    "value":       round(random.uniform(lo, hi), 2),
                    "unit":        unit,
                    "timestamp":   datetime.now(timezone.utc).isoformat(),
                }
                topic = f"warif/{DEVICE_ID}/telemetry"
                client.publish(topic, json.dumps(payload))
                logger.info(f"Published {sensor_type}={payload['value']} {unit}")
            time.sleep(INTERVAL_S)
    except KeyboardInterrupt:
        logger.info("Simulator stopped.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
