# backend/src/services/decision_engine.py
"""
Warif Digital Twin Decision Engine
عقل التوأم الرقمي الذكي - يرى، يفكر، يحلل، ويقرر
"""

import os
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple

from src.services.climate_control_policy import evaluate_climate_control

logger = logging.getLogger(__name__)
RIYADH_TZ = ZoneInfo("Asia/Riyadh")
NIGHT_IRRIGATION_CRITICAL_SOIL = 25.0

# Module-level singleton — shared by sensors, physics simulator, ml routes, etc.
_engine_instance: Optional["SmartDecisionEngine"] = None

def get_engine() -> "SmartDecisionEngine":
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = SmartDecisionEngine()
    return _engine_instance


def _is_irrigation_night(weather: Dict) -> bool:
    if "is_day" in weather and weather.get("is_day") is not None:
        return int(weather.get("is_day") or 0) == 0
    hour = datetime.now(RIYADH_TZ).hour
    return hour >= 18 or hour < 6


def _irrigation_safety_context(soil_moisture: Optional[float], weather: Dict) -> Dict:
    is_night = _is_irrigation_night(weather)
    is_critical = soil_moisture is not None and soil_moisture < NIGHT_IRRIGATION_CRITICAL_SOIL
    return {
        "blocked": is_night and not is_critical,
        "is_night": is_night,
        "critical_override": is_night and is_critical,
        "reason": "ليل - خطر أمراض فطرية" if is_night and not is_critical else "",
        "critical_soil_moisture": NIGHT_IRRIGATION_CRITICAL_SOIL,
    }


@dataclass
class SmartRecommendation:
    message: str
    reasoning: str
    category: str      # "irrigation" | "temperature" | "humidity" | "soil"
    severity: str      # "normal" | "warning" | "urgent"
    confidence: float  # 0.0 to 1.0
    execution_action: Optional[Dict] = None
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

    # Category styling: color, icon, border for UI consistency
    CATEGORY_STYLES = {
        "irrigation": {
            "color": "bg-blue-50/20",
            "border": "border-blue-100/60",
            "text": "text-blue-700",
            "iconBg": "bg-blue-100 text-blue-600 border-blue-200/50",
            "actionBg": "bg-blue-50/50",
            "actionBorder": "border-blue-100/50",
            "actionText": "text-blue-800",
        },
        "temperature": {
            "color": "bg-amber-50/20",
            "border": "border-amber-100/60",
            "text": "text-amber-700",
            "iconBg": "bg-amber-100 text-amber-600 border-amber-200/50",
            "actionBg": "bg-amber-50/50",
            "actionBorder": "border-amber-100/50",
            "actionText": "text-amber-800",
        },
        "humidity": {
            "color": "bg-slate-50/50",
            "border": "border-slate-200/50",
            "text": "text-slate-600",
            "iconBg": "bg-slate-50 text-slate-500 border-slate-100/50",
            "actionBg": "bg-slate-50/40",
            "actionBorder": "border-slate-100/50",
            "actionText": "text-slate-700",
        },
        "soil": {
            "color": "bg-amber-50/50",
            "border": "border-amber-200/50",
            "text": "text-amber-600",
            "iconBg": "bg-amber-50 text-amber-500 border-amber-100/50",
            "actionBg": "bg-amber-50/40",
            "actionBorder": "border-amber-100/50",
            "actionText": "text-amber-700",
        },
        "general": {
            "color": "bg-emerald-50/20",
            "border": "border-emerald-100/60",
            "text": "text-emerald-700",
            "iconBg": "bg-emerald-100 text-emerald-600 border-emerald-200/50",
            "actionBg": "bg-emerald-50/50",
            "actionBorder": "border-emerald-100/50",
            "actionText": "text-emerald-800",
        },
    }

    # Class-level cache to prevent duplicate recommendations
    # Key: (farm_id, category) -> Value: (message, severity, timestamp)
    _rec_cache: Dict[Tuple[int, str], Tuple[str, str, datetime]] = {}

    # Weather cache shared across all instances — refreshed every 5 minutes
    _weather_cache: Dict = {}
    _weather_fetched_at: Optional[datetime] = None
    _WEATHER_TTL_SECONDS = 300

    def _hold_action_contract(self, domain: str, reason: str, targets: Optional[Dict] = None) -> Dict:
        return {
            "domain": domain,
            "action": "hold",
            "actuators": {},
            "source": "decision_engine",
            "confidence": 0.0,
            "reason": reason,
            "targets": targets or {},
            "safety": {},
            "should_execute": False,
        }

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

        # Load ML ensemble once at startup; None means rule-based fallback is used
        self._ensemble = self._load_ensemble()

    async def fetch_weather(self) -> dict:
        """Fetch real weather from open-meteo — cached for 5 minutes."""
        now = datetime.now(timezone.utc)
        if (
            SmartDecisionEngine._weather_fetched_at is not None
            and (now - SmartDecisionEngine._weather_fetched_at).total_seconds() < SmartDecisionEngine._WEATHER_TTL_SECONDS
            and SmartDecisionEngine._weather_cache
        ):
            return SmartDecisionEngine._weather_cache
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
                SmartDecisionEngine._weather_cache = {
                    "ext_temp": data["temperature_2m"],
                    "ext_humidity": data["relative_humidity_2m"],
                    "cloudcover": data["cloudcover"],
                    "is_day": data["is_day"],
                }
                SmartDecisionEngine._weather_fetched_at = now
                return SmartDecisionEngine._weather_cache
        except Exception as e:
            logger.warning(f"Weather fetch failed: {e}")
            return SmartDecisionEngine._weather_cache or {}

    def _load_ensemble(self):
        """Load ML ensemble once at startup. Returns None if models are not available."""
        candidates = [
            os.getenv("WARIF_MODELS_DIR", ""),
            os.path.join(os.getcwd(), "src", "ml", "saved_models"),
            os.path.join(os.getcwd(), "src", "ml", "models"),
        ]
        models_dir = next((d for d in candidates if d and os.path.isdir(d)), None)
        if not models_dir:
            logger.info("ML ensemble models not found — using rule-based fallback")
            return None
        try:
            import sys
            if "." not in sys.path:
                sys.path.insert(0, ".")
            from src.ml.continual_learning import WarifEnsemble
            ensemble = WarifEnsemble(models_dir)
            logger.info(f"ML ensemble loaded from {models_dir}")
            return ensemble
        except Exception as e:
            logger.info(f"ML ensemble unavailable ({e}) — using rule-based fallback")
            return None

    def run_ml_prediction(self, sensor_data: dict) -> Optional[dict]:
        """Run the Warif ensemble ML model (Random Forest + XGBoost + LSTM)"""
        if self._ensemble is None:
            return None
        try:
            import math
            air_temp = sensor_data.get("air_temperature", 28.0)
            humidity = sensor_data.get("air_humidity", 60.0)
            svp = 0.6108 * math.exp(17.27 * air_temp / (air_temp + 237.3))
            vpd_kpa = round(svp * (1 - humidity / 100), 3)

            features = {
                "soil_moisture":         sensor_data.get("soil_moisture", 50.0),
                "soil_temp":             sensor_data.get("soil_temperature", 25.0),
                "soil_ph":               6.4,
                "soil_ec":               1.8,
                "air_temp":              air_temp,
                "humidity":              humidity,
                "co2_ppm":               700.0,
                "vpd_kpa":               vpd_kpa,
                "growth_stage_encoded":  3,
                "days_since_transplant": 30,
            }
            return self._ensemble.predict(features)
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

        hour = datetime.now(RIYADH_TZ).hour
        crop_type = (sensor_data.get("crop_type") or "tomatoes").lower()
        if crop_type in ["cucumber", "خيار"]:
            optimal_min, optimal_max = 70, 80
        elif crop_type in ["tomatoes", "طماطم"]:
            optimal_min, optimal_max = 60, 70
        else:
            optimal_min, optimal_max = 55, 75

        # ─── IRRIGATION DECISION ──────────────────────────────────────────
        if soil_moisture is not None:
            # Build weighted score
            ml_vote = 0.0
            if ml_result:
                ml_vote = ml_result["ensemble_pred"] * ml_result["confidence"] * 0.50

            # Tomato optimal: 60-70%, Cucumber: 70-80%
            if soil_moisture < optimal_min - 15:
                soil_vote = 0.9 * 0.25   # critically dry
            elif soil_moisture < optimal_min:
                soil_vote = 0.6 * 0.25   # below optimal
            elif soil_moisture > optimal_max + 10:
                soil_vote = -0.5 * 0.25  # oversaturated
            elif soil_moisture > optimal_max:
                soil_vote = -0.2 * 0.25  # slightly wet
            else:
                soil_vote = 0.0 * 0.25   # optimal range

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
            irrigation_safety = _irrigation_safety_context(soil_moisture, weather)

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

            # Hard overrides for critically extreme soil moisture — bypass scoring math
            if soil_moisture >= 90:
                sev = "urgent" if soil_moisture >= 95 else "warning"
                recommendations.append(SmartRecommendation(
                    message="إيقاف الري فوراً",
                    reasoning=f"رطوبة التربة ({soil_moisture:.0f}%) بلغت مستوى حرجاً يتجاوز الحد الآمن. الإجراء: إيقاف الري فوراً وتحسين تصريف المياه لتجنب تعفن الجذور وحماية المحصول.",
                    category="irrigation",
                    severity=sev,
                    confidence=0.95,
                ))
            elif soil_moisture < 25:
                recommendations.append(SmartRecommendation(
                    message="ري طارئ مطلوب",
                    reasoning=f"رطوبة التربة ({soil_moisture:.0f}%) انخفضت إلى مستوى حرج جداً قد يسبب إجهاداً شديداً للنبات. الإجراء: تفعيل الري الفوري لحماية المحصول.",
                    category="irrigation",
                    severity="urgent",
                    confidence=0.97,
                ))
            elif irrigation_safety["blocked"] and (score > 0.5 or soil_moisture < optimal_min):
                recommendations.append(SmartRecommendation(
                    message="تأجيل الري حتى الصباح",
                    reasoning=(
                        f"رطوبة التربة ({soil_moisture:.0f}%) أقل من المستوى المثالي، "
                        "لكن الوقت الحالي فترة ليلية، وقد يزيد الري الآن خطر الأمراض الفطرية. "
                        f"التوصية: تأجيل الري حتى الصباح، إلا إذا انخفضت رطوبة التربة إلى أقل من {NIGHT_IRRIGATION_CRITICAL_SOIL:.0f}%."
                    ),
                    category="irrigation",
                    severity="normal",
                    confidence=0.86,
                ))
            elif score > 0.5 and soil_moisture < optimal_min:
                severity = "urgent" if score > 0.75 else "warning"
                if score > 0.75:
                    message = "تفعيل الري الفوري"
                    rec_text = (
                        f"رطوبة التربة الحالية ({soil_moisture:.0f}%) أقل من النطاق المناسب للمحصول "
                        f"({optimal_min:.0f}-{optimal_max:.0f}%). الإجراء: تشغيل الري فوراً عند توفر الماء "
                        "وشروط السلامة لتقليل إجهاد النبات."
                    )
                else:
                    message = "زيادة تكرار الري"
                    rec_text = (
                        f"رطوبة التربة الحالية ({soil_moisture:.0f}%) أقل من النطاق المناسب للمحصول "
                        f"({optimal_min:.0f}-{optimal_max:.0f}%). الإجراء: تشغيل ري قصير ومراقبة استجابة التربة "
                        "حتى ترتفع الرطوبة إلى هذا النطاق بدون تشبع."
                    )

                if ml_result:
                    recommendation_conf = ml_result.get("confidence", 0.65)
                else:
                    recommendation_conf = min(abs(score) + 0.15, 0.85)

                recommendations.append(SmartRecommendation(
                    message=message,
                    reasoning=rec_text,
                    category="irrigation",
                    severity="normal" if severity == "warning" else severity,
                    confidence=max(0.50, min(0.95, recommendation_conf)),
                ))
            elif score < -0.2:
                recommendations.append(SmartRecommendation(
                    message="تقليل تكرار الري",
                    reasoning=f"رطوبة التربة الحالية ({soil_moisture:.0f}%) أعلى من المستوى المناسب للمحصول (80%). التوصية: تقليل تكرار الري لتوفير المياه وتجنب تعفن الجذور.",
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

            # Hard overrides based on raw indoor temperature — outdoor blending
            # must not mask critically hot or cold readings inside the greenhouse.
            if air_temperature >= 36:
                recommendations.append(SmartRecommendation(
                    message="تفعيل نظام التبريد الطارئ",
                    reasoning=f"درجة الحرارة الداخلية ({air_temperature:.0f}°C) تجاوزت الحد الحرج. الإجراء: تشغيل أنظمة التبريد فوراً وتعزيز التهوية للحد من الإجهاد الحراري وحماية المحصول.",
                    category="temperature",
                    severity="urgent",
                    confidence=0.95,
                ))
            elif air_temperature >= 30:
                conf = 0.82 if ext_temp and ext_temp > 28 else 0.75
                recommendations.append(SmartRecommendation(
                    message="تحسين التهوية والتبريد",
                    reasoning=(
                        f"درجة الحرارة الداخلية ({air_temperature:.1f}°C) أعلى من نطاق الراحة المستهدف "
                        "(حتى 28°C). التوصية: تحسين تدفق الهواء، وتشغيل التبريد فقط إذا استمرت الحرارة "
                        "بالارتفاع أو تجاوزت حد التشغيل."
                    ),
                    category="temperature",
                    severity="warning",
                    confidence=conf,
                ))
            elif air_temperature <= 12:
                recommendations.append(SmartRecommendation(
                    message="تفعيل نظام التدفئة",
                    reasoning=f"درجة الحرارة الداخلية ({air_temperature:.0f}°C) انخفضت عن الحد الأدنى (15°C). الإجراء: تشغيل التدفئة تدريجياً لتجنب صدمة حرارية للنبات.",
                    category="temperature",
                    severity="warning",
                    confidence=0.84,
                ))
            elif combined_temp > 38 and cloudcover < 20:
                # Combined (indoor+outdoor) confirms extreme heat under clear sky
                recommendations.append(SmartRecommendation(
                    message="تفعيل نظام التبريد الطارئ",
                    reasoning=f"مؤشر الحرارة داخل المحمية ({combined_temp:.0f}°C) تجاوز الحد الحرج، كما أن صفاء السماء يزيد الضغط الحراري. الإجراء: تشغيل أنظمة التبريد فوراً.",
                    category="temperature",
                    severity="urgent",
                    confidence=0.93,
                ))
            elif combined_temp > 33:
                conf = 0.82 if ext_temp and ext_temp > 30 else 0.75
                recommendations.append(SmartRecommendation(
                    message="تحسين التهوية والتبريد",
                    reasoning=(
                        f"مؤشر الحرارة داخل المحمية ({combined_temp:.1f}°C) أعلى من النطاق المريح للمحصول. "
                        "التوصية: تحسين التهوية ومراقبة استجابة الحرارة قبل رفع مستوى التبريد."
                    ),
                    category="temperature",
                    severity="warning",
                    confidence=conf,
                ))
            # لا نضيف توصية إذا كانت درجة الحرارة مثالية

        # ─── HUMIDITY DECISION ────────────────────────────────────────────
        if air_humidity is not None:
            parts = [f"رطوبة الهواء {air_humidity:.0f}%"]
            if ext_humidity is not None:
                parts.append(f"رطوبة خارجية {ext_humidity:.0f}%")

            if air_humidity > 85:
                severity = "urgent" if (ext_humidity or 0) > 80 else "warning"
                if severity == "urgent":
                    msg = "تهوية طارئة مطلوبة"
                    rec_text = f"رطوبة الهواء داخل المحمية ({air_humidity:.0f}%) وخارجها ({ext_humidity or 0:.0f}%) مرتفعة جداً. الإجراء: تعزيز التهوية فوراً لتقليل خطر الأمراض الفطرية."
                else:
                    msg = "زيادة التهوية"
                    rec_text = f"رطوبة الهواء الحالية ({air_humidity:.0f}%) أعلى من الحد المثالي (60-70%). التوصية: تحسين التهوية لتقليل خطر الأمراض الفطرية."
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
                    reasoning=f"رطوبة الهواء الحالية ({air_humidity:.0f}%) أقل بكثير من الحد الأدنى (40%). التوصية: تفعيل نظام الترطيب لرفع الرطوبة وتجنب الإجهاد المائي للنبات.",
                    category="humidity",
                    severity="normal",
                    confidence=0.80,
                ))
            # لا نضيف توصية إذا كانت الرطوبة مثالية

        # ─── SOIL TEMPERATURE ────────────────────────────────────────────
        if soil_temperature is not None:
            if soil_temperature > 35:
                action = None
                action_text = "استخدام التظليل أو تغطية التربة"
                execution_action = self._hold_action_contract(
                    "soil",
                    "حرارة التربة مرتفعة، لكن القراءات الحالية لا تحدد أمر جهاز مباشر آمن الآن.",
                )
                if air_temperature is not None and air_temperature >= 30:
                    action = "climate"
                    action_text = "تشغيل التبريد والتهوية لتخفيف الحرارة المحيطة بالتربة"
                    execution_action = self._build_climate_action_contract(
                        air_temperature=air_temperature,
                        air_humidity=air_humidity,
                    )
                elif (
                    soil_moisture is not None
                    and soil_moisture < optimal_min
                    and not _irrigation_safety_context(soil_moisture, weather).get("blocked")
                ):
                    action = "irrigation"
                    action_text = "تشغيل ري قصير وآمن لرفع رطوبة التربة والمساعدة في خفض حرارتها"
                    execution_action = self._build_irrigation_action_contract(
                        should_irrigate=True,
                        soil_moisture=soil_moisture,
                        optimal_min=optimal_min,
                        optimal_max=optimal_max,
                        score=0.65,
                        confidence=0.78,
                        ml_available=False,
                        reason=f"حرارة التربة {soil_temperature:.1f}°C ورطوبة التربة {soil_moisture:.0f}%",
                        safety_context=_irrigation_safety_context(soil_moisture, weather),
                    )

                recommendations.append(SmartRecommendation(
                    message="تحسين حماية التربة من الحرارة",
                    reasoning=(
                        f"درجة حرارة التربة الحالية ({soil_temperature:.1f}°C) مرتفعة جداً وقد تقلل قدرة الجذور "
                        f"على امتصاص العناصر الغذائية. الإجراء المناسب: {action_text}."
                    ),
                    category="soil",
                    severity="warning",
                    confidence=0.82,
                    execution_action=execution_action,
                ))
            elif soil_temperature < 10:
                recommendations.append(SmartRecommendation(
                    message="تقليل الري أثناء انخفاض حرارة التربة",
                    reasoning=f"درجة حرارة التربة الحالية ({soil_temperature:.1f}°C) منخفضة جداً وتبطئ النشاط الميكروبي. التوصية: تقليل تكرار الري لتجنب تعفن الجذور.",
                    category="soil",
                    severity="warning",
                    confidence=0.79,
                    execution_action=self._hold_action_contract(
                        "soil",
                        "حرارة التربة منخفضة ولا يوجد جهاز تدفئة تربة مرتبط حاليًا؛ يتم تقليل/تأجيل الري فقط عند الحاجة.",
                    ),
                ))

        # NOTE: Removed the filter that was deleting all recommendations!
        # All recommendations (normal/warning/urgent) should be returned for display in UI
        # 'warning' and 'urgent' are ALSO shown in the Decision Support page, not just alerts

        # If no issues found, return a "Healthy Status" recommendation
        if not recommendations:
            status_parts = []
            if soil_moisture is not None:
                status_parts.append(f"رطوبة التربة {soil_moisture:.0f}%")
            if air_temperature is not None:
                status_parts.append(f"حرارة {air_temperature:.0f}°م")
            if air_humidity is not None:
                status_parts.append(f"رطوبة {air_humidity:.0f}%")
            status_detail = f": {', '.join(status_parts)}" if status_parts else "."
            recommendations.append(SmartRecommendation(
                message="النظام يعمل بشكل مثالي",
                reasoning=f"جميع المؤشرات ضمن النطاق المثالي{status_detail}",
                category="general",
                severity="normal",
                confidence=0.95,
            ))

        return recommendations

    def _build_irrigation_action_contract(
        self,
        *,
        should_irrigate: bool,
        soil_moisture: Optional[float],
        optimal_min: float,
        optimal_max: float,
        score: float,
        confidence: float,
        ml_available: bool,
        reason: str,
        safety_context: Optional[Dict] = None,
    ) -> Dict:
        safety_context = safety_context or {}
        if should_irrigate:
            action = "start"
        elif soil_moisture is not None and soil_moisture >= optimal_max:
            action = "stop"
        else:
            action = "hold"

        if action == "start" and safety_context.get("blocked"):
            action = "hold"
            reason = f"{reason} | irrigation blocked: {safety_context.get('reason')}"

        source = "ml" if ml_available else "rules_fallback"
        return {
            "domain": "irrigation",
            "action": action,
            "actuators": {"irrigation": action == "start"},
            "source": source,
            "confidence": confidence,
            "score": round(score, 3),
            "reason": reason,
            "targets": {
                "soil_moisture_min": optimal_min,
                "soil_moisture_max": optimal_max,
            },
            "safety": safety_context,
            "should_execute": action in {"start", "stop"},
        }

    def _build_climate_action_contract(
        self,
        *,
        air_temperature: Optional[float],
        air_humidity: Optional[float],
    ) -> Dict:
        policy = evaluate_climate_control(
            current_mode="stop",
            air_temperature=air_temperature,
            air_humidity=air_humidity,
            target_temperature=28.0,
            target_humidity=70.0,
            resume_cooling_humidity=65.0,
            ventilation_humidity=70.0,
        )
        action = "cooling_full" if policy["mode"] == "full" else policy["mode"]

        return {
            "domain": "climate",
            "action": action,
            "actuators": {
                "fan": action in {"cooling_full", "fan_only"},
                "cooler": action == "cooling_full",
            },
            "source": "rules_fallback",
            "confidence": 0.75,
            "reason": policy["reason"],
            "targets": policy["targets"],
            "should_execute": action in {"cooling_full", "fan_only", "stop"},
            "ml_available": False,
        }

    def _build_climate_policy_recommendation(
        self,
        *,
        decision: Dict,
        air_temperature: Optional[float],
        air_humidity: Optional[float],
    ) -> Optional[SmartRecommendation]:
        action = decision.get("action")
        if action not in {"cooling_full", "fan_only"}:
            return None

        targets = decision.get("targets") or {}
        temp_target = float(targets.get("air_temperature_max") or 28.0)
        hum_target = float(targets.get("air_humidity_max") or 70.0)
        ventilation_humidity = float(targets.get("ventilation_humidity") or 70.0)
        temp = float(air_temperature or 0.0)
        hum = float(air_humidity or 0.0)

        if hum >= ventilation_humidity and action == "fan_only":
            return SmartRecommendation(
                message="تحسين التهوية",
                reasoning=(
                    f"رطوبة الهواء داخل المحمية ({hum:.0f}%) أعلى من هدف التشغيل الآمن "
                    f"({hum_target:.0f}%). التوصية: تشغيل التهوية لتقليل الرطوبة وحماية المحصول "
                    "من مخاطر الأمراض الفطرية."
                ),
                category="humidity",
                severity="normal",
                confidence=0.78,
                execution_action=decision,
            )

        if temp > temp_target:
            action_text = "تشغيل التبريد والتهوية" if action == "cooling_full" else "تشغيل التهوية"
            return SmartRecommendation(
                message="تحسين التبريد والتهوية",
                reasoning=(
                    f"درجة الحرارة الداخلية ({temp:.1f}°C) أعلى من هدف التشغيل المناسب "
                    f"({temp_target:.0f}°C). التوصية: {action_text} حسب حاجة المحمية، مع متابعة "
                    "الرطوبة حتى تعود الحرارة إلى نطاق مستقر للمحصول."
                ),
                category="temperature",
                severity="normal",
                confidence=0.80,
                execution_action=decision,
            )

        return None

    def _build_irrigation_policy_recommendation(
        self,
        *,
        decision: Dict,
        soil_moisture: Optional[float],
    ) -> Optional[SmartRecommendation]:
        action = decision.get("action")
        targets = decision.get("targets") or {}
        optimal_min = float(targets.get("soil_moisture_min") or 60.0)
        optimal_max = float(targets.get("soil_moisture_max") or 70.0)
        moisture_text = f"{soil_moisture:.0f}%" if soil_moisture is not None else "غير متوفرة"
        confidence = max(0.50, min(0.95, float(decision.get("confidence") or 0.70)))

        if action == "start":
            return SmartRecommendation(
                message="تفعيل الري",
                reasoning=(
                    f"رطوبة التربة الحالية ({moisture_text}) أقل من النطاق المناسب "
                    f"({optimal_min:.0f}-{optimal_max:.0f}%). التوصية: تشغيل الري لاستعادة "
                    "رطوبة التربة المناسبة قبل أن يتأثر نمو النبات."
                ),
                category="irrigation",
                severity="normal",
                confidence=confidence,
                execution_action=decision,
            )

        if action == "stop" and soil_moisture is not None and soil_moisture >= optimal_max:
            return SmartRecommendation(
                message="إيقاف الري",
                reasoning=(
                    f"رطوبة التربة الحالية ({moisture_text}) وصلت إلى النطاق المناسب أو تجاوزته "
                    f"({optimal_min:.0f}-{optimal_max:.0f}%). التوصية: إيقاف الري لتجنب تشبع التربة "
                    "وتقليل خطر تعفن الجذور."
                ),
                category="irrigation",
                severity="normal",
                confidence=confidence,
                execution_action=decision,
            )

        safety = decision.get("safety") or {}
        if action == "hold" and safety.get("blocked"):
            return SmartRecommendation(
                message="تأجيل الري حتى الصباح",
                reasoning=(
                    f"رطوبة التربة الحالية ({moisture_text}) تحتاج إلى متابعة، لكن الري مؤجل حاليًا "
                    "بسبب شرط السلامة الليلي لتقليل خطر الأمراض الفطرية. التوصية: إعادة تقييم الري "
                    "صباحًا أو التدخل فقط إذا انخفضت الرطوبة إلى مستوى حرج."
                ),
                category="irrigation",
                severity="normal",
                confidence=confidence,
                execution_action=decision,
            )

        return None

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

        # Step 6: Compute irrigation_action and cooling_action for simulator use
        soil_moisture = sensor_data.get("soil_moisture")
        air_temperature = sensor_data.get("air_temperature") or 0
        air_humidity = sensor_data.get("air_humidity") or 0
        weather = await self.fetch_weather()
        irrigation_safety = _irrigation_safety_context(soil_moisture, weather)

        irr_score = 0.0
        irr_confidence = 0.65
        ml_actually_ran = False
        optimal_min, optimal_max = 60, 70
        irr_reason = "لا بيانات عن رطوبة التربة"
        if soil_moisture is not None:
            ml_result = self.run_ml_prediction(sensor_data)
            if ml_result:
                ml_actually_ran = True
                irr_score += ml_result["ensemble_pred"] * ml_result["confidence"] * 0.50
                irr_confidence = ml_result.get("confidence", 0.65)
            # Tomato optimal: 60-70%, Cucumber: 70-80%
            crop_type = (sensor_data.get("crop_type") or "tomatoes").lower()
            if crop_type in ["cucumber", "خيار"]:
                optimal_min, optimal_max = 70, 80
            elif crop_type in ["tomatoes", "طماطم"]:
                optimal_min, optimal_max = 60, 70
            else:
                optimal_min, optimal_max = 55, 75

            if soil_moisture < optimal_min - 15:
                irr_score += 0.9 * 0.25
            elif soil_moisture < optimal_min:
                irr_score += 0.6 * 0.25
            elif soil_moisture > optimal_max + 10:
                irr_score += -0.5 * 0.25
            elif soil_moisture > optimal_max:
                irr_score += -0.2 * 0.25
            else:
                irr_score += 0.0 * 0.25
            irr_score = max(-1.0, min(1.0, irr_score))
            irr_reason = f"رطوبة التربة {soil_moisture:.0f}%"

        ml_available = ml_actually_ran and irr_confidence > 0.1  # ML is working when confidence is meaningful
        _optimal_min = optimal_min if soil_moisture is not None else 60

        if ml_available:
            should_irrigate = irr_score > 0.60
        else:
            # Rule-based fallback (when ML unavailable)
            # Ref: FAO Paper 56 + Haifa Group Cucumber Guide
            if soil_moisture is not None and soil_moisture < 45:
                should_irrigate = True   # Critically dry - irrigate now
            elif soil_moisture is not None and soil_moisture < _optimal_min:
                should_irrigate = True   # Below optimal range - irrigate
            elif soil_moisture is not None and soil_moisture > optimal_max:
                should_irrigate = False  # Too wet - don't irrigate
            else:
                should_irrigate = False  # Optimal range or no data

        if should_irrigate and irrigation_safety["blocked"]:
            should_irrigate = False
            irr_reason = f"{irr_reason} | irrigation blocked: {irrigation_safety['reason']}"

        irrigation_action = {
            "should_irrigate": should_irrigate,
            "score": round(irr_score, 3),
            "confidence": irr_confidence,
            "ml_available": ml_available,
            "reason": irr_reason,
            "soil_threshold_used": 45 if not ml_available else _optimal_min,
        }
        irrigation_decision = self._build_irrigation_action_contract(
            should_irrigate=should_irrigate,
            soil_moisture=soil_moisture,
            optimal_min=_optimal_min,
            optimal_max=optimal_max,
            score=irr_score,
            confidence=irr_confidence,
            ml_available=ml_available,
            reason=irr_reason,
            safety_context=irrigation_safety,
        )
        irrigation_action.update(irrigation_decision)

        irrigation_rec = self._build_irrigation_policy_recommendation(
            decision=irrigation_decision,
            soil_moisture=soil_moisture,
        )
        if irrigation_rec and not any(rec.category == "irrigation" for rec in recommendations):
            recommendations.append(irrigation_rec)
            overall_intelligence["recommendation_count"] = len(recommendations)
            overall_intelligence["urgent_count"] = len([r for r in recommendations if r.severity == "urgent"])
            overall_intelligence["status"] = self._determine_system_status(
                risk_assessment,
                recommendations,
                anomalies,
            )

        cooling_action = {
            "should_cool": air_temperature > 32,
            "should_ventilate": air_humidity > 75,
        }
        climate_decision = self._build_climate_action_contract(
            air_temperature=air_temperature,
            air_humidity=air_humidity,
        )
        cooling_action.update(climate_decision)

        climate_rec = self._build_climate_policy_recommendation(
            decision=climate_decision,
            air_temperature=air_temperature,
            air_humidity=air_humidity,
        )
        if climate_rec and not any(rec.category == climate_rec.category for rec in recommendations):
            recommendations.append(climate_rec)
            overall_intelligence["recommendation_count"] = len(recommendations)
            overall_intelligence["urgent_count"] = len([r for r in recommendations if r.severity == "urgent"])
            overall_intelligence["status"] = self._determine_system_status(
                risk_assessment,
                recommendations,
                anomalies,
            )

        action_decisions = {
            "irrigation": irrigation_decision,
            "climate": climate_decision,
        }

        for rec in recommendations:
            if rec.execution_action:
                continue
            if rec.category == "irrigation":
                rec.execution_action = irrigation_decision
            elif rec.category == "temperature" and "تدفئة" not in rec.message:
                rec.execution_action = climate_decision
            elif rec.category == "humidity" and "ترطيب" not in rec.message:
                rec.execution_action = climate_decision
            else:
                rec.execution_action = self._hold_action_contract(
                    rec.category,
                    "هذه توصية متابعة ولا يوجد أمر جهاز مباشر مطلوب الآن.",
                )

        return {
            "recommendations": recommendations,
            "risk_assessment": risk_assessment,
            "anomalies": anomalies,
            "overall_intelligence": overall_intelligence,
            "irrigation_action": irrigation_action,
            "cooling_action": cooling_action,
            "action_decisions": action_decisions,
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
