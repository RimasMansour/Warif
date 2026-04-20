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


class IrrigationMode(str, enum.Enum):
    manual    = "manual"
    auto      = "auto"
    scheduled = "scheduled"


class IrrigationStatus(str, enum.Enum):
    pending   = "pending"
    active    = "active"
    completed = "completed"
    cancelled = "cancelled"


class RecommendationCategory(str, enum.Enum):
    irrigation  = "irrigation"
    temperature = "temperature"
    humidity    = "humidity"
    soil        = "soil"
    general     = "general"


class RecommendationSeverity(str, enum.Enum):
    normal  = "normal"
    warning = "warning"
    urgent  = "urgent"


class FarmType(str, enum.Enum):
    greenhouse  = "greenhouse"
    open_field  = "open_field"


class UserRole(str, enum.Enum):
    farmer = "farmer"
    admin  = "admin"


# ── Models ─────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    username     = Column(String(64), unique=True, nullable=False, index=True)
    email        = Column(String(128), unique=True, nullable=False)
    password_hash= Column(String(256), nullable=False)
    language     = Column(String(4), default="ar")
    role         = Column(SAEnum(UserRole), default=UserRole.farmer)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farms = relationship("Farm", back_populates="user")

    def __repr__(self):
        return f"<User {self.username}>"


class Farm(Base):
    __tablename__ = "farms"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    name       = Column(String(128), nullable=False)
    farm_type  = Column(SAEnum(FarmType), default=FarmType.greenhouse)
    crop_type  = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user    = relationship("User", back_populates="farms")
    devices = relationship("Device", back_populates="farm")

    def __repr__(self):
        return f"<Farm {self.name}>"


class Device(Base):
    __tablename__ = "devices"

    id        = Column(Integer, primary_key=True, index=True)
    farm_id   = Column(Integer, ForeignKey("farms.id"), nullable=False)
    device_id = Column(String(64), unique=True, nullable=False, index=True)
    name      = Column(String(128))
    type      = Column(String(32))   # sensor | actuator
    status    = Column(String(16), default="active")

    farm     = relationship("Farm", back_populates="devices")
    readings = relationship("SensorReading", back_populates="device")
    actuator = relationship("Actuator", back_populates="device", uselist=False)

    def __repr__(self):
        return f"<Device {self.device_id}>"


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String(64), ForeignKey("devices.device_id"), nullable=False, index=True)
    sensor_type = Column(String(32), nullable=False)
    value       = Column(Float, nullable=False)
    unit        = Column(String(16))
    timestamp   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    device = relationship("Device", back_populates="readings")

    def __repr__(self):
        return f"<SensorReading {self.sensor_type}={self.value} @ {self.timestamp}>"


class Actuator(Base):
    __tablename__ = "actuators"

    id            = Column(Integer, primary_key=True, index=True)
    device_id     = Column(String(64), ForeignKey("devices.device_id"), nullable=False)
    actuator_type = Column(String(32))   # irrigation_valve | fan | heater
    state         = Column(String(16), default="off")

    device   = relationship("Device", back_populates="actuator")
    commands = relationship("IrrigationCommand", back_populates="actuator")

    def __repr__(self):
        return f"<Actuator {self.actuator_type} state={self.state}>"


class IrrigationCommand(Base):
    __tablename__ = "irrigation_commands"

    id           = Column(Integer, primary_key=True, index=True)
    actuator_id  = Column(Integer, ForeignKey("actuators.id"), nullable=False)
    mode         = Column(SAEnum(IrrigationMode), nullable=False)
    duration_min = Column(Integer)
    start_time   = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    actuator = relationship("Actuator", back_populates="commands")
    events   = relationship("IrrigationEvent", back_populates="command")

    def __repr__(self):
        return f"<IrrigationCommand mode={self.mode} duration={self.duration_min}>"


class IrrigationEvent(Base):
    __tablename__ = "irrigation_events"

    id         = Column(Integer, primary_key=True, index=True)
    command_id = Column(Integer, ForeignKey("irrigation_commands.id"), nullable=False)
    status     = Column(SAEnum(IrrigationStatus), default=IrrigationStatus.pending)
    timestamp  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    command = relationship("IrrigationCommand", back_populates="events")

    def __repr__(self):
        return f"<IrrigationEvent status={self.status} @ {self.timestamp}>"


class Recommendation(Base):
    __tablename__ = "recommendations"

    id         = Column(Integer, primary_key=True, index=True)
    farm_id    = Column(Integer, ForeignKey("farms.id"), nullable=False)
    message    = Column(Text, nullable=False)
    category   = Column(SAEnum(RecommendationCategory), default=RecommendationCategory.general)
    severity   = Column(SAEnum(RecommendationSeverity), default=RecommendationSeverity.normal)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Recommendation [{self.category}] {self.message[:30]}>"


class Prediction(Base):
    __tablename__ = "predictions"

    id             = Column(Integer, primary_key=True, index=True)
    farm_id        = Column(Integer, ForeignKey("farms.id"), nullable=False)
    predicted_need = Column(Boolean, nullable=False)
    confidence     = Column(Float)
    duration_min   = Column(Integer)
    created_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Prediction need={self.predicted_need} confidence={self.confidence}>"


class Alert(Base):
    __tablename__ = "alerts"

    id           = Column(Integer, primary_key=True, index=True)
    farm_id      = Column(Integer, ForeignKey("farms.id"), nullable=True)
    device_id    = Column(String(64), index=True)
    sensor_type  = Column(String(32))
    severity     = Column(SAEnum(AlertSeverity), nullable=False, default=AlertSeverity.info)
    status       = Column(SAEnum(AlertStatus),   nullable=False, default=AlertStatus.open)
    message      = Column(Text, nullable=False)
    threshold    = Column(Float)
    actual_value = Column(Float)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))
    resolved_at  = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<Alert [{self.severity}] {self.message[:30]}>"


class DeviceCommand(Base):
    __tablename__ = "device_commands"

    id           = Column(Integer, primary_key=True, index=True)
    device_id    = Column(String(64), nullable=False, index=True)
    command      = Column(String(64), nullable=False)
    payload      = Column(Text)
    status       = Column(SAEnum(CommandStatus), default=CommandStatus.pending)
    issued_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<DeviceCommand {self.command} status={self.status}>"


class SensorThreshold(Base):
    __tablename__ = "sensor_thresholds"

    id          = Column(Integer, primary_key=True, index=True)
    sensor_type = Column(String(32), nullable=False, unique=True)
    min_value   = Column(Float)
    max_value   = Column(Float)
    warning_min = Column(Float)
    warning_max = Column(Float)
    updated_at  = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<SensorThreshold {self.sensor_type}>"  
