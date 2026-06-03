"""Recommendation suppression helpers for active device decisions."""

from datetime import datetime, timedelta, timezone
import re
from typing import Dict, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models.models import (
    ActivityLog,
    Alert,
    AlertStatus,
    Actuator,
    CommandStatus,
    Device,
    DeviceCommand,
    IrrigationCommand,
    IrrigationEvent,
    IrrigationStatus,
    Recommendation,
    RecommendationCategory,
)
from src.services import tuya_client


ACTIVE_RECOMMENDATION_STATES = {"in_progress", "pending", "executing", "قيد التنفيذ"}
ACTIVE_ALERT_STATES = {"in_progress", "pending", "executing", "قيد التنفيذ"}
PENDING_WINDOW = timedelta(minutes=2)
IRRIGATION_ACTIVE_WINDOW = timedelta(minutes=20)
COOLING_ACTIVE_WINDOW = timedelta(minutes=10)
VENTILATION_ACTIVE_WINDOW = timedelta(minutes=15)
IRRIGATION_SETTLING_WINDOW = timedelta(minutes=10)
CLIMATE_SETTLING_WINDOW = timedelta(minutes=5)
BLOCKED_WINDOW = timedelta(minutes=30)
UNREAD_RECOMMENDATION_WINDOW = timedelta(hours=6)
ACTIVE_DOMAIN_STATE_WINDOW = timedelta(minutes=30)


async def get_recommendation_suppression(
    *,
    db: AsyncSession,
    farm_id: int,
    category: str,
    message: Optional[str],
    decision: Optional[Dict],
    auto_mode: bool = False,
) -> Dict:
    """Return whether a recommendation should be skipped while a prior decision settles."""
    normalized_category = _normalize_category(category)
    decision = decision or {}
    action = decision.get("action")
    if action == "stop":
        return {"suppress": False}

    domain = _domain_for_decision(decision, normalized_category)
    if domain not in {"irrigation", "climate"}:
        return {"suppress": False}
    active_rec = await _active_domain_recommendation(db, farm_id, domain)
    if active_rec:
        if auto_mode and not await _domain_is_actively_handled(db, farm_id, domain):
            active_rec.mode = None
        else:
            _refresh_recommendation(active_rec, message, decision)
            return {
                "suppress": True,
                "state": "executing",
                "reason": f"{domain} recommendation is already in progress",
                "recommendation_id": active_rec.id,
            }

    active_alert = await _active_domain_alert(db, farm_id, domain)
    if active_alert:
        if auto_mode and not await _domain_is_actively_handled(db, farm_id, domain):
            active_alert.action_status = None
        else:
            _refresh_alert(active_alert, message, decision)
            return {
                "suppress": True,
                "state": "executing",
                "reason": f"{domain} alert is already in progress",
                "alert_id": active_alert.id,
            }

    if not auto_mode:
        unread_rec = await _unread_domain_recommendation(db, farm_id, domain)
        if unread_rec:
            _refresh_recommendation(unread_rec, message, decision)
            return {
                "suppress": True,
                "state": "pending",
                "reason": f"{domain} recommendation is already pending user review",
                "recommendation_id": unread_rec.id,
            }

    if domain == "irrigation":
        return await _irrigation_suppression(db, farm_id, message, decision)

    return await _climate_suppression(db, farm_id, normalized_category, message, decision)


async def _domain_is_actively_handled(db: AsyncSession, farm_id: int, domain: str) -> bool:
    if domain == "irrigation":
        if await _recent_pending_command(db, _irrigation_device_ids(farm_id), PENDING_WINDOW):
            return True
        return await _active_irrigation_event(db, farm_id) is not None

    if domain == "climate":
        if await _recent_pending_command(db, _climate_device_ids(farm_id), PENDING_WINDOW):
            return True
        latest = await _latest_climate_log(db, farm_id)
        if not latest:
            return False
        details = latest.details if isinstance(latest.details, dict) else {}
        mode = details.get("mode") or _mode_from_action(latest.action_type)
        return mode in {"full", "fan_only"}

    return False


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
        return {
            "suppress": True,
            "state": "executing",
            "reason": "irrigation is active and waiting for soil moisture response",
        }

    if await _recent_irrigation_stop(db, farm_id, IRRIGATION_SETTLING_WINDOW):
        return {
            "suppress": True,
            "state": "monitoring",
            "reason": "irrigation recently stopped and soil moisture is still settling",
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
        created_at = _as_utc(latest.created_at)
        if created_at and datetime.now(timezone.utc) - created_at <= CLIMATE_SETTLING_WINDOW:
            return {
                "suppress": True,
                "state": "monitoring",
                "reason": "climate system recently stopped and readings are still settling",
            }
        return {"suppress": False}

    window = VENTILATION_ACTIVE_WINDOW if mode == "fan_only" or category == "humidity" else COOLING_ACTIVE_WINDOW
    created_at = _as_utc(latest.created_at)
    if mode in {"full", "fan_only"}:
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


async def _recent_irrigation_stop(db: AsyncSession, farm_id: int, window: timedelta) -> bool:
    since = datetime.now(timezone.utc) - window
    result = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.farm_id == farm_id,
            ActivityLog.action_type.in_([
                "auto_irrigation_stop",
                "manual_irrigation_stop",
                "irrigation_auto_stop",
            ]),
            ActivityLog.created_at >= since,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


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
    target_signature = _recommendation_text_signature(message)
    result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.category == _normalize_category(category),
            Recommendation.created_at >= since,
        )
        .order_by(desc(Recommendation.created_at))
    )
    return any(
        _recommendation_text_signature(rec.message) == target_signature
        for rec in result.scalars().all()
    )


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


async def _active_domain_recommendation(db: AsyncSession, farm_id: int, domain: str) -> Optional[Recommendation]:
    since = datetime.now(timezone.utc) - ACTIVE_DOMAIN_STATE_WINDOW
    result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.category.in_(_recommendation_categories_for_domain(domain)),
            Recommendation.mode.in_(ACTIVE_RECOMMENDATION_STATES),
            Recommendation.helpful.is_(None),
            Recommendation.created_at >= since,
        )
        .order_by(desc(Recommendation.created_at), desc(Recommendation.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _unread_domain_recommendation(db: AsyncSession, farm_id: int, domain: str) -> Optional[Recommendation]:
    since = datetime.now(timezone.utc) - UNREAD_RECOMMENDATION_WINDOW
    result = await db.execute(
        select(Recommendation)
        .where(
            Recommendation.farm_id == farm_id,
            Recommendation.category.in_(_recommendation_categories_for_domain(domain)),
            Recommendation.is_read.is_(False),
            Recommendation.helpful.is_(None),
            Recommendation.created_at >= since,
            Recommendation.mode.is_(None),
        )
        .order_by(desc(Recommendation.created_at), desc(Recommendation.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _active_domain_alert(db: AsyncSession, farm_id: int, domain: str) -> Optional[Alert]:
    since = datetime.now(timezone.utc) - ACTIVE_DOMAIN_STATE_WINDOW
    result = await db.execute(
        select(Alert)
        .where(
            Alert.farm_id == farm_id,
            Alert.status == AlertStatus.open,
            Alert.sensor_type.in_(_alert_sensor_types_for_domain(domain)),
            Alert.action_status.in_(ACTIVE_ALERT_STATES),
            Alert.created_at >= since,
        )
        .order_by(desc(Alert.created_at), desc(Alert.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


def _refresh_recommendation(rec: Recommendation, message: Optional[str], decision: Dict) -> None:
    rec.mode = rec.mode or "pending"
    if decision:
        rec.execution_action = decision
    if message and rec.message != message:
        rec.reasoning = rec.reasoning or message


def _refresh_alert(alert: Alert, message: Optional[str], decision: Dict) -> None:
    alert.action_status = alert.action_status or "pending"
    if decision:
        alert.execution_action = decision
    if message and alert.message != message:
        alert.explanation = alert.explanation or message


def _recommendation_categories_for_domain(domain: str) -> list[RecommendationCategory]:
    if domain == "climate":
        return [RecommendationCategory.temperature, RecommendationCategory.humidity]
    if domain == "irrigation":
        return [RecommendationCategory.irrigation, RecommendationCategory.soil]
    return [RecommendationCategory.general]


def _alert_sensor_types_for_domain(domain: str) -> list[str]:
    if domain == "climate":
        return ["temperature", "humidity", "air_temperature", "air_humidity", "climate", "ventilation", "cooling"]
    if domain == "irrigation":
        return ["irrigation", "soil", "soil_moisture", "water"]
    return [domain]


def _domain_for_category(category: str) -> str:
    if category in {"temperature", "humidity"}:
        return "climate"
    if category == "irrigation":
        return "irrigation"
    return category


def _domain_for_decision(decision: Dict, category: str) -> str:
    domain = decision.get("domain")
    action = decision.get("action")
    if domain in {"irrigation", "climate"}:
        return domain
    if action in {"start", "stop"}:
        return "irrigation"
    if action in {"cooling_full", "fan_only"}:
        return "climate"
    return _domain_for_category(category)


def _normalize_category(category: Optional[str]) -> str:
    raw = (category or "general").lower()
    if raw in {"temperature", "air_temperature", "climate", "cooling"}:
        return "temperature"
    if raw in {"humidity", "air_humidity", "ventilation"}:
        return "humidity"
    if raw in {"irrigation", "soil", "soil_moisture", "water"}:
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


def _climate_mode_matches_category(mode: str, category: str) -> bool:
    if mode == "full":
        return category in {"temperature", "humidity"}
    if mode == "fan_only":
        return category == "humidity"
    return False


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


def _recommendation_text_signature(message: Optional[str]) -> str:
    text = (message or "").lower()
    text = re.sub(r"\d+(?:\.\d+)?\s*(?:%|°?\s*c|م|lux)?", "#", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:160]


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
