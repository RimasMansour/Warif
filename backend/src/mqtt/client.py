# backend/src/mqtt/client.py
"""
MQTT client — subscribes to IoT device topics and persists
incoming sensor readings to the database.

Start with:  python -m src.mqtt.client
Or wire into the FastAPI lifespan event.
"""
import json
import logging
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from src.core.config import settings

# استيراد الـ Pipeline الخاص بـ Warif
# هذا الاستيراد هو الإضافة الوحيدة المطلوبة
from src.ml.continual_learning import WarifDatabase, WarifEnsemble, ContinualLearner

logger = logging.getLogger(__name__)

TOPIC_TELEMETRY = "warif/+/telemetry"   # warif/{device_id}/telemetry
TOPIC_STATUS    = "warif/+/status"

# تهيئة الـ Pipeline مرة واحدة عند تشغيل النظام
# المسارات تشير لمجلد ml داخل المشروع
_db       = WarifDatabase("src/ml/warif_farm.db")
_ensemble = WarifEnsemble("src/ml/saved_models")
_learner  = ContinualLearner(
    db           = _db,
    ensemble     = _ensemble,
    base_dir     = "src/ml",
    dataset_path = "src/ml/warif_dataset.csv"
)


def _on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("MQTT connected")
        client.subscribe(TOPIC_TELEMETRY)
        client.subscribe(TOPIC_STATUS)
    else:
        logger.error(f"MQTT connection failed: rc={rc}")


def _parse_sensor_payload(payload: dict) -> dict:
    """
    يحوّل payload الوارد من الـ sensor للشكل اللي يفهمه النموذج.

    الـ sensor يرسل قراءة واحدة في كل message مثل:
        { "sensor_type": "temperature", "value": 24.5 }

    لكن النموذج يحتاج كل القراءات معاً في نفس الوقت.
    هذه الدالة تجمع القراءات وتبني الـ reading الكاملة.

    ملاحظة: لما يكتمل ربط كل الـ sensors، عدّلي هذه الدالة
    لتجمع القراءات من كل الأجهزة قبل ما تمرّرها للنموذج.
    """
    # خريطة تحويل اسم الـ sensor للحقل المقابل في النموذج
    sensor_map = {
        "soil_moisture"   : "soil_moisture",
        "soil_temperature": "soil_temp",
        "soil_ph"         : "soil_ph",
        "soil_ec"         : "soil_ec",
        "air_temperature" : "air_temp",
        "humidity"        : "humidity",
        "co2"             : "co2_ppm",
        "vpd"             : "vpd_kpa",
    }

    reading = {
        "timestamp" : payload.get("timestamp", datetime.now(timezone.utc).isoformat()),
        "farm_id"   : payload.get("device_id", "greenhouse-01"),
        "source"    : "real",   # بيانات حقيقية من الـ sensors

        # قيم افتراضية لما لا تكون القراءة متوفرة بعد
        "soil_moisture"        : 65.0,
        "soil_temp"            : 24.0,
        "soil_ph"              : 6.4,
        "soil_ec"              : 1.8,
        "air_temp"             : 26.0,
        "humidity"             : 75.0,
        "co2_ppm"              : 700.0,
        "vpd_kpa"              : 1.0,
        "growth_stage_encoded" : 3,
        "days_since_transplant": 30,
    }

    # تحديث القيمة الواردة من الـ sensor
    sensor_type = payload.get("sensor_type", "")
    if sensor_type in sensor_map:
        field = sensor_map[sensor_type]
        reading[field] = payload.get("value")

    return reading


def _on_message(client, userdata, msg):
    """
    Expected payload (JSON):
    {
        "device_id": "gh-sensor-01",
        "sensor_type": "temperature",
        "value": 24.5,
        "unit": "C",
        "timestamp": "2025-01-01T12:00:00Z"
    }
    """
    try:
        payload = json.loads(msg.payload.decode())
        logger.debug(f"MQTT message on {msg.topic}: {payload}")

        # تحويل الـ payload لـ reading يفهمه النموذج
        reading = _parse_sensor_payload(payload)

        # السطر الرئيسي:
        # يحفظ القراءة + يأخذ قرار الري + يراقب الأداء
        result = _learner.process_reading(reading)

        logger.info(
            f"Warif decision: {result['decision']} "
            f"(confidence={result['confidence']}) "
            f"model={result['model_version']}"
        )

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
    logger.info(
        f"Connecting to MQTT broker at "
        f"{settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}"
    )
    client.loop_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_mqtt_loop()