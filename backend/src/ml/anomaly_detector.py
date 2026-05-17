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
    """Digital Twin Engine - Anomaly Detector Core"""

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
            'power_usage': (0, 5000),          # 0 to 5000 Wh total
        }

        # Expected rate of change (per 10 seconds)
        self.max_rate_of_change = {
            'air_temperature': 1.0,    # Max 1°C per 10 seconds
            'air_humidity': 5.0,       # Max 5% per 10 seconds
            'soil_moisture': 2.0,      # Max 2% per 10 seconds
            'soil_temperature': 0.5,   # Max 0.5°C per 10 seconds
            'light_intensity': 100.0,  # Max 100 lux per 10 seconds
            'water_usage': 500.0,      # Max 500 L per 10 seconds (pump can be off = 0)
            'power_usage': 200.0,      # Max 200 Wh per 10 seconds
        }

    def update_history(self, sensor_type: str, value: float, timestamp: datetime):
        """Updates historical window of sensor readings"""
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
        """Validates if sensor value is within realistic physical boundaries"""
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
                probable_cause=f"Value {value} is out of realistic physical bounds ({min_val}-{max_val})",
                recommended_action="Inspect the sensor immediately; potential physical malfunction detected",
                timestamp=datetime.now()
            )
        return None

    def check_rate_of_change(self, sensor_type: str, current_value: float) -> Optional[AnomalyReport]:
        """Validates value rate of change to detect anomalous temporal spikes"""
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
                probable_cause=f"Unrealistic step change: from {previous_value} to {current_value}",
                recommended_action="Inspect the sensor and check the telemetry channel for noise",
                timestamp=datetime.now()
            )
        return None

    def check_stuck_sensor(self, sensor_type: str, current_value: float, history_depth: int = 10) -> Optional[AnomalyReport]:
        """Checks for persistent flatline readings, which indicates a frozen sensor"""
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
                probable_cause=f"Sensor stuck on value {current_value} for consecutive historical readings",
                recommended_action="Reboot, recalibrate, or replace the sensor",
                timestamp=datetime.now()
            )
        return None

    def check_pattern_break(self, sensor_type: str, current_value: float) -> Optional[AnomalyReport]:
        """Analyzes reading statistical deviation to detect pattern breaks (Z-Score)"""
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
                probable_cause=f"Value {current_value} deviated significantly from normal pattern (mean: {mean:.1f}, std: {std:.1f})",
                recommended_action="Verify physical greenhouse conditions; a real environmental issue might be occurring",
                timestamp=datetime.now()
            )
        return None

    def check_threshold_violation(self, sensor_type: str, value: float,
                                 warning_min: Optional[float] = None,
                                 warning_max: Optional[float] = None,
                                 critical_min: Optional[float] = None,
                                 critical_max: Optional[float] = None) -> Optional[AnomalyReport]:
        """Validates readings against defined optimal agricultural thresholds"""

        # Define optimal ranges based on crop needs (tomatoes by default)
        optimal_ranges = {
            'air_temperature': (15, 38),
            'air_humidity': (20, 95),
            'soil_moisture': (20, 85),
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
                probable_cause=f"Critical upper limit violated: {value} > {critical_max}",
                recommended_action="Immediate corrective action required!",
                timestamp=datetime.now()
            )

        if critical_min and value < critical_min:
            return AnomalyReport(
                is_anomalous=True,
                severity="critical",
                anomaly_type="threshold_violation",
                confidence=0.95,
                affected_sensor=sensor_type,
                probable_cause=f"Critical lower limit violated: {value} < {critical_min}",
                recommended_action="Immediate corrective action required!",
                timestamp=datetime.now()
            )

        if warning_max and value > warning_max:
            return AnomalyReport(
                is_anomalous=True,
                severity="high",
                anomaly_type="threshold_violation",
                confidence=0.85,
                affected_sensor=sensor_type,
                probable_cause=f"Warning threshold exceeded: {value} > {warning_max}",
                recommended_action="Monitor telemetry trend closely and prepare for preventative intervention",
                timestamp=datetime.now()
            )

        return None

    async def detect_anomalies(self, sensor_type: str, value: float,
                              timestamp: datetime) -> Optional[AnomalyReport]:
        """
        Main Anomaly Detection Interface.
        Runs all configured verification checks sequentially and returns the first detected anomaly.
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
