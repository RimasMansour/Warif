# backend/src/mqtt/client.py
"""
MQTT client — subscribes to IoT device topics and persists
incoming sensor readings to the database.

Start with:  python -m src.mqtt.client
Or wire into the FastAPI lifespan event.
"""
import json
import asyncio
import logging
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from src.core.config import settings

logger = logging.getLogger(__name__)

TOPIC_TELEMETRY = "warif/+/telemetry"   # warif/{device_id}/telemetry
TOPIC_STATUS    = "warif/+/status"


def _on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("MQTT connected")
        client.subscribe(TOPIC_TELEMETRY)
        client.subscribe(TOPIC_STATUS)
    else:
        logger.error(f"MQTT connection failed: rc={rc}")


def _on_message(client, userdata, msg):
    """
    Expected payload (JSON):
    {
        "device_id": "gh-sensor-01",
        "sensor_type": "temperature",
        "value": 24.5,
        "unit": "C",
        "timestamp": "2025-01-01T12:00:00Z"   # optional
    }
    """
    try:
        payload = json.loads(msg.payload.decode())
        logger.debug(f"MQTT message on {msg.topic}: {payload}")
        # TODO: persist to DB — inject async session via userdata or queue
        #       e.g. asyncio.get_event_loop().run_until_complete(_save(payload))
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"Bad MQTT payload on {msg.topic}: {e}")


def build_client() -> mqtt.Client:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = _on_connect
    client.on_message = _on_message

    if settings.MQTT_USERNAME:
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

    return client


def start_mqtt_loop():
    """Blocking — run in a separate thread or process."""
    client = build_client()
    client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, keepalive=60)
    logger.info(f"Connecting to MQTT broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
    client.loop_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_mqtt_loop()
