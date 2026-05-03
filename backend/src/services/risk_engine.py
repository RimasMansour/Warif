# backend/src/services/risk_engine.py
"""
Risk Assessment Engine for Warif Digital Twin
Evaluates multiple risk factors and produces a comprehensive risk score.
"""

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class RiskFactor:
    name: str  # "heat_stress" | "cold_stress" | "drought" | "flooding" | "disease" | "power_failure" | "equipment_failure"
    weight: float  # 0.0 to 1.0
    current_score: float  # 0.0 to 1.0
    trend: str  # "improving" | "stable" | "worsening"
    description: str


@dataclass
class RiskAssessment:
    overall_risk_score: float  # 0.0 to 1.0 (0=safe, 1=critical)
    risk_level: str  # "safe" | "low" | "moderate" | "high" | "critical"
    primary_risks: List[RiskFactor]
    secondary_risks: List[RiskFactor]
    immediate_actions_required: List[str]
    monitoring_recommendations: List[str]
    confidence: float
    timestamp: datetime


class RiskEngine:
    """محرك تقييم المخاطر - عين التوأم الرقمي"""

    def __init__(self):
        # Risk factor weights (sum should = 1.0)
        self.weights = {
            'heat_stress': 0.20,          # Temperature too high
            'cold_stress': 0.15,          # Temperature too low
            'drought': 0.20,              # Soil moisture too low
            'flooding': 0.15,             # Soil moisture too high / water overflow
            'disease_risk': 0.15,         # Humidity + temp = fungal disease zone
            'equipment_failure': 0.10,    # Pump/fan/sensor failures
            'nutrient_deficiency': 0.05,  # Based on soil EC and pH
        }

        # Thresholds for each risk factor
        self.thresholds = {
            'heat_stress': {
                'low': 32,      # Alert starts at 32°C
                'moderate': 35, # Significant risk at 35°C
                'high': 38,     # Critical at 38°C
                'critical': 42, # Plant death zone at 42°C
            },
            'cold_stress': {
                'critical': 5,  # Plant damage at <5°C
                'high': 10,     # Significant risk at <10°C
                'moderate': 15, # Alert at <15°C
                'low': 18,      # Suboptimal at <18°C
            },
            'drought': {
                'critical': 20, # Severe drought <20%
                'high': 30,     # Significant stress <30%
                'moderate': 40, # Warning zone <40%
                'low': 55,      # Suboptimal <55%
            },
            'flooding': {
                'critical': 95, # Root rot risk >95%
                'high': 85,     # Significant waterlogging >85%
                'moderate': 75, # Warning zone >75%
                'low': 70,      # Suboptimal >70%
            },
            'disease_risk': {
                'critical': 0.85,  # Perfect disease conditions
                'high': 0.70,
                'moderate': 0.50,
                'low': 0.30,
            }
        }

    def assess_heat_stress(self, air_temp: Optional[float], soil_temp: Optional[float],
                          humidity: Optional[float], light_intensity: Optional[float]) -> RiskFactor:
        """
        تقييم مخاطر الإجهاد الحراري
        يعتمد على درجة الحرارة والرطوبة وشدة الضوء
        """
        if air_temp is None:
            return RiskFactor("heat_stress", self.weights['heat_stress'], 0.0, "stable", "بيانات غير متاحة")

        risk_score = 0.0

        # Air temperature component (60% of weight)
        if air_temp >= 42:
            risk_score += 1.0 * 0.6
        elif air_temp >= 38:
            risk_score += 0.8 * 0.6
        elif air_temp >= 35:
            risk_score += 0.5 * 0.6
        elif air_temp >= 32:
            risk_score += 0.2 * 0.6

        # Humidity component (20% of weight) - dry air makes stress worse
        if humidity and humidity < 40:
            risk_score += 0.4 * 0.2
        elif humidity and humidity < 30:
            risk_score += 0.8 * 0.2

        # Light intensity (20% of weight) - strong light increases stress
        if light_intensity and light_intensity > 1500:
            risk_score += 0.3 * 0.2

        trend = "worsening" if air_temp > 32 else "improving"

        return RiskFactor(
            name="heat_stress",
            weight=self.weights['heat_stress'],
            current_score=min(1.0, risk_score),
            trend=trend,
            description=f"درجة الحرارة {air_temp:.1f}°C - الرطوبة {humidity:.0f}%" if humidity else f"درجة الحرارة {air_temp:.1f}°C"
        )

    def assess_drought(self, soil_moisture: Optional[float], air_humidity: Optional[float],
                      soil_temp: Optional[float]) -> RiskFactor:
        """
        تقييم مخاطر الجفاف
        يعتمد على رطوبة التربة والهواء
        """
        if soil_moisture is None:
            return RiskFactor("drought", self.weights['drought'], 0.0, "stable", "بيانات غير متاحة")

        risk_score = 0.0

        # Soil moisture (70% of weight)
        if soil_moisture < 20:
            risk_score += 1.0 * 0.7
        elif soil_moisture < 30:
            risk_score += 0.7 * 0.7
        elif soil_moisture < 40:
            risk_score += 0.4 * 0.7
        elif soil_moisture < 55:
            risk_score += 0.1 * 0.7

        # Air humidity (30% of weight) - low humidity accelerates plant water loss
        if air_humidity:
            if air_humidity < 30:
                risk_score += 0.6 * 0.3
            elif air_humidity < 45:
                risk_score += 0.3 * 0.3

        trend = "worsening" if soil_moisture < 45 else "improving"

        return RiskFactor(
            name="drought",
            weight=self.weights['drought'],
            current_score=min(1.0, risk_score),
            trend=trend,
            description=f"رطوبة التربة {soil_moisture:.0f}%"
        )

    def assess_flooding(self, soil_moisture: Optional[float]) -> RiskFactor:
        """
        تقييم مخاطر الإغراق
        رطوبة التربة العالية جداً تؤدي إلى تعفن الجذور
        """
        if soil_moisture is None:
            return RiskFactor("flooding", self.weights['flooding'], 0.0, "stable", "بيانات غير متاحة")

        risk_score = 0.0

        if soil_moisture > 95:
            risk_score = 1.0
        elif soil_moisture > 85:
            risk_score = 0.7
        elif soil_moisture > 75:
            risk_score = 0.3
        elif soil_moisture > 70:
            risk_score = 0.1

        trend = "worsening" if soil_moisture > 80 else "improving"

        return RiskFactor(
            name="flooding",
            weight=self.weights['flooding'],
            current_score=min(1.0, risk_score),
            trend=trend,
            description=f"رطوبة التربة {soil_moisture:.0f}% - خطر تعفن الجذور"
        )

    def assess_disease_risk(self, air_temp: Optional[float], humidity: Optional[float],
                           soil_moisture: Optional[float]) -> RiskFactor:
        """
        تقييم خطر الأمراض الفطرية
        الأمراض تزدهر في ظروف: 15-28°C و 80-95% رطوبة و رطوبة تربة عالية
        """
        if not (air_temp and humidity and soil_moisture):
            return RiskFactor("disease_risk", self.weights['disease_risk'], 0.0, "stable", "بيانات غير متاحة")

        risk_score = 0.0

        # Temperature component (40% of weight)
        # Disease sweet spot is 15-28°C
        if 15 <= air_temp <= 28:
            temp_factor = 1.0 - abs(air_temp - 21.5) / 13  # Peak at 21.5°C
            risk_score += temp_factor * 0.4
        else:
            risk_score += 0.0 * 0.4

        # Humidity component (40% of weight)
        # Disease sweet spot is 80-95%
        if 80 <= humidity <= 95:
            humidity_factor = 1.0 - abs(humidity - 87.5) / 15  # Peak at 87.5%
            risk_score += humidity_factor * 0.4
        else:
            risk_score += 0.0 * 0.4

        # Soil moisture component (20% of weight)
        if 70 <= soil_moisture <= 90:
            moisture_factor = 1.0 - abs(soil_moisture - 80) / 20  # Peak at 80%
            risk_score += moisture_factor * 0.2

        trend = "worsening" if risk_score > 0.6 else "improving"

        return RiskFactor(
            name="disease_risk",
            weight=self.weights['disease_risk'],
            current_score=min(1.0, risk_score),
            trend=trend,
            description=f"ظروف مثالية للأمراض الفطرية: {air_temp:.1f}°C, {humidity:.0f}% رطوبة"
        )

    async def assess_overall_risk(self,
                                 sensor_data: Dict,
                                 system_status: Optional[Dict] = None) -> RiskAssessment:
        """
        تقييم شامل للمخاطر
        يجمع كل عوامل المخاطرة في درجة واحدة
        """

        # Extract sensor data
        air_temp = sensor_data.get('air_temperature')
        humidity = sensor_data.get('air_humidity')
        soil_moisture = sensor_data.get('soil_moisture')
        soil_temp = sensor_data.get('soil_temperature')
        light_intensity = sensor_data.get('light_intensity')

        # Assess individual risks
        risk_factors = [
            self.assess_heat_stress(air_temp, soil_temp, humidity, light_intensity),
            self.assess_drought(soil_moisture, humidity, soil_temp),
            self.assess_flooding(soil_moisture),
            self.assess_disease_risk(air_temp, humidity, soil_moisture),
        ]

        # Calculate weighted overall score
        overall_score = sum(rf.weight * rf.current_score for rf in risk_factors)
        overall_score = min(1.0, max(0.0, overall_score))

        # Determine risk level
        if overall_score >= 0.8:
            risk_level = "critical"
        elif overall_score >= 0.6:
            risk_level = "high"
        elif overall_score >= 0.4:
            risk_level = "moderate"
        elif overall_score >= 0.2:
            risk_level = "low"
        else:
            risk_level = "safe"

        # Sort risks by score
        risk_factors.sort(key=lambda x: x.current_score, reverse=True)
        primary_risks = [rf for rf in risk_factors if rf.current_score >= 0.5]
        secondary_risks = [rf for rf in risk_factors if 0.3 <= rf.current_score < 0.5]

        # Generate recommendations
        immediate_actions = []
        monitoring_recs = []

        if overall_score >= 0.8:
            immediate_actions.append("🚨 تدخل فوري مطلوب - الاتصال بالمسؤول")

        for risk in primary_risks:
            if risk.name == "heat_stress":
                immediate_actions.append("تشغيل أنظمة التبريد والتهوية")
            elif risk.name == "drought":
                immediate_actions.append("تفعيل الري الفوري")
            elif risk.name == "flooding":
                immediate_actions.append("إيقاف الري وفتح التصريف")
            elif risk.name == "disease_risk":
                monitoring_recs.append("زيادة التهوية لتقليل الرطوبة")

        if not immediate_actions and overall_score < 0.2:
            monitoring_recs.append("الأنظمة تعمل بشكل طبيعي - استمر في المراقبة")

        return RiskAssessment(
            overall_risk_score=overall_score,
            risk_level=risk_level,
            primary_risks=primary_risks,
            secondary_risks=secondary_risks,
            immediate_actions_required=immediate_actions,
            monitoring_recommendations=monitoring_recs,
            confidence=0.90,
            timestamp=datetime.now()
        )
