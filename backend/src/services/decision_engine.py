# backend/src/services/decision_engine.py
import os
import logging
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

@dataclass
class SmartRecommendation:
    message: str
    reasoning: str
    category: str      # "irrigation" | "temperature" | "humidity" | "soil"
    severity: str      # "normal" | "warning" | "urgent"
    confidence: float  # 0.0 to 1.0


class SmartDecisionEngine:

    async def fetch_weather(self) -> dict:
        """Fetch real weather from open-meteo for Makkah region"""
        try:
            import httpx
            url = (
                "https://api.open-meteo.com/v1/forecast"
                "?latitude=21.3891&longitude=39.8579"
                "&current=temperature_2m,relative_humidity_2m,cloudcover,is_day"
                "&timezone=auto"
            )
            async with httpx.AsyncClient(timeout=4.0) as client:
                r = await client.get(url)
                data = r.json()["current"]
                return {
                    "ext_temp": data["temperature_2m"],
                    "ext_humidity": data["relative_humidity_2m"],
                    "cloudcover": data["cloudcover"],
                    "is_day": data["is_day"],
                }
        except Exception as e:
            logger.warning(f"Weather fetch failed: {e}")
            return {}

    def run_ml_prediction(self, sensor_data: dict) -> Optional[dict]:
        """Run the Warif ensemble ML model"""
        try:
            import sys
            sys.path.insert(0, ".")
            from src.ml.continual_learning import WarifEnsemble
            models_dir = "src/ml/saved_models"
            if not os.path.exists(models_dir):
                return None
            ensemble = WarifEnsemble(models_dir)
            features = {
                "soil_moisture":         sensor_data.get("soil_moisture", 50.0),
                "soil_temp":             sensor_data.get("soil_temperature", 25.0),
                "soil_ph":               6.4,
                "soil_ec":               1.8,
                "air_temp":              sensor_data.get("air_temperature", 28.0),
                "humidity":              sensor_data.get("air_humidity", 60.0),
                "co2_ppm":               700.0,
                "vpd_kpa":               1.0,
                "growth_stage_encoded":  3,
                "days_since_transplant": 30,
            }
            result = ensemble.predict(features)
            return result
        except Exception as e:
            logger.warning(f"ML prediction failed: {e}")
            return None

    async def analyze(self, sensor_data: dict) -> List[SmartRecommendation]:
        recommendations = []

        # --- Collect inputs ---
        soil_moisture    = sensor_data.get("soil_moisture")
        soil_temperature = sensor_data.get("soil_temperature")
        air_temperature  = sensor_data.get("air_temperature")
        air_humidity     = sensor_data.get("air_humidity")

        weather = await self.fetch_weather()
        ext_temp     = weather.get("ext_temp")
        ext_humidity = weather.get("ext_humidity")
        cloudcover   = weather.get("cloudcover", 0)

        ml_result = self.run_ml_prediction(sensor_data)

        hour = datetime.now(timezone.utc).hour

        # ─── IRRIGATION DECISION ──────────────────────────────────────────
        if soil_moisture is not None:
            # Build weighted score
            ml_vote = 0.0
            if ml_result:
                ml_vote = ml_result["ensemble_pred"] * ml_result["confidence"] * 0.50

            if soil_moisture < 25:
                soil_vote = 0.9 * 0.25
            elif soil_moisture < 40:
                soil_vote = 0.6 * 0.25
            elif soil_moisture > 75:
                soil_vote = -0.5 * 0.25
            else:
                soil_vote = 0.1 * 0.25

            if ext_temp is not None:
                heat_factor = max(0, (ext_temp - 30) / 20)
                cloud_factor = 1.0 - cloudcover / 100
                weather_vote = heat_factor * cloud_factor * 0.15
            else:
                weather_vote = 0.0

            if 5 <= hour <= 9 or 16 <= hour <= 19:
                time_vote = 0.3 * 0.10
            elif 10 <= hour <= 15:
                time_vote = -0.2 * 0.10
            else:
                time_vote = 0.0

            score = ml_vote + soil_vote + weather_vote + time_vote
            score = max(-1.0, min(1.0, score))

            # Build dynamic Arabic reasoning
            parts = []
            parts.append(f"رطوبة التربة الحالية {soil_moisture:.0f}%")
            if ml_result:
                conf_pct = int(ml_result["confidence"] * 100)
                decision = "يحتاج ري" if ml_result["ensemble_pred"] == 1 else "لا يحتاج ري"
                parts.append(f"نموذج الذكاء الاصطناعي: {decision} (ثقة {conf_pct}%)")
            if ext_temp is not None:
                parts.append(f"الحرارة الخارجية {ext_temp:.0f}°C")
            if 5 <= hour <= 9:
                parts.append("وقت الري المثالي (الصباح الباكر)")
            elif 10 <= hour <= 15:
                parts.append("تجنب الري وقت الذروة لتقليل التبخر")

            reasoning = " — ".join(parts)

            if score > 0.5:
                severity = "urgent" if score > 0.75 else "warning"
                message = "يُنصح بالري الفوري" if score > 0.75 else "يُنصح بالري قريباً"
                recommendations.append(SmartRecommendation(
                    message=message,
                    reasoning=reasoning,
                    category="irrigation",
                    severity=severity,
                    confidence=min(score + 0.3, 1.0),
                ))
            elif score < -0.2:
                recommendations.append(SmartRecommendation(
                    message="لا حاجة للري حالياً — التربة مكتفية",
                    reasoning=reasoning,
                    category="irrigation",
                    severity="normal",
                    confidence=0.75,
                ))
            else:
                recommendations.append(SmartRecommendation(
                    message="معدل الري ضمن النطاق المثالي",
                    reasoning=reasoning,
                    category="irrigation",
                    severity="normal",
                    confidence=0.65,
                ))

        # ─── TEMPERATURE DECISION ─────────────────────────────────────────
        if air_temperature is not None:
            combined_temp = air_temperature
            if ext_temp is not None:
                combined_temp = air_temperature * 0.7 + ext_temp * 0.3

            parts = [f"حرارة الهواء الداخلي {air_temperature:.1f}°C"]
            if ext_temp is not None:
                parts.append(f"حرارة خارجية {ext_temp:.0f}°C")
                if cloudcover < 20:
                    parts.append("سماء صافية تزيد الحمل الحراري")

            reasoning = " — ".join(parts)

            if combined_temp > 38 and cloudcover < 20:
                recommendations.append(SmartRecommendation(
                    message="حرارة خطرة — فعّل التبريد الطارئ فوراً",
                    reasoning=reasoning,
                    category="temperature",
                    severity="urgent",
                    confidence=0.92,
                ))
            elif combined_temp > 33:
                recommendations.append(SmartRecommendation(
                    message="حرارة الهواء مرتفعة — راقب التهوية",
                    reasoning=reasoning,
                    category="temperature",
                    severity="warning",
                    confidence=0.80,
                ))
            elif combined_temp < 12:
                recommendations.append(SmartRecommendation(
                    message="حرارة الهواء منخفضة — فعّل التدفئة",
                    reasoning=reasoning,
                    category="temperature",
                    severity="warning",
                    confidence=0.85,
                ))
            else:
                recommendations.append(SmartRecommendation(
                    message="درجة حرارة الهواء ضمن النطاق المثالي",
                    reasoning=reasoning,
                    category="temperature",
                    severity="normal",
                    confidence=0.90,
                ))

        # ─── HUMIDITY DECISION ────────────────────────────────────────────
        if air_humidity is not None:
            parts = [f"رطوبة الهواء {air_humidity:.0f}%"]
            if ext_humidity is not None:
                parts.append(f"رطوبة خارجية {ext_humidity:.0f}%")

            reasoning = " — ".join(parts)

            if air_humidity > 85:
                severity = "urgent" if (ext_humidity or 0) > 80 else "warning"
                msg = "رطوبة داخلية وخارجية مرتفعة — زد التهوية فوراً" if severity == "urgent" else "رطوبة الهواء مرتفعة — زد التهوية"
                recommendations.append(SmartRecommendation(
                    message=msg,
                    reasoning=reasoning,
                    category="humidity",
                    severity=severity,
                    confidence=0.88,
                ))
            elif air_humidity < 30:
                recommendations.append(SmartRecommendation(
                    message="رطوبة الهواء منخفضة — فعّل الترطيب",
                    reasoning=reasoning,
                    category="humidity",
                    severity="warning",
                    confidence=0.82,
                ))
            else:
                recommendations.append(SmartRecommendation(
                    message="رطوبة الهواء ضمن النطاق المثالي",
                    reasoning=reasoning,
                    category="humidity",
                    severity="normal",
                    confidence=0.88,
                ))

        # ─── SOIL TEMPERATURE ────────────────────────────────────────────
        if soil_temperature is not None:
            if soil_temperature > 35:
                recommendations.append(SmartRecommendation(
                    message="حرارة التربة مرتفعة — تأمل التظليل",
                    reasoning=f"حرارة التربة {soil_temperature:.1f}°C تعيق امتصاص الجذور",
                    category="soil",
                    severity="warning",
                    confidence=0.78,
                ))
            elif soil_temperature < 10:
                recommendations.append(SmartRecommendation(
                    message="حرارة التربة منخفضة — قلل الري مؤقتاً",
                    reasoning=f"حرارة التربة {soil_temperature:.1f}°C تبطئ نشاط الكائنات الدقيقة",
                    category="soil",
                    severity="warning",
                    confidence=0.75,
                ))

        return recommendations
