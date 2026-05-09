# backend/src/services/anomaly_alert_system.py
"""
نظام التنبيهات المتقدمة - كشف الشذوذ والأعطال
Advanced Anomaly & Malfunction Detection Alert System

يدمج AnomalyDetector مع نظام الـ Alerts لتوليد تنبيهات تلقائية
عند اكتشاف قراءات شاذة أو سلوك غريب في الحساسات
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from src.db.models.models import Alert, AlertSeverity, AlertStatus, Device
from src.ml.anomaly_detector import AnomalyDetector, AnomalyReport

logger = logging.getLogger(__name__)


class AnomalyAlertSystem:
    """نظام التنبيهات المتقدم - يجمع بين كشف الشذوذ والتنبيهات التلقائية"""

    def __init__(self):
        """تهيئة كاشف الشذوذ"""
        self.detector = AnomalyDetector()

    async def check_sensor_reading_anomalies(
        self,
        device_id: str,
        farm_id: int,
        sensor_type: str,
        value: float,
        db: AsyncSession
    ) -> Alert | None:
        """
        فحص قراءة حساس جديدة للتحقق من الشذوذ
        إذا اُكتشف شذوذ → توليد alert تلقائي

        Args:
            device_id: معرف الجهاز (مثل: "sensor_farm_20_temp_1")
            farm_id: معرف المزرعة
            sensor_type: نوع الحساس (air_temperature, soil_moisture, ...)
            value: قيمة القراءة الحالية
            db: جلسة قاعدة البيانات

        Returns:
            Alert object إذا اُكتشف شذوذ، None إذا كانت القراءة طبيعية
        """
        try:
            # فحص الشذوذ باستخدام AnomalyDetector
            anomaly_report: AnomalyReport | None = await self.detector.detect_anomalies(
                sensor_type=sensor_type,
                value=value,
                timestamp=datetime.now(timezone.utc)
            )

            # إذا لم يُكتشف شذوذ → قراءة طبيعية
            if not anomaly_report or not anomaly_report.is_anomalous:
                return None

            # ✅ شذوذ مُكتشف → توليد alert
            logger.warning(
                f"[Anomaly Detected] Device: {device_id}, "
                f"Type: {anomaly_report.anomaly_type}, "
                f"Severity: {anomaly_report.severity}, "
                f"Value: {value}"
            )

            # تحويل severity من string إلى AlertSeverity enum
            severity_map = {
                "critical": AlertSeverity.critical,
                "high": AlertSeverity.high,
                "medium": AlertSeverity.warning,
                "low": AlertSeverity.info,
            }
            alert_severity = severity_map.get(anomaly_report.severity, AlertSeverity.warning)

            # بناء رسالة Alert مفصلة
            alert_message = _build_anomaly_alert_message(
                anomaly_report=anomaly_report,
                device_id=device_id,
                current_value=value,
                sensor_type=sensor_type
            )

            # التحقق من عدم وجود alert مشابه مفتوح بالفعل
            existing_alert = await db.execute(
                select(Alert).where(
                    and_(
                        Alert.device_id == device_id,
                        Alert.sensor_type == sensor_type,
                        Alert.status == "open"
                    )
                )
            )
            if existing_alert.scalar_one_or_none():
                # alert مشابه موجود بالفعل - لا نوليد مكرر
                logger.info(f"[Duplicate Alert Prevented] {device_id} already has open alert")
                return None

            # إنشاء Alert جديد
            alert = Alert(
                farm_id=farm_id,
                device_id=device_id,
                sensor_type=sensor_type,
                severity=alert_severity,
                status=AlertStatus.open,
                message=alert_message,
                threshold=None,
                actual_value=value,
            )

            db.add(alert)
            await db.flush()

            logger.info(
                f"[Alert Generated] Farm: {farm_id}, "
                f"Device: {device_id}, "
                f"Type: {anomaly_report.anomaly_type}, "
                f"AlertID: {alert.id}"
            )

            return alert

        except Exception as e:
            logger.error(f"[AnomalyAlertSystem Error] {device_id}: {e}")
            return None


def _build_anomaly_alert_message(
    anomaly_report: AnomalyReport,
    device_id: str,
    current_value: float,
    sensor_type: str
) -> str:
    """بناء رسالة تنبيه مفصلة وسهلة الفهم"""

    anomaly_titles = {
        "sensor_stuck": "🔴 حساس معطل - عالق على قيمة ثابتة",
        "unrealistic_jump": "⚠️ قفزة غير واقعية في القراءات",
        "pattern_break": "📊 انحراف عن النمط المتوقع",
        "threshold_violation": "🚨 تجاوز الحد الحرج",
    }

    title = anomaly_titles.get(anomaly_report.anomaly_type, "⚠️ شذوذ مكتشف")

    message = f"""{title}

📍 الجهاز: {device_id}
🌡️ نوع الحساس: {sensor_type}
💾 القيمة الحالية: {current_value:.2f}

🔍 التحليل:
{anomaly_report.probable_cause}

📋 النوع: {anomaly_report.anomaly_type}
💪 الثقة: {int(anomaly_report.confidence * 100)}%

✅ الإجراء المقترح:
{anomaly_report.recommended_action}
"""
    return message


# Singleton instance
_anomaly_alert_system = None


def get_anomaly_alert_system() -> AnomalyAlertSystem:
    """الحصول على instance من نظام التنبيهات"""
    global _anomaly_alert_system
    if _anomaly_alert_system is None:
        _anomaly_alert_system = AnomalyAlertSystem()
    return _anomaly_alert_system
