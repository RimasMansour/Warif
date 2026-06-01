"""Recommendation suppression helpers for active device decisions."""

from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models.models import (
    ActivityLog,
    Actuator,
    CommandStatus,
    Device,
    DeviceCommand,
    IrrigationCommand,
    IrrigationEvent,
    IrrigationStatus,
    Recommendation,
)
from src.services import tuya_client


PENDING_WINDOW = timedelta(minutes=2)
IRRIGATION_ACTIVE_WINDOW = timedelta(minutes=20)
COOLING_ACTIVE_WINDOW = timedelta(minutes=5)
VENTILATION_ACTIVE_WINDOW = timedelta(minutes=10)
BLOCKED_WINDOW = timedelta(minutes=30)


async def get_recommendation_suppression(
    *,
    db: AsyncSession,
    farm_id: int,
    category: str,
    message: Optional[str],
    decision: Optional[Dict],
) -> Dict:
    """Return whether a recommendation should be skipped while a prior decision settles."""
    normalized_category = _normalize_category(category)
    if normalized_category not in {"irrigation", "temperature", "humidity"}:
        return {"suppress": False}

    decision = decision or {}
    action = decision.get("action")
    if action == "stop":
        return {"suppress": False}

    if normalized_category == "irrigation":
        return await _irrigation_suppression(db, farm_id, message, decision)

    return await _climate_suppression(db, farm_id, normalized_category, message, decision)


async def get_current_decision_state(
    *,
    db: AsyncSession,
    farm_id: int,
    category: str,
    message: Optional[str],
    created_at: Optional[datetime] = None,
) -> Dict:
    """Return the current visible decision state for recommendation cards."""
    normalized_category = _normalize_category(category)
    if normalized_category not in {"irrigation", "temperature", "humidity"}:
        return _state_payload("hold", normalized_category, "لا يوجد إجراء نشط", "No active action")

    if normalized_category == "irrigation":
        return await _irrigation_decision_state(db, farm_id, message, created_at)

    return await _climate_decision_state(db, farm_id, normalized_category)


async def _irrigation_suppression(
    db: AsyncSession,
    farm_id: int,
    message: Optional[str],
    decision: Dict,
) -> Dict:
    blocked = (decision.get("safety") or {}).get("blocked")
    if blocked and await _recent_recommendation_exists(db, farm_id, "irrigation", message, BLOCKED_WINDOW):
        return {
            "suppress": True,
            "state": "blocked",
            "reason": (decision.get("safety") or {}).get("reason") or decision.get("reason"),
        }

    pending = await _recent_pending_command(db, _irrigation_device_ids(farm_id), PENDING_WINDOW)
    if pending:
        return {
            "suppress": True,
            "state": "pending",
            "reason": f"irrigation command is pending ({pending.command})",
        }

    active_event = await _active_irrigation_event(db, farm_id)
    if active_event:
        start_utc = _as_utc(active_event.timestamp)
        if start_utc and datetime.now(timezone.utc) - start_utc <= IRRIGATION_ACTIVE_WINDOW:
            mode = "unknown"
            if active_event.command is not None:
                mode = active_event.command.mode.value if hasattr(active_event.command.mode, "value") else str(active_event.command.mode)
            if (
                mode == "auto"
                and not await _recent_category_recommendation_exists(db, farm_id, "irrigation", IRRIGATION_ACTIVE_WINDOW)
            ):
                return {"suppress": False}
            return {
                "suppress": True,
                "state": "executing",
                "reason": "irrigation is active and waiting for soil moisture response",
            }

    return {"suppress": False}


async def _irrigation_decision_state(
    db: AsyncSession,
    farm_id: int,
    message: Optional[str],
    created_at: Optional[datetime],
) -> Dict:
    pending = await _recent_pending_command(db, _irrigation_device_ids(farm_id), PENDING_WINDOW)
    if pending:
        return _state_payload(
            "pending",
            "irrigation",
            "الأمر قيد الإرسال",
            "Command pending",
            reason="تم إرسال أمر الري وننتظر تأكيد الجهاز.",
            reason_en="An irrigation command was sent and is waiting for device confirmation.",
            started_at=pending.issued_at,
            expires_at=_add_window(pending.issued_at, PENDING_WINDOW),
        )

    active_event = await _active_irrigation_event(db, farm_id)
    if active_event:
        return _state_payload(
            "executing",
            "irrigation",
            "الري قيد التنفيذ",
            "Irrigation in progress",
            reason="المضخة تعمل الآن، بانتظار استجابة رطوبة التربة.",
            reason_en="The pump is running while the system waits for soil moisture response.",
            started_at=active_event.timestamp,
            expires_at=_add_window(active_event.timestamp, IRRIGATION_ACTIVE_WINDOW),
        )

    created_utc = _as_utc(created_at)
    if (
        _looks_blocked_irrigation_message(message)
        and created_utc
        and datetime.now(timezone.utc) - created_utc <= BLOCKED_WINDOW
    ):
        return _state_payload(
            "blocked",
            "irrigation",
            "الري مؤجل",
            "Irrigation deferred",
            reason="تم تأجيل الري بسبب شرط سلامة حالي.",
            reason_en="Irrigation is deferred by an active safety condition.",
            expires_at=_add_window(datetime.now(timezone.utc), BLOCKED_WINDOW),
        )

    return _state_payload("hold", "irrigation", "لا يوجد إجراء نشط", "No active action")


async def _climate_suppression(
    db: AsyncSession,
    farm_id: int,
    category: str,
    message: Optional[str],
    decision: Dict,
) -> Dict:
    pending = await _recent_pending_command(
        db,
        _climate_device_ids(farm_id),
        PENDING_WINDOW,
    )
    if pending:
        return {
            "suppress": True,
            "state": "pending",
            "reason": f"climate command is pending ({pending.command})",
        }

    latest = await _latest_climate_log(db, farm_id)
    if not latest:
        return {"suppress": False}

    details = latest.details if isinstance(latest.details, dict) else {}
    mode = details.get("mode") or _mode_from_action(latest.action_type)
    if mode == "stop":
        return {"suppress": False}

    window = VENTILATION_ACTIVE_WINDOW if mode == "fan_only" or category == "humidity" else COOLING_ACTIVE_WINDOW
    created_at = _as_utc(latest.created_at)
    if created_at and datetime.now(timezone.utc) - created_at <= window:
        if (
            latest.performed_by == "system"
            and not await _recent_category_recommendation_exists(db, farm_id, category, window)
        ):
            return {"suppress": False}
        return {
            "suppress": True,
            "state": "executing",
            "reason": f"climate mode {mode} is active and waiting for sensor response",
        }

    if await _recent_recommendation_exists(db, farm_id, category, message, window):
        return {
            "suppress": True,
            "state": "pending",
            "reason": "recent climate recommendation is still settling",
        }

    return {"suppress": False}


async def _climate_decision_state(db: AsyncSession, farm_id: int, category: str) -> Dict:
    pending = await _recent_pending_command(
        db,
        _climate_device_ids(farm_id),
        PENDING_WINDOW,
    )
    if pending:
        return _state_payload(
            "pending",
            "climate",
            "الأمر قيد الإرسال",
            "Command pending",
            reason="تم إرسال أمر المناخ وننتظر تأكيد الجهاز.",
            reason_en="A climate command was sent and is waiting for device confirmation.",
            started_at=pending.issued_at,
            expires_at=_add_window(pending.issued_at, PENDING_WINDOW),
        )

    latest = await _latest_climate_log(db, farm_id)
    if not latest:
        return _state_payload("hold", "climate", "لا يوجد إجراء نشط", "No active action")

    details = latest.details if isinstance(latest.details, dict) else {}
    mode = details.get("mode") or _mode_from_action(latest.action_type)
    if mode == "stop":
        return _state_payload("hold", "climate", "لا يوجد إجراء نشط", "No active action")

    window = VENTILATION_ACTIVE_WINDOW if mode == "fan_only" or category == "humidity" else COOLING_ACTIVE_WINDOW
    label = "التهوية قيد التنفيذ" if mode == "fan_only" else "التكييف والتهوية قيد التنفيذ"
    label_en = "Ventilation in progress" if mode == "fan_only" else "Cooling and ventilation in progress"
    reason = "المراوح تعمل الآن، بانتظار انخفاض الرطوبة." if mode == "fan_only" else "التكييف والمراوح تعمل الآن، بانتظار توازن الحرارة والرطوبة."
    reason_en = "Fans are running while the system waits for humidity to drop." if mode == "fan_only" else "Cooling and fans are running while the system waits for temperature and humidity to stabilize."

    return _state_payload(
        "executing",
        "climate",
        label,
        label_en,
        reason=reason,
        reason_en=reason_en,
        started_at=latest.created_at,
        expires_at=_add_window(latest.created_at, window),
    )


async def _recent_pending_command(
    db: AsyncSession,
    device_ids: list[str],
    window: timedelta,
) -> Optional[DeviceCommand]:
    since = datetime.now(timezone.utc) - window
    result = await db.execute(
        select(DeviceCommand)
        .where(
            DeviceCommand.device_id.in_(device_ids),
            DeviceCommand.status == CommandStatus.pending,
            DeviceCommand.issued_at >= since,
        )
        .order_by(desc(DeviceCommand.issued_at), desc(DeviceCommand.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _active_irrigation_event(db: AsyncSession, farm_id: int) -> Optional[IrrigationEvent]:
    device_ids = _irrigation_device_ids(farm_id)
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device, Device.device_id == Actuator.device_id)
        .options(selectinload(IrrigationEvent.command))
        .where(
            Device.farm_id == farm_id,
            Actuator.device_id.in_(device_ids),
            IrrigationEvent.status == IrrigationStatus.active,
        )
        .order_by(desc(IrrigationEvent.timestamp), desc(IrrigationEvent.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _latest_climate_log(db: AsyncSession, farm_id: int) -> Optional[ActivityLog]:
    result = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.farm_id == farm_id,
            ActivityLog.action_type.in_([
                "manual_cooling_full",
                "manual_cooling_fan_only",
                "manual_cooling_stop",
                "auto_cooling_full",
                "auto_cooling_fan_only",
                "auto_cooling_stop",
            ]),
        )
        .order_by(desc(ActivityLog.created_at), desc(ActivityLog.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _recent_recommendation_exists(
    db: AsyncSession,
    farm_id: int,
    category: str,
    message: Optional[str],
    window: timedelta,
) -> bool:
    if not message:
        return False

    since = datetime.now(timezone.utc) - window
    result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.category == _normalize_category(category),
            Recommendation.message == message,
            Recommendation.created_at >= since,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _recent_category_recommendation_exists(
    db: AsyncSession,
    farm_id: int,
    category: str,
    window: timedelta,
) -> bool:
    since = datetime.now(timezone.utc) - window
    result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.category == _normalize_category(category),
            Recommendation.created_at >= since,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


def _normalize_category(category: Optional[str]) -> str:
    raw = (category or "general").lower()
    if raw in {"temperature", "air_temperature", "climate"}:
        return "temperature"
    if raw in {"humidity", "air_humidity"}:
        return "humidity"
    if raw in {"irrigation", "soil_moisture", "water"}:
        return "irrigation"
    return raw


def _irrigation_device_ids(farm_id: int) -> list[str]:
    ids = [f"irrigation_valve_{farm_id}", f"irrigation_{farm_id}"]
    if tuya_client.is_tuya_farm(farm_id):
        tuya_id = tuya_client.get_tuya_actuator_device_id("irrigation")
        if tuya_id:
            ids.insert(0, tuya_id)
    return ids


def _climate_device_ids(farm_id: int) -> list[str]:
    ids = [f"fan_unit_{farm_id}", f"cooling_unit_{farm_id}"]
    if tuya_client.is_tuya_farm(farm_id):
        fan_id = tuya_client.get_tuya_actuator_device_id("fan")
        cooling_id = tuya_client.get_tuya_actuator_device_id("cooling")
        return [device_id for device_id in [fan_id, cooling_id, *ids] if device_id]
    return ids


def _mode_from_action(action_type: str) -> str:
    if "full" in action_type:
        return "full"
    if "fan_only" in action_type:
        return "fan_only"
    return "stop"


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _add_window(value: Optional[datetime], window: timedelta) -> Optional[datetime]:
    utc_value = _as_utc(value)
    return utc_value + window if utc_value else None


def _looks_blocked_irrigation_message(message: Optional[str]) -> bool:
    text = (message or "").lower()
    return "تأجيل الري" in text or "defer" in text or "blocked" in text


def _iso(value: Optional[datetime]) -> Optional[str]:
    utc_value = _as_utc(value)
    return utc_value.isoformat() if utc_value else None


def _state_payload(
    state: str,
    domain: str,
    label: str,
    label_en: str,
    *,
    reason: Optional[str] = None,
    reason_en: Optional[str] = None,
    started_at: Optional[datetime] = None,
    expires_at: Optional[datetime] = None,
) -> Dict:
    return {
        "state": state,
        "domain": domain,
        "label": label,
        "label_en": label_en,
        "reason": reason or label,
        "reason_en": reason_en or label_en,
        "started_at": _iso(started_at),
        "expires_at": _iso(expires_at),
    }
