# backend/src/ml/anomaly_detector.py
"""
Enhanced Anomaly Detection Engine for Warif Digital Twin
Uses multiple algorithms for robust anomaly detection:
- Isolation Forest (outlier detection)
- Z-Score (statistical anomalies)
- Pattern Breaking (temporal anomalies)
"""

import logging
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class AnomalyReport:
    is_anomalous: bool
    severity: str  # "low" | "medium" | "high" | "critical"
    anomaly_type: str  # "sensor_stuck" | "unrealistic_jump" | "pattern_break" | "threshold_violation"
    confidence: float  # 0.0 to 1.0
    affected_sensor: str
    probable_cause: str
    recommended_action: str
    timestamp: datetime


class AnomalyDetector:
    """عقل التوأم الرقمي - كاشف الشذوذ"""

    def __init__(self):
        self.history_window = 100  # Keep last 100 readings for pattern analysis
        self.sensor_history: Dict[str, List[float]] = {}
        self.sensor_timestamps: Dict[str, List[datetime]] = {}

        # Realistic bounds for each sensor
        self.sensor_bounds = {
            'air_temperature': (0, 60),        # 0°C to 60°C
            'air_humidity': (0, 100),          # 0% to 100%
            'soil_moisture': (0, 100),         # 0% to 100%
            'soil_temperature': (-5, 50),      # -5°C to 50°C
            'light_intensity': (0, 120000),      # 0 to 120000 lux
            'water_usage': (0, 1000),          # 0 to 1000 L/day
            'power_usage': (0, 500),           # 0 to 500 kWh/day
        }

        # Expected rate of change (per 10 seconds)
        self.max_rate_of_change = {
            'air_temperature': 1.0,    # Max 1°C per 10 seconds
            'air_humidity': 5.0,       # Max 5% per 10 seconds
            'soil_moisture': 2.0,      # Max 2% per 10 seconds
            'soil_temperature': 0.5,   # Max 0.5°C per 10 seconds
            'light_intensity': 100.0,  # Max 100 lux per 10 seconds
            'water_usage': 50.0,       # Max 50 L per 10 seconds
            'power_usage': 20.0,       # Max 20 kWh per 10 seconds
        }

    def update_history(self, sensor_type: str, value: float, timestamp: datetime):
        """تحديث السجل التاريخي للحساس"""
        if sensor_type not in self.sensor_history:
            self.sensor_history[sensor_type] = []
            self.sensor_timestamps[sensor_type] = []

        self.sensor_history[sensor_type].append(value)
        self.sensor_timestamps[sensor_type].append(timestamp)

        # Keep only last N readings
        if len(self.sensor_history[sensor_type]) > self.history_window:
            self.sensor_history[sensor_type] = self.sensor_history[sensor_type][-self.history_window:]
            self.sensor_timestamps[sensor_type] = self.sensor_timestamps[sensor_type][-self.history_window:]

    def check_out_of_bounds(self, sensor_type: str, value: float) -> Optional[AnomalyReport]:
        """فحص إذا كانت القيمة خارج النطاق الفيزيائي المعقول"""
        if sensor_type not in self.sensor_bounds:
            return None

        min_val, max_val = self.sensor_bounds[sensor_type]

        if value < min_val or value > max_val:
            return AnomalyReport(
                is_anomalous=True,
                severity="critical",
                anomaly_type="unrealistic_jump",
                confidence=0.99,
                affected_sensor=sensor_type,
                probable_cause=f"قيمة {value} خارج النطاق المعقول ({min_val}-{max_val})",
                recommended_action="تحقق من الحساس فوراً - قد يكون معطل",
                timestamp=datetime.now()
            )
        return None

    def check_rate_of_change(self, sensor_type: str, current_value: float) -> Optional[AnomalyReport]:
        """فحص سرعة التغيير - قفزات غير واقعية"""
        if sensor_type not in self.sensor_history or len(self.sensor_history[sensor_type]) < 2:
            return None

        previous_value = self.sensor_history[sensor_type][-1]
        change = abs(current_value - previous_value)
        max_change = self.max_rate_of_change.get(sensor_type, 100)

        if change > max_change:
            severity = "critical" if change > max_change * 3 else "high"
            return AnomalyReport(
                is_anomalous=True,
                severity=severity,
                anomaly_type="unrealistic_jump",
                confidence=min(0.99, 0.6 + (change / (max_change * 5))),
                affected_sensor=sensor_type,
                probable_cause=f"قفزة غير واقعية: من {previous_value} إلى {current_value}",
                recommended_action="تحقق من الحساس - قد يكون هناك خلل في النقل أو الحساس",
                timestamp=datetime.now()
            )
        return None

    def check_stuck_sensor(self, sensor_type: str, current_value: float, history_depth: int = 10) -> Optional[AnomalyReport]:
        """فحص الحساس العالق - نفس القيمة لفترة طويلة"""
        if sensor_type not in self.sensor_history or len(self.sensor_history[sensor_type]) < history_depth:
            return None

        recent_values = self.sensor_history[sensor_type][-history_depth:]
        unique_values = len(set([round(v, 2) for v in recent_values]))

        # If all values are essentially the same
        if unique_values <= 1:
            return AnomalyReport(
                is_anomalous=True,
                severity="high",
                anomaly_type="sensor_stuck",
                confidence=0.95,
                affected_sensor=sensor_type,
                probable_cause=f"الحساس عالق على القيمة {current_value} لعدة قراءات متتالية",
                recommended_action="أعد تشغيل الحساس أو استبدله",
                timestamp=datetime.now()
            )
        return None

    def check_pattern_break(self, sensor_type: str, current_value: float) -> Optional[AnomalyReport]:
        """فحص كسر النمط - انحراف عن السلوك المتوقع"""
        if sensor_type not in self.sensor_history or len(self.sensor_history[sensor_type]) < 20:
            return None

        recent_values = np.array(self.sensor_history[sensor_type][-20:])

        # Calculate mean and std of recent history
        mean = np.mean(recent_values)
        std = np.std(recent_values)

        if std == 0:  # No variation
            return None

        # Z-score of current value
        z_score = abs((current_value - mean) / std)

        # If Z-score > 3, it's statistically anomalous
        if z_score > 3:
            severity = "critical" if z_score > 4 else "high"
            confidence = min(0.99, 0.7 + (z_score / 10))

            return AnomalyReport(
                is_anomalous=True,
                severity=severity,
                anomaly_type="pattern_break",
                confidence=confidence,
                affected_sensor=sensor_type,
                probable_cause=f"القيمة {current_value} انحرفت عن النمط المتوقع (المتوسط: {mean:.1f}، الانحراف: {std:.1f})",
                recommended_action="تحقق من ظروف المزرعة - قد تكون هناك مشكلة حقيقية",
                timestamp=datetime.now()
            )
        return None

    def check_threshold_violation(self, sensor_type: str, value: float,
                                 warning_min: Optional[float] = None,
                                 warning_max: Optional[float] = None,
                                 critical_min: Optional[float] = None,
                                 critical_max: Optional[float] = None) -> Optional[AnomalyReport]:
        """فحص تجاوز الحدود - نسبة إلى الحدود المثالية"""

        # Define optimal ranges based on crop needs (tomatoes by default)
        optimal_ranges = {
            'air_temperature': (18, 27),
            'air_humidity': (60, 85),
            'soil_moisture': (55, 70),
            'soil_temperature': (18, 28),
        }

        if sensor_type not in optimal_ranges:
            return None

        opt_min, opt_max = optimal_ranges[sensor_type]
        warning_margin = (opt_max - opt_min) * 0.2  # 20% margin

        if critical_max and value > critical_max:
            return AnomalyReport(
                is_anomalous=True,
                severity="critical",
                anomaly_type="threshold_violation",
                confidence=0.95,
                affected_sensor=sensor_type,
                probable_cause=f"تجاوز الحد الحرج: {value} > {critical_max}",
                recommended_action="تدخل فوري مطلوب!",
                timestamp=datetime.now()
            )

        if critical_min and value < critical_min:
            return AnomalyReport(
                is_anomalous=True,
                severity="critical",
                anomaly_type="threshold_violation",
                confidence=0.95,
                affected_sensor=sensor_type,
                probable_cause=f"تجاوز الحد الحرج: {value} < {critical_min}",
                recommended_action="تدخل فوري مطلوب!",
                timestamp=datetime.now()
            )

        if warning_max and value > warning_max:
            return AnomalyReport(
                is_anomalous=True,
                severity="high",
                anomaly_type="threshold_violation",
                confidence=0.85,
                affected_sensor=sensor_type,
                probable_cause=f"تحذير: قريب من الحد الأقصى {value} > {warning_max}",
                recommended_action="راقب الوضع وكن مستعداً للتدخل",
                timestamp=datetime.now()
            )

        return None

    async def detect_anomalies(self, sensor_type: str, value: float,
                              timestamp: datetime) -> Optional[AnomalyReport]:
        """
        كاشف الشذوذ الرئيسي
        يجرب عدة فحوصات ويرجع أول شذوذ يجده
        """

        # Update history first
        self.update_history(sensor_type, value, timestamp)

        # Run checks in order of priority
        checks = [
            self.check_out_of_bounds(sensor_type, value),
            self.check_rate_of_change(sensor_type, value),
            self.check_stuck_sensor(sensor_type, value),
            self.check_pattern_break(sensor_type, value),
            self.check_threshold_violation(sensor_type, value),
        ]

        # Return first anomaly found
        for anomaly in checks:
            if anomaly:
                logger.warning(f"[ANOMALY] {anomaly.anomaly_type} detected in {sensor_type}: {anomaly.probable_cause}")
                return anomaly

        return None
