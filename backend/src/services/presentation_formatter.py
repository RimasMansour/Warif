# backend/src/services/presentation_formatter.py
"""
Presentation Formatter - Transforms technical telemetry into intuitive insights for end-users.
Translates complex metrics and model outputs into actionable advice.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class AlertPresentation:
    """Persisted alert presentation schema for end-user UI display"""
    icon: str  # Icon visual representation (e.g., 🚨, ⚠️, 🔔)
    title: str  # Main title header
    severity: str  # "critical" | "warning" | "info"

    # Core Metrics
    current_value: str  # Actual current value (e.g., "Soil Moisture: 25%")
    expected_value: str  # Target optimal boundary (e.g., "Acceptable Range: 40-70%")
    difference: str  # Deviation delta (e.g., "15% below threshold")

    # Action Plan
    action: str  # Actionable corrective advice
    urgency: str  # Response urgency level

    # Contextual metadata
    reason: Optional[str] = None  # Contextual reasoning explaining criticality
    timestamp: Optional[str] = None


@dataclass
class RecommendationPresentation:
    """Recommendation presentation schema for end-user UI display"""
    icon: str  # Icon visual representation (e.g., 💡, 📈, 🎯)
    title: str  # Main title header

    # Diagnostic Insight
    data_insight: str  # Analytical data insight message
    reason: str  # Underlying reasoning explaining context

    # Proposed Action
    suggestion: str  # Actionable advice suggestion
    timing: str  # Suggested execution window

    # Operational Metadata
    benefit: Optional[str] = None  # Expected outcome or utility benefit
    priority: str = "normal"  # "high" | "normal" | "low"
    category: str = "general"  # "irrigation" | "cooling" | "health"


class PresentationFormatter:
    """
    Presentation Formatter Engine.
    Converts raw database metrics and model decisions into clean, formatted UI assets.
    """

    # UI visual icons mapping
    ICONS = {
        'critical': '🚨',
        'warning': '⚠️',
        'info': '🔔',
        'insight': '💡',
        'good': '✅',
        'improvement': '📈',
    }

    # Optimal microclimate ranges for target crop (tomatoes by default)
    OPTIMAL_RANGES = {
        'soil_moisture': {'min': 55, 'max': 70, 'unit': '%'},
        'air_temperature': {'min': 18, 'max': 27, 'unit': '°C'},
        'air_humidity': {'min': 60, 'max': 85, 'unit': '%'},
        'soil_temperature': {'min': 18, 'max': 28, 'unit': '°C'},
    }

    # Human-friendly alert templates
    ALERT_MESSAGES = {
        'drought': {
            'title': 'ري ناقص - رطوبة التربة منخفضة جداً',
            'action': 'قم بتفعيل الري الآن',
            'urgency': 'فوري',
            'reason': 'النبات يحتاج للماء لتجنب الإجهاد المائي والذبول',
        },
        'flooding': {
            'title': 'ري مفرط - رطوبة التربة عالية جداً',
            'action': 'أوقف الري واترك التصريف',
            'urgency': 'فوري',
            'reason': 'الإفراط في الماء يسبب تعفن الجذور والأمراض الفطرية',
        },
        'heat_stress': {
            'title': 'حرارة خطيرة - درجة الحرارة مرتفعة جداً',
            'action': 'شغل المراوح والتهوية الآن',
            'urgency': 'فوري',
            'reason': 'الحرارة الزائدة تسبب جفاف النبات وموته',
        },
        'cold_stress': {
            'title': 'برودة شديدة - درجة الحرارة منخفضة',
            'action': 'قلل الري وراقب درجة الحرارة',
            'urgency': 'خلال ساعة',
            'reason': 'البرودة تبطئ امتصاص النبات للعناصر الغذائية',
        },
        'high_humidity': {
            'title': 'رطوبة عالية - خطر الأمراض الفطرية',
            'action': 'زد التهوية والتبريد بالمراوح',
            'urgency': 'فوري',
            'reason': 'الرطوبة الزائدة تزيد خطر الأمراض الفطرية بنسبة 80%',
        },
        'low_humidity': {
            'title': 'رطوبة منخفضة - جفاف الهواء',
            'action': 'فعل نظام الرش أو الترطيب',
            'urgency': 'خلال ساعتين',
            'reason': 'الجفاف الشديد يسبب جفاف الأوراق والزهور',
        },
        'anomaly_detected': {
            'title': 'قراءة غير طبيعية - خلل في الحساس',
            'action': 'تحقق من الحساس - قد يكون معطل',
            'urgency': 'فوري',
            'reason': 'قد يؤدي لقرارات خاطئة إذا لم يتم التحقق',
        },
        'disease_risk': {
            'title': 'خطر الأمراض الفطرية - ظروف ملائمة للانتشار',
            'action': 'زد التهوية وقلل الرطوبة',
            'urgency': 'خلال ساعة',
            'reason': 'الأمراض الفطرية تنتشر بسرعة وتدمر المحصول',
        },
    }

    RECOMMENDATION_MESSAGES = {
        'increase_irrigation': {
            'title': '💡 زيادة الري تدريجياً',
            'insight': 'رطوبة التربة قريبة من الحد الأدنى المقبول',
            'suggestion': 'أضف فترة ري إضافية كل يومين',
            'benefit': 'الحفاظ على إنتاجية المحصول ونوعيته',
            'timing': 'خلال 24 ساعة',
        },
        'decrease_irrigation': {
            'title': '💡 تقليل الري',
            'insight': 'رطوبة التربة فوق المستوى المثالي',
            'suggestion': 'قلل عدد فترات الري أو مدتها',
            'benefit': 'توفير المياه وتقليل خطر الأمراض',
            'timing': 'خلال الري القادم',
        },
        'improve_ventilation': {
            'title': '💡 تحسين التهوية',
            'insight': 'الرطوبة مرتفعة والحرارة عالية',
            'suggestion': 'شغل المراوح بشكل مستمر',
            'benefit': 'تقليل الأمراض الفطرية والحفاظ على النبات',
            'timing': 'على الفور',
        },
        'monitor_carefully': {
            'title': '💡 مراقبة مكثفة',
            'insight': 'النظام قريب من الحدود المثالية',
            'suggestion': 'تفقد المزرعة كل ساعتين',
            'benefit': 'التدخل السريع قبل حدوث مشاكل',
            'timing': 'الآن وحتى تحسن الحالة',
        },
        'optimize_schedule': {
            'title': '💡 تحسين جدول الري',
            'insight': 'أعلى احتياج للماء يحدث بين 1-4 ظهراً',
            'suggestion': 'زيادة فترات الري في هذا الوقت',
            'benefit': 'توزيع أفضل للماء وتقليل الهدر',
            'timing': 'من غد الصباح',
        },
    }

    def _generate_specific_reason(self, alert_type: str, device_name: Optional[str] = None, sensor_name: Optional[str] = None) -> str:
        """Generates a detailed, context-aware explanation citing the specific device"""
        device_info = f"({device_name})" if device_name else ""

        reason_map = {
            'drought': f'حساس الرطوبة {device_info} يشير إلى جفاف التربة - النبات يحتاج للماء فوراً',
            'flooding': f'حساس الرطوبة {device_info} يشير إلى إفراط في الماء - قد تحدث مشاكل في الجذور',
            'heat_stress': f'حساس الحرارة {device_info} يسجل درجة حرارة خطيرة - الحرارة الزائدة تضر النبات',
            'cold_stress': f'حساس الحرارة {device_info} يسجل برودة شديدة - قد تبطئ امتصاص النبات للغذاء',
            'high_humidity': f'حساس الرطوبة {device_info} يشير إلى رطوبة عالية جداً - خطر الأمراض الفطرية مرتفع',
            'low_humidity': f'حساس الرطوبة {device_info} يشير إلى جفاف الهواء - قد تجف الأوراق',
            'anomaly_detected': f'الحساس {device_info} يسجل قراءة غير طبيعية - قد يكون الحساس معطلاً أو هناك عطل',
            'disease_risk': f'الظروف المسجلة {device_info} مثالية لتكاثر الأمراض - ارتفاع الرطوبة والحرارة الملائمة',
        }

        return reason_map.get(alert_type, 'هناك تنبيه في النظام يحتاج للمراجعة')

    def format_alert(self,
                    alert_type: str,
                    current_value: Optional[float] = None,
                    sensor_name: Optional[str] = None,
                    device_name: Optional[str] = None,
                    current_str: Optional[str] = None,
                    expected_str: Optional[str] = None,
                    difference_str: Optional[str] = None) -> AlertPresentation:
        """
        Converts a raw technical alert record into a formatted end-user display card.
        """

        template = self.ALERT_MESSAGES.get(alert_type, {})

        # Generate a detailed diagnostic message citing the specific device
        specific_reason = self._generate_specific_reason(alert_type, device_name, sensor_name)

        return AlertPresentation(
            icon=template.get('icon', self.ICONS['warning']),
            title=template.get('title', f'تنبيه: {sensor_name}'),
            severity=self._get_severity(alert_type),
            current_value=current_str or f'{sensor_name}: {current_value}',
            expected_value=expected_str or 'الحد المقبول: --',
            difference=difference_str or '--',
            action=template.get('action', 'راقب الوضع'),
            urgency=template.get('urgency', 'خلال ساعة'),
            reason=specific_reason,
            timestamp=datetime.now().strftime('%H:%M'),
        )

    def format_recommendation(self,
                            rec_type: str,
                            data_insight: Optional[str] = None,
                            category: str = 'general') -> RecommendationPresentation:
        """
        Formats raw ML ensemble and engine recommendations into structured UI assets.
        """

        template = self.RECOMMENDATION_MESSAGES.get(rec_type, {})

        return RecommendationPresentation(
            icon=self.ICONS['insight'],
            title=template.get('title', 'توصية'),
            data_insight=data_insight or template.get('insight', ''),
            reason=template.get('insight', ''),
            suggestion=template.get('suggestion', ''),
            benefit=template.get('benefit'),
            timing=template.get('timing', 'قريباً'),
            priority=self._get_priority(rec_type),
            category=category,
        )

    def _get_severity(self, alert_type: str) -> str:
        """Determines alert criticality based on target category"""
        critical_alerts = ['heat_stress', 'flooding', 'anomaly_detected', 'disease_risk']
        if alert_type in critical_alerts:
            return 'critical'
        return 'warning'

    def _get_priority(self, rec_type: str) -> str:
        """Determines recommendation action priority"""
        high_priority = ['improve_ventilation', 'decrease_irrigation', 'optimize_schedule']
        if rec_type in high_priority:
            return 'high'
        return 'normal'

    def format_soil_moisture_alert(self, current: float, optimal_min: float, optimal_max: float) -> AlertPresentation:
        """Generates customized UI presentation card for soil moisture anomalies"""
        diff_from_min = current - optimal_min
        diff_from_max = optimal_max - current

        if current < optimal_min:
            difference = f"أقل من الحد بـ {optimal_min - current:.0f}%"
            alert_type = 'drought'
        elif current > optimal_max:
            difference = f"أعلى من الحد بـ {current - optimal_max:.0f}%"
            alert_type = 'flooding'
        else:
            return AlertPresentation(
                icon=self.ICONS['good'],
                title='✅ رطوبة التربة مثالية',
                severity='info',
                current_value=f'رطوبة التربة: {current:.0f}%',
                expected_value=f'الحد المثالي: {optimal_min:.0f}% - {optimal_max:.0f}%',
                difference='في النطاق المثالي',
                action='استمر في الروتين الحالي',
                urgency='لا إجراء مطلوب',
                timestamp=datetime.now().strftime('%H:%M'),
            )

        return self.format_alert(
            alert_type=alert_type,
            current_str=f'رطوبة التربة الحالية: {current:.0f}%',
            expected_str=f'الحد المثالي: {optimal_min:.0f}% - {optimal_max:.0f}%',
            difference_str=difference,
        )

    def format_temperature_alert(self, current: float) -> AlertPresentation:
        """Generates customized UI presentation card for air temperature anomalies"""
        optimal_min, optimal_max = 18, 27

        if current > 38:
            alert_type = 'heat_stress'
            difference = f"أعلى من الحد الحرج بـ {current - 38:.1f}°C"
        elif current > 32:
            alert_type = 'heat_stress'
            difference = f"مرتفعة عن المثالي بـ {current - optimal_max:.1f}°C"
        elif current < 10:
            alert_type = 'cold_stress'
            difference = f"أقل من الحد الأدنى الآمن بـ {10 - current:.1f}°C"
        elif current < 18:
            alert_type = 'cold_stress'
            difference = f"منخفضة عن المثالي بـ {optimal_min - current:.1f}°C"
        else:
            return AlertPresentation(
                icon=self.ICONS['good'],
                title='✅ درجة الحرارة مثالية',
                severity='info',
                current_value=f'درجة الحرارة: {current:.1f}°C',
                expected_value=f'الحد المثالي: {optimal_min}°C - {optimal_max}°C',
                difference='في النطاق المثالي',
                action='استمر في التشغيل الحالي',
                urgency='لا إجراء مطلوب',
                timestamp=datetime.now().strftime('%H:%M'),
            )

        return self.format_alert(
            alert_type=alert_type,
            current_str=f'درجة الحرارة الحالية: {current:.1f}°C',
            expected_str=f'الحد المثالي: {optimal_min}°C - {optimal_max}°C',
            difference_str=difference,
        )

    def format_humidity_alert(self, current: float) -> AlertPresentation:
        """Generates customized UI presentation card for relative air humidity anomalies"""
        optimal_min, optimal_max = 60, 85

        if current > 90:
            alert_type = 'high_humidity'
            difference = f"أعلى من الحد بـ {current - 90:.0f}%"
        elif current > 85:
            alert_type = 'high_humidity'
            difference = f"أعلى من المثالي بـ {current - optimal_max:.0f}%"
        elif current < 30:
            alert_type = 'low_humidity'
            difference = f"أقل من الحد الأدنى الآمن بـ {30 - current:.0f}%"
        elif current < 60:
            alert_type = 'low_humidity'
            difference = f"منخفضة عن المثالي بـ {optimal_min - current:.0f}%"
        else:
            return AlertPresentation(
                icon=self.ICONS['good'],
                title='✅ رطوبة الهواء مثالية',
                severity='info',
                current_value=f'رطوبة الهواء: {current:.0f}%',
                expected_value=f'الحد المثالي: {optimal_min}% - {optimal_max}%',
                difference='في النطاق المثالي',
                action='الأنظمة تعمل بشكل طبيعي',
                urgency='لا إجراء مطلوب',
                timestamp=datetime.now().strftime('%H:%M'),
            )

        return self.format_alert(
            alert_type=alert_type,
            current_str=f'رطوبة الهواء الحالية: {current:.0f}%',
            expected_str=f'الحد المثالي: {optimal_min}% - {optimal_max}%',
            difference_str=difference,
        )
