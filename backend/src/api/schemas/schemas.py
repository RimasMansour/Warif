# backend/src/api/schemas/schemas.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Auth ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    farm_id:      Optional[int] = None
    username:     str = ""


# ── User ───────────────────────────────────────────────────────────────────

class UserRegisterIn(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    full_name: Optional[str] = Field(None, max_length=128)
    full_name_en: Optional[str] = Field(None, max_length=128)
    email:    str = Field(..., max_length=128)
    password: str = Field(..., min_length=6)
    language: Optional[str] = "ar"


class UserOut(BaseModel):
    id:         int
    username:   str
    full_name:  Optional[str] = None
    full_name_en: Optional[str] = None
    email:      str
    language:   str
    role:       str
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateIn(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=64)
    full_name: Optional[str] = Field(None, max_length=128)
    full_name_en: Optional[str] = Field(None, max_length=128)
    email:    Optional[str] = Field(None, max_length=128)
    language: Optional[str] = None


# ── Farm ───────────────────────────────────────────────────────────────────

class FarmIn(BaseModel):
    name:      str = Field(..., min_length=1, max_length=128)
    farm_type: Optional[str] = "greenhouse"
    crop_type: Optional[str] = None


class FarmOut(BaseModel):
    id:         int
    user_id:    int
    name:       str
    farm_type:  str
    crop_type:  Optional[str]
    current_water_level: float
    total_energy_kwh:    float
    created_at: datetime

    model_config = {"from_attributes": True}

class FarmResourceUpdateIn(BaseModel):
    water_consumed_l: float = 0.0
    energy_consumed_kwh: float = 0.0


# ── Device ─────────────────────────────────────────────────────────────────

class DeviceIn(BaseModel):
    device_id: str = Field(..., max_length=64)
    name:      Optional[str] = None
    type:      Optional[str] = None   # sensor | actuator


class DeviceOut(BaseModel):
    id:        int
    farm_id:   int
    device_id: str
    name:      Optional[str]
    type:      Optional[str]
    status:    str

    model_config = {"from_attributes": True}


# ── Sensor ─────────────────────────────────────────────────────────────────

class SensorReadingOut(BaseModel):
    id:          int
    device_id:   str
    sensor_type: str
    value:       float
    unit:        Optional[str]
    timestamp:   datetime

    model_config = {"from_attributes": True}


class SensorLatestOut(BaseModel):
    sensor_type: str
    value:       float
    unit:        Optional[str]
    status:      str   # "normal" | "warning" | "critical"
    timestamp:   datetime

    model_config = {"from_attributes": True}


# ── Dashboard ──────────────────────────────────────────────────────────────

class DashboardOut(BaseModel):
    soil_moisture:   Optional[float]
    soil_temperature: Optional[float]
    air_temperature: Optional[float]
    air_humidity:    Optional[float]
    water_tank_level: Optional[float] # نسبة مئوية
    water_usage:     Optional[float] = None # الاستهلاك اليومي للمياه
    energy_kwh:      Optional[float]
    light_intensity: Optional[float]
    irrigation_status: Optional[str]
    latest_recommendation: Optional[str]
    timestamp:       Optional[datetime]


# ── Irrigation ─────────────────────────────────────────────────────────────

class IrrigationManualIn(BaseModel):
    device_id:     str
    duration_min:  Optional[int] = Field(None, gt=0, le=120)
    target_volume: Optional[float] = Field(None, gt=0) # لتر


class IrrigationScheduleIn(BaseModel):
    device_id:    str
    duration_min: int  = Field(..., gt=0, le=120)
    start_time:   datetime


class IrrigationCommandOut(BaseModel):
    id:           int
    actuator_id:  int
    mode:         str
    duration_min: Optional[int]
    start_time:   Optional[datetime]
    created_at:   datetime

    model_config = {"from_attributes": True}


class IrrigationEventOut(BaseModel):
    id:         int
    command_id: int
    status:     str
    timestamp:  datetime

    model_config = {"from_attributes": True}


class IrrigationStatusOut(BaseModel):
    status:       str
    mode:         Optional[str]
    duration_min: Optional[int]
    daily_rate:   Optional[float]
    start_time:   Optional[datetime]


# ── Recommendation ─────────────────────────────────────────────────────────

class RecommendationOut(BaseModel):
    id:         int
    farm_id:    int
    message:    str
    reasoning:  Optional[str] = None
    category:   str
    severity:   str
    is_read:    bool
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Prediction ─────────────────────────────────────────────────────────────

class PredictionOut(BaseModel):
    id:             int
    farm_id:        int
    predicted_need: bool
    confidence:     Optional[float]
    duration_min:   Optional[int]
    created_at:     datetime

    model_config = {"from_attributes": True}


# ── Alert ──────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id:           int
    farm_id:      Optional[int]
    device_id:    Optional[str]
    sensor_type:  Optional[str]
    severity:     str
    status:       str
    message:      str
    actual_value: Optional[float]
    threshold:    Optional[float]
    created_at:   datetime
    resolved_at:  Optional[datetime]

    model_config = {"from_attributes": True}


# ── Professional Presentation Schemas (للعرض الاحترافي في الداشبورد) ──────

class AlertPresentation(BaseModel):
    """إنذار بصيغة احترافية مفهومة للمزارع"""
    icon: str  # 🚨 | ⚠️ | 🔔
    title: str  # "رطوبة التربة منخفضة جداً"
    severity: str  # "critical" | "warning" | "info"

    # المعلومات الأساسية (بدون أرقام معقدة)
    current_value: str  # "رطوبة التربة: 25%"
    expected_value: str  # "الحد المقبول: 40-70%"
    difference: str  # "أقل من الحد بـ 15%"

    # الإجراء المطلوب
    action: str  # "قم بتفعيل الري الآن"
    urgency: str  # "فوري" | "خلال ساعة" | "قريباً"

    # معلومات إضافية
    reason: Optional[str] = None  # "النبات يحتاج للماء..."
    timestamp: Optional[str] = None


class RecommendationPresentation(BaseModel):
    """توصية بصيغة احترافية مفهومة للمزارع"""
    icon: str  # 💡 | 📈 | 🎯
    title: str  # "زيادة الري تدريجياً"

    # التحليل المبني على البيانات
    data_insight: str  # "رطوبة التربة قريبة من الحد الأدنى"
    reason: str  # لماذا هذا مهم؟

    # الاقتراح العملي
    suggestion: str  # "أضف فترة ري إضافية كل يومين"
    benefit: Optional[str] = None  # "توفير 30% من المياه"

    # الوقت
    timing: str  # "على الفور" | "خلال 24 ساعة"

    # معلومات إضافية
    priority: str = "normal"  # "high" | "normal" | "low"
    category: str = "general"  # "irrigation" | "cooling" | "health"

    model_config = {"from_attributes": True}


# ── Command ────────────────────────────────────────────────────────────────

class CommandIn(BaseModel):
    device_id: str
    command:   str
    payload:   Optional[str] = None


class CommandOut(CommandIn):
    id:           int
    status:       str
    issued_at:    datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Thresholds ─────────────────────────────────────────────────────────────

class ThresholdIn(BaseModel):
    sensor_type: str
    min_value:   Optional[float] = None
    max_value:   Optional[float] = None
    warning_min: Optional[float] = None
    warning_max: Optional[float] = None


class ThresholdOut(ThresholdIn):
    id:         int
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True}
