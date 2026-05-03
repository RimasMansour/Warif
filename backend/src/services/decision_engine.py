# backend/src/services/decision_engine.py
"""
Warif Digital Twin Decision Engine
عقل التوأم الرقمي الذكي - يرى، يفكر، يحلل، ويقرر
"""

import os
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple

logger = logging.getLogger(__name__)


@dataclass
class SmartRecommendation:
    message: str
    reasoning: str
    category: str      # "irrigation" | "temperature" | "humidity" | "soil"
    severity: str      # "normal" | "warning" | "urgent"
    confidence: float  # 0.0 to 1.0
    risk_level: Optional[str] = None  # NEW: من Risk Engine
    anomalies: Optional[List[Dict]] = None  # NEW: من Anomaly Detector


class SmartDecisionEngine:
    """
    عقل التوأم الرقمي - يجمع كل المعلومات ويتخذ قرارات ذكية
    Integration:
    1. Anomaly Detector: كشف الشذوذ
    2. Risk Engine: تقييم المخاطر
    3. ML Ensemble: تنبؤات الذكاء الاصطناعي
    4. Weather API: العوامل الخارجية
    """

    # Class-level cache to prevent duplicate recommendations
    # Key: (farm_id, category) -> Value: (message, severity, timestamp)
    _rec_cache: Dict[Tuple[int, str], Tuple[str, str, datetime]] = {}

    def __init__(self):
        """Initialize the decision engine with sub-components"""
        try:
            from src.ml.anomaly_detector import AnomalyDetector
            from src.services.risk_engine import RiskEngine
            self.anomaly_detector = AnomalyDetector()
            self.risk_engine = RiskEngine()
            logger.info("Decision Engine: Anomaly Detector & Risk Engine initialized")
        except ImportError as e:
            logger.error(f"Failed to load AI components: {e}")
            self.anomaly_detector = None
            self.risk_engine = None

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

    def _get_models_directory(self) -> Optional[str]:
        models_dir = os.getenv("WARIF_MODELS_DIR")
        if models_dir and os.path.isdir(models_dir):
            return models_dir

        default_models_dir = os.path.join(os.getcwd(), "src", "ml", "saved_models")
        if os.path.isdir(default_models_dir):
            return default_models_dir

        logger.warning(f"Models directory not found. Checked: {default_models_dir}")
        return None

    def run_ml_prediction(self, sensor_data: dict) -> Optional[dict]:
        """Run the Warif ensemble ML model (Random Forest + XGBoost + LSTM)"""
        try:
            models_dir = self._get_models_directory()
            if not models_dir:
                logger.warning("ML models directory not available")
                return None

            import sys
            if "." not in sys.path:
                sys.path.insert(0, ".")
            from src.ml.continual_learning import WarifEnsemble
            ensemble = WarifEnsemble(models_dir)
            soil_moisture = sensor_data.get("soil_moisture", 50.0)
            features = {
                "soil_moisture":         soil_moisture,
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
        except ImportError as e:
            logger.error(f"Failed to import WarifEnsemble: {e}")
            return None
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
                if score > 0.75:
                    message = "تحسين إدارة الري"
                    rec_text = f"رطوبة التربة الحالية ({soil_moisture:.0f}%) انخفضت عن الحد الأدنى المتوقع (40%). الإجراء: تفعيل الري الفوري لتجنب إجهاد النبات."
                else:
                    message = "زيادة فترات الري"
                    rec_text = f"رطوبة التربة ({soil_moisture:.0f}%) بدأت تنخفض نحو الحد الحرج. التوصية: زيادة تكرار الري تدريجياً للحفاظ على الإنتاجية."

                if ml_result:
                    recommendation_conf = ml_result.get("confidence", 0.65)
                else:
                    recommendation_conf = min(abs(score) + 0.15, 0.85)

                recommendations.append(SmartRecommendation(
                    message=message,
                    reasoning=rec_text,
                    category="irrigation",
                    severity=severity,
                    confidence=max(0.50, min(0.95, recommendation_conf)),
                ))
            elif score < -0.2:
                recommendations.append(SmartRecommendation(
                    message="تقليل فترات الري",
                    reasoning=f"رطوبة التربة الحالية ({soil_moisture:.0f}%) فوق المستوى المثالي (60%). التوصية: تقليل عدد فترات الري لتوفير المياه وتجنب أمراض الجذور.",
                    category="irrigation",
                    severity="normal",
                    confidence=max(0.7, min(0.9, abs(score) + 0.3)),
                ))
            # لا نضيف توصية إذا كانت الحالة مثالية - لا داعي لإرباك المستخدم

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
                    message="تفعيل نظام التبريد الطارئ",
                    reasoning=f"درجة الحرارة الحالية ({combined_temp:.0f}°C) تجاوزت الحد الحرج (38°C) وسماء صافية تزيد الضغط الحراري. الإجراء: تشغيل أنظمة التبريد فوراً وفتح جميع فتحات التهوية.",
                    category="temperature",
                    severity="urgent",
                    confidence=0.93,
                ))
            elif combined_temp > 33:
                # Higher confidence if outdoor temp is also high
                conf = 0.82 if ext_temp and ext_temp > 30 else 0.75
                rec_text = f"درجة الحرارة الحالية ({combined_temp:.0f}°C) مرتفعة عن الحد المثالي (28°C). التوصية: زيادة التهوية والتأكد من سريان الهواء لتجنب إجهاد النبات."
                recommendations.append(SmartRecommendation(
                    message="تحسين التهوية والتبريد",
                    reasoning=rec_text,
                    category="temperature",
                    severity="warning",
                    confidence=conf,
                ))
            elif combined_temp < 12:
                recommendations.append(SmartRecommendation(
                    message="تفعيل نظام التدفئة",
                    reasoning=f"درجة الحرارة الحالية ({combined_temp:.0f}°C) انخفضت عن الحد الأدنى (15°C). الإجراء: تشغيل التدفئة تدريجياً لتجنب صدمة حرارية للنبات.",
                    category="temperature",
                    severity="warning",
                    confidence=0.84,
                ))
            # لا نضيف توصية إذا كانت درجة الحرارة مثالية

        # ─── HUMIDITY DECISION ────────────────────────────────────────────
        if air_humidity is not None:
            parts = [f"رطوبة الهواء {air_humidity:.0f}%"]
            if ext_humidity is not None:
                parts.append(f"رطوبة خارجية {ext_humidity:.0f}%")

            reasoning = " — ".join(parts)

            if air_humidity > 85:
                severity = "urgent" if (ext_humidity or 0) > 80 else "warning"
                if severity == "urgent":
                    msg = "تحسين التهوية الطارئ"
                    rec_text = f"رطوبة الهواء الحالية ({air_humidity:.0f}%) والخارجية ({ext_humidity or 0:.0f}%) مرتفعة جداً. الإجراء: فتح جميع فتحات التهوية فوراً لتجنب الأمراض الفطرية."
                else:
                    msg = "زيادة التهوية"
                    rec_text = f"رطوبة الهواء الحالية ({air_humidity:.0f}%) مرتفعة عن الحد المثالي (60-70%). التوصية: تحسين التهوية لتقليل مخاطر الإصابة بالأمراض."
                conf = 0.91 if severity == "urgent" else 0.86
                recommendations.append(SmartRecommendation(
                    message=msg,
                    reasoning=rec_text,
                    category="humidity",
                    severity=severity,
                    confidence=conf,
                ))
            elif air_humidity < 30:
                recommendations.append(SmartRecommendation(
                    message="تفعيل نظام الترطيب",
                    reasoning=f"رطوبة الهواء الحالية ({air_humidity:.0f}%) منخفضة جداً عن الحد الأدنى (40%). التوصية: تفعيل نظام الرش لزيادة الرطوبة وتجنب الإجهاد المائي للنبات.",
                    category="humidity",
                    severity="warning",
                    confidence=0.80,
                ))
            # لا نضيف توصية إذا كانت الرطوبة مثالية

        # ─── SOIL TEMPERATURE ────────────────────────────────────────────
        if soil_temperature is not None:
            if soil_temperature > 35:
                recommendations.append(SmartRecommendation(
                    message="تحسين حماية التربة من الحرارة",
                    reasoning=f"درجة حرارة التربة الحالية ({soil_temperature:.1f}°C) مرتفعة جداً وتعيق امتصاص الجذور للعناصر الغذائية. الإجراء: استخدام الظلل أو تغطية التربة لتقليل درجة الحرارة.",
                    category="soil",
                    severity="warning",
                    confidence=0.82,
                ))
            elif soil_temperature < 10:
                recommendations.append(SmartRecommendation(
                    message="تقليل الري في فترة البرودة",
                    reasoning=f"درجة حرارة التربة الحالية ({soil_temperature:.1f}°C) منخفضة جداً وتبطئ نشاط الكائنات الدقيقة. التوصية: تقليل عدد فترات الري لتجنب تعفن الجذور.",
                    category="soil",
                    severity="warning",
                    confidence=0.79,
                ))

        return recommendations

    async def analyze_with_intelligence(self, sensor_data: dict, farm_id: Optional[int] = None) -> Dict:
        """
        القرار الموحد الذكي الشامل
        يدمج:
        1. الـ Anomaly Detection (كشف المشاكل)
        2. الـ Risk Assessment (تقييم المخاطر)
        3. الـ ML Analysis (التنبؤ الذكي)
        4. العوامل الخارجية (الطقس، الوقت)

        Returns: {
            "recommendations": [...],  # التوصيات الأساسية
            "risk_assessment": {...},  # تقييم المخاطر
            "anomalies": [...],        # الشذوذ المكتشف
            "overall_intelligence": {...},  # الحكم الموحد
        }
        """

        # Step 1: Check for anomalies
        anomalies = []
        if self.anomaly_detector:
            for sensor_type, value in sensor_data.items():
                anomaly = await self.anomaly_detector.detect_anomalies(
                    sensor_type, value, datetime.now(timezone.utc)
                )
                if anomaly:
                    anomalies.append({
                        "sensor": sensor_type,
                        "type": anomaly.anomaly_type,
                        "severity": anomaly.severity,
                        "confidence": anomaly.confidence,
                        "description": anomaly.probable_cause,
                        "action": anomaly.recommended_action,
                    })
                    logger.warning(f"[ANOMALY] {sensor_type}: {anomaly.probable_cause}")

        # Step 2: Assess risks
        risk_assessment = {}
        if self.risk_engine:
            risk_report = await self.risk_engine.assess_overall_risk(sensor_data)
            risk_assessment = {
                "overall_score": risk_report.overall_risk_score,
                "level": risk_report.risk_level,
                "primary_risks": [
                    {
                        "name": r.name,
                        "score": r.current_score,
                        "trend": r.trend,
                        "description": r.description,
                    }
                    for r in risk_report.primary_risks
                ],
                "secondary_risks": [
                    {
                        "name": r.name,
                        "score": r.current_score,
                        "description": r.description,
                    }
                    for r in risk_report.secondary_risks
                ],
                "immediate_actions": risk_report.immediate_actions_required,
                "monitoring": risk_report.monitoring_recommendations,
            }
            logger.info(f"[RISK] Overall risk level: {risk_report.risk_level} ({risk_report.overall_risk_score:.2%})")

        # Step 3: Get standard recommendations
        recommendations = await self.analyze(sensor_data)

        # Step 4: Enhance recommendations with risk info
        for rec in recommendations:
            if anomalies:
                rec.anomalies = [a for a in anomalies if a["sensor"] in sensor_data]
            if risk_assessment:
                rec.risk_level = risk_assessment.get("level")

        # Step 5: Build overall intelligence summary
        overall_intelligence = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "farm_id": farm_id,
            "anomaly_count": len(anomalies),
            "critical_anomalies": len([a for a in anomalies if a.get("severity") == "critical"]),
            "risk_level": risk_assessment.get("level", "unknown"),
            "risk_score": risk_assessment.get("overall_score", 0),
            "recommendation_count": len(recommendations),
            "urgent_count": len([r for r in recommendations if r.severity == "urgent"]),
            "status": self._determine_system_status(risk_assessment, recommendations, anomalies),
        }

        return {
            "recommendations": recommendations,
            "risk_assessment": risk_assessment,
            "anomalies": anomalies,
            "overall_intelligence": overall_intelligence,
        }

    def _determine_system_status(self, risk_assessment: Dict, recommendations: List, anomalies: List) -> str:
        """
        حكم نهائي على حالة النظام
        """
        # Critical if there are critical anomalies
        critical_anomalies = len([a for a in anomalies if a.get("severity") == "critical"])
        if critical_anomalies > 0:
            return "CRITICAL - تدخل فوري مطلوب"

        # Critical if risk is high
        if risk_assessment.get("level") == "critical":
            return "CRITICAL - مخاطر حرجة"

        # Warning if there are urgent recommendations
        urgent_recs = len([r for r in recommendations if r.severity == "urgent"])
        if urgent_recs > 0:
            return "WARNING - تدخل مطلوب قريباً"

        # High alert if risk is high
        if risk_assessment.get("level") == "high":
            return "HIGH_ALERT - مراقبة مكثفة مطلوبة"

        # Normal if moderate risk
        if risk_assessment.get("level") == "moderate":
            return "NORMAL - النظام يعمل بشكل عام"

        # Good if low risk or safe
        return "GOOD - جميع الأنظمة تعمل بشكل مثالي"
