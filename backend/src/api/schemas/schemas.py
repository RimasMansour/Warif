# backend/src/api/schemas/schemas.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


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


# ── Alert ──────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id:           int
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


# ── Tray ───────────────────────────────────────────────────────────────────

class TrayIn(BaseModel):
    name:       str = Field(..., min_length=1, max_length=128)
    crop_type:  Optional[str] = None
    location:   Optional[str] = None
    planted_at: Optional[datetime] = None
    notes:      Optional[str] = None


class TrayOut(TrayIn):
    id:         int
    is_active:  bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Command ────────────────────────────────────────────────────────────────

class CommandIn(BaseModel):
    device_id: str
    command:   str
    payload:   Optional[str] = None   # JSON string


class CommandOut(CommandIn):
    id:          int
    status:      str
    issued_at:   datetime
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


# ── Auth ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
