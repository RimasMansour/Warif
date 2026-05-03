import logging
from typing import Optional
import paho.mqtt.client as mqtt
from src.core.config import settings

logger = logging.getLogger(__name__)

class MQTTClient:
    """Singleton MQTT client for publishing device commands"""
    _instance: Optional['MQTTClient'] = None
    _client: Optional[mqtt.Client] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._connect()

    def _connect(self):
        try:
            self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_publish = self._on_publish

            if settings.MQTT_USERNAME and settings.MQTT_PASSWORD:
                self._client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)

            self._client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_BROKER_PORT, keepalive=60)
            self._client.loop_start()
            logger.info(f"MQTT client connecting to {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            self._client = None

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("MQTT client connected successfully")
        else:
            logger.warning(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, rc):
        if rc != 0:
            logger.warning(f"MQTT disconnected with code {rc}")

    def _on_publish(self, client, userdata, mid):
        logger.debug(f"MQTT message published: {mid}")

    def publish_command(self, device_id: str, command_type: str, payload: dict) -> bool:
        if self._client is None:
            logger.error("MQTT client not initialized")
            return False

        try:
            topic = f"devices/{device_id}/commands/{command_type}"
            import json
            message = json.dumps(payload)
            result = self._client.publish(topic, message, qos=1)
            if result.rc != mqtt.MQTT_ERR_SUCCESS:
                logger.error(f"Failed to publish to {topic}: {mqtt.error_string(result.rc)}")
                return False
            logger.info(f"Published command to {topic}")
            return True
        except Exception as e:
            logger.error(f"Error publishing command: {e}")
            return False

    def disconnect(self):
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            logger.info("MQTT client disconnected")

def get_mqtt_client() -> MQTTClient:
    """Get or create MQTT client instance"""
    return MQTTClient()
