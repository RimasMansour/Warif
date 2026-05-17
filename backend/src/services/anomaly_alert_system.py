# backend/src/services/anomaly_alert_system.py
"""
Advanced Anomaly & Malfunction Detection Alert System
======================================================
Overview:
    Integrates the AnomalyDetector with the system Alert manager to automate 
    alert generation upon detecting statistical outliers or physical device malfunctions.
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from src.db.models.models import Alert, AlertSeverity, AlertStatus, Device
from src.ml.anomaly_detector import AnomalyDetector, AnomalyReport

logger = logging.getLogger(__name__)


class AnomalyAlertSystem:
    """Advanced alert orchestration system pairing anomaly detection with real-time logging"""

    def __init__(self):
        """Initializes internal AnomalyDetector instance"""
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
        Analyzes a new sensor reading to verify normal telemetry operation.
        Triggers an automated system alert if an anomaly is identified.

        Args:
            device_id: Primary key or hardware identifier of the target sensor device.
            farm_id: Reference key indicating farm partition.
            sensor_type: Categorical type of the sensor telemetry (e.g. soil_moisture, air_temperature).
            value: Telemetry value parsed from incoming feed.
            db: Database session instance.

        Returns:
            Alert model instance if an anomaly is identified, otherwise None.
        """
        try:
            # Perform statistical/rule-based validation
            anomaly_report: AnomalyReport | None = await self.detector.detect_anomalies(
                sensor_type=sensor_type,
                value=value,
                timestamp=datetime.now(timezone.utc)
            )

            # Return early if reading conforms to physical boundaries
            if not anomaly_report or not anomaly_report.is_anomalous:
                return None

            # Log anomaly detection status
            logger.warning(
                f"[Anomaly Detected] Device: {device_id}, "
                f"Type: {anomaly_report.anomaly_type}, "
                f"Severity: {anomaly_report.severity}, "
                f"Value: {value}"
            )

            # Map string severity definitions to SQLAlchemy AlertSeverity schema
            severity_map = {
                "critical": AlertSeverity.critical,
                "high": AlertSeverity.high,
                "medium": AlertSeverity.warning,
                "low": AlertSeverity.info,
            }
            alert_severity = severity_map.get(anomaly_report.severity, AlertSeverity.warning)

            # Construct contextualized alert notification message
            alert_message = _build_anomaly_alert_message(
                anomaly_report=anomaly_report,
                device_id=device_id,
                current_value=value,
                sensor_type=sensor_type
            )

            # Check for concurrent active alerts to prevent flooding
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
                # Redundant alert check - skip logging duplicates
                logger.info(f"[Duplicate Alert Prevented] {device_id} already has open alert")
                return None

            # Persist new alert to PostgreSQL
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
    """Builds a formatted, human-readable notification body containing diagnostic info"""

    anomaly_titles = {
        "sensor_stuck": "🔴 Sensor Malfunction - Stuck Flatline Reading",
        "unrealistic_jump": "⚠️ Unrealistic Reading Step Jump",
        "pattern_break": "📊 Telemetry Pattern Deviation",
        "threshold_violation": "🚨 Critical Boundary Threshold Violation",
    }

    title = anomaly_titles.get(anomaly_report.anomaly_type, "⚠️ Anomaly Detected")

    message = f"""{title}

📍 Device: {device_id}
🌡️ Sensor Type: {sensor_type}
💾 Current Value: {current_value:.2f}

🔍 Diagnosis:
{anomaly_report.probable_cause}

📋 Anomaly Type: {anomaly_report.anomaly_type}
💪 Confidence: {int(anomaly_report.confidence * 100)}%

✅ Recommended Action:
{anomaly_report.recommended_action}
"""
    return message


# Singleton instance
_anomaly_alert_system = None


def get_anomaly_alert_system() -> AnomalyAlertSystem:
    """Retrieves the global Singleton instance of AnomalyAlertSystem"""
    global _anomaly_alert_system
    if _anomaly_alert_system is None:
        _anomaly_alert_system = AnomalyAlertSystem()
    return _anomaly_alert_system
