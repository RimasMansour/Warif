# backend/src/db/models/models.py
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, Float, String, Boolean,
    DateTime, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from src.db.session import Base


# ── Enums ──────────────────────────────────────────────────────────────────

class AlertSeverity(str, enum.Enum):
    info     = "info"
    warning  = "warning"
    critical = "critical"


class AlertStatus(str, enum.Enum):
    open         = "open"
    acknowledged = "acknowledged"
    resolved     = "resolved"


class CommandStatus(str, enum.Enum):
    pending   = "pending"
    sent      = "sent"
    completed = "completed"
    failed    = "failed"


# ── Models ─────────────────────────────────────────────────────────────────

class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String(64), nullable=False, index=True)
    sensor_type = Column(String(32), nullable=False)   # temperature, humidity, …
    value       = Column(Float, nullable=False)
    unit        = Column(String(16))
    timestamp   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    def __repr__(self):
        return f"<SensorReading {self.sensor_type}={self.value} @ {self.timestamp}>"


class Alert(Base):
    __tablename__ = "alerts"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String(64), index=True)
    sensor_type = Column(String(32))
    severity    = Column(SAEnum(AlertSeverity), nullable=False, default=AlertSeverity.info)
    status      = Column(SAEnum(AlertStatus),   nullable=False, default=AlertStatus.open)
    message     = Column(Text, nullable=False)
    threshold   = Column(Float)
    actual_value= Column(Float)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at  = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Tray(Base):
    __tablename__ = "trays"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(128), nullable=False)
    crop_type   = Column(String(64))
    location    = Column(String(128))
    planted_at  = Column(DateTime(timezone=True))
    is_active   = Column(Boolean, default=True)
    notes       = Column(Text)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String(64), nullable=False, index=True)
    command     = Column(String(64), nullable=False)   # e.g. "irrigate", "fan_on"
    payload     = Column(Text)                          # JSON string
    status      = Column(SAEnum(CommandStatus), default=CommandStatus.pending)
    issued_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at= Column(DateTime(timezone=True), nullable=True)


class SensorThreshold(Base):
    __tablename__ = "sensor_thresholds"

    id          = Column(Integer, primary_key=True, index=True)
    sensor_type = Column(String(32), nullable=False, unique=True)
    min_value   = Column(Float)
    max_value   = Column(Float)
    warning_min = Column(Float)
    warning_max = Column(Float)
    updated_at  = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))
