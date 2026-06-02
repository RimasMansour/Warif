"""Automatic execution of Decision Engine action contracts."""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models.models import (
    ActivityLog,
    Actuator,
    Device,
    DeviceCommand,
    Farm,
    IrrigationCommand,
    IrrigationEvent,
    IrrigationMode,
    IrrigationStatus,
)
from src.services import tuya_client

log = logging.getLogger(__name__)


CLIMATE_MIN_RUNTIME = timedelta(minutes=10)
CLIMATE_RESTART_COOLDOWN = timedelta(minutes=5)
IRRIGATION_MIN_RUNTIME = timedelta(minutes=8)
IRRIGATION_RESTART_COOLDOWN = timedelta(minutes=10)


async def execute_auto_decisions(
    *,
    db: AsyncSession,
    farm_id: int,
    sensor_data: Dict,
    action_decisions: Dict,
) -> Dict:
    farm = await _get_auto_farm(db, farm_id)
    if not farm:
        return {"executed": False, "reason": "farm is not in auto mode"}

    results = {}
    irrigation = action_decisions.get("irrigation")
    if irrigation and _is_saved_recommendation_decision(irrigation) and "soil_moisture" in sensor_data:
        results["irrigation"] = await _execute_auto_irrigation(db, farm_id, irrigation, sensor_data)

    climate = action_decisions.get("climate")
    if climate and _is_saved_recommendation_decision(climate) and {"air_temperature", "air_humidity"}.issubset(sensor_data):
        results["climate"] = await _execute_auto_climate(db, farm_id, climate)

    return {"executed": any(item.get("executed") for item in results.values()), "results": results}


def _is_saved_recommendation_decision(decision: Dict) -> bool:
    return decision.get("execution_source") == "saved_recommendation"


async def _get_auto_farm(db: AsyncSession, farm_id: int) -> Farm | None:
    result = await db.execute(select(Farm).where(Farm.id == farm_id).limit(1))
    farm = result.scalar_one_or_none()
    if not farm or not getattr(farm, "auto_mode", False):
        return None
    return farm


async def _execute_auto_climate(db: AsyncSession, farm_id: int, decision: Dict) -> Dict:
    action = decision.get("action")
    if action == "hold":
        return {"executed": False, "action": action, "reason": decision.get("reason")}

    next_mode = "full" if action == "cooling_full" else action
    latest_climate_log = await _latest_cooling_log(db, farm_id)
    current_mode = _cooling_mode_from_log(latest_climate_log)
    if current_mode == next_mode:
        return {"executed": False, "action": action, "reason": "climate mode already active"}

    guard_reason = _climate_transition_guard(latest_climate_log, current_mode, next_mode)
    if guard_reason:
        return {"executed": False, "action": action, "mode": current_mode, "reason": guard_reason}

    fan_state = next_mode in {"full", "fan_only"}
    cooler_state = next_mode == "full"
    payload = {
        "fan": fan_state,
        "cooler": cooler_state,
        "mode": next_mode,
        "decision": decision,
        "triggered_by": "automation",
    }
    fan_device_id = _climate_device_id(farm_id, "fan")
    cooling_device_id = _climate_device_id(farm_id, "cooling")
    activity_device_id = cooling_device_id if cooler_state else fan_device_id

    tuya_sent = False
    if tuya_client.is_tuya_farm(farm_id):
        if cooler_state:
            tuya_sent = await asyncio.to_thread(tuya_client.control_cooling, True)
        elif fan_state:
            await asyncio.to_thread(tuya_client.control_cooler_only, False)
            tuya_sent = await asyncio.to_thread(tuya_client.control_fan, True)
        else:
            await asyncio.to_thread(tuya_client.control_cooling, False)
            tuya_sent = await asyncio.to_thread(tuya_client.control_fan, False)
        if not tuya_sent:
            return {
                "executed": False,
                "action": action,
                "mode": next_mode,
                "tuya_sent": False,
                "reason": "tuya climate command failed",
            }

    db.add(DeviceCommand(
        device_id=fan_device_id,
        command="FAN_ON" if fan_state else "FAN_OFF",
        payload=json.dumps(payload),
        status="pending",
        issued_at=datetime.now(timezone.utc),
    ))
    db.add(DeviceCommand(
        device_id=cooling_device_id,
        command="COOLER_ON" if cooler_state else "COOLER_OFF",
        payload=json.dumps(payload),
        status="pending",
        issued_at=datetime.now(timezone.utc),
    ))
    db.add(ActivityLog(
        farm_id=farm_id,
        action_type=f"auto_cooling_{next_mode}",
        device_id=activity_device_id,
        details={
            "fan": fan_state,
            "cooler": cooler_state,
            "mode": next_mode,
            "triggered_by": "automation",
            "decision_source": decision.get("source"),
            "decision_confidence": decision.get("confidence"),
            "reason": decision.get("reason"),
            "targets": decision.get("targets"),
        },
        performed_by="system",
    ))

    return {"executed": True, "action": action, "mode": next_mode, "tuya_sent": tuya_sent}


async def _latest_cooling_mode(db: AsyncSession, farm_id: int) -> str:
    return _cooling_mode_from_log(await _latest_cooling_log(db, farm_id))


async def _latest_cooling_log(db: AsyncSession, farm_id: int) -> ActivityLog | None:
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


def _cooling_mode_from_log(latest: ActivityLog | None) -> str:
    if not latest:
        return "stop"
    details = latest.details or {}
    return details.get("mode") or ("full" if "full" in latest.action_type else "fan_only" if "fan_only" in latest.action_type else "stop")


def _elapsed_since(value: datetime | None) -> timedelta | None:
    if value is None:
        return None
    value_utc = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return datetime.now(timezone.utc) - value_utc


def _climate_transition_guard(latest_log: ActivityLog | None, current_mode: str, next_mode: str) -> str:
    elapsed = _elapsed_since(latest_log.created_at if latest_log else None)
    if elapsed is None:
        return ""

    if current_mode == "stop" and next_mode != "stop" and elapsed < CLIMATE_RESTART_COOLDOWN:
        remaining = CLIMATE_RESTART_COOLDOWN - elapsed
        return f"climate restart cooldown active ({remaining.total_seconds() / 60:.1f} min remaining)"

    if current_mode != "stop" and next_mode != current_mode and elapsed < CLIMATE_MIN_RUNTIME:
        remaining = CLIMATE_MIN_RUNTIME - elapsed
        return f"minimum climate runtime active ({remaining.total_seconds() / 60:.1f} min remaining)"

    return ""


async def _execute_auto_irrigation(db: AsyncSession, farm_id: int, decision: Dict, sensor_data: Dict) -> Dict:
    action = decision.get("action")
    actuator = await _get_or_create_irrigation_actuator(db, farm_id)
    active_event = await _active_irrigation_event(db, actuator.id)

    if action == "hold":
        return {"executed": False, "action": action, "reason": decision.get("reason")}

    if action == "start" and active_event:
        return {"executed": False, "action": action, "reason": "irrigation already active"}
    if action == "stop" and not active_event:
        return {"executed": False, "action": action, "reason": "irrigation already stopped"}

    guard_reason = await _irrigation_transition_guard(db, farm_id, action, active_event)
    if guard_reason:
        return {"executed": False, "action": action, "reason": guard_reason}

    valve_state = action == "start"
    command_device_id = _irrigation_device_id(farm_id)

    tuya_sent = False
    if tuya_client.is_tuya_farm(farm_id):
        tuya_sent = await asyncio.to_thread(tuya_client.control_irrigation, valve_state)
        if not tuya_sent:
            return {
                "executed": False,
                "action": action,
                "valve": valve_state,
                "tuya_sent": False,
                "reason": "tuya irrigation command failed",
            }

    actuator.state = "on" if valve_state else "off"

    if active_event:
        active_event.status = IrrigationStatus.completed

    if valve_state:
        command = IrrigationCommand(
            actuator_id=actuator.id,
            mode=IrrigationMode.auto,
            duration_min=15,
        )
        db.add(command)
        await db.flush()
        db.add(IrrigationEvent(command_id=command.id, status=IrrigationStatus.active))

    payload = {
        "valve": valve_state,
        "duration_min": 15,
        "decision": decision,
        "triggered_by": "automation",
    }

    db.add(DeviceCommand(
        device_id=command_device_id,
        command="VALVE_OPEN" if valve_state else "VALVE_CLOSE",
        payload=json.dumps(payload),
        status="pending",
        issued_at=datetime.now(timezone.utc),
    ))
    db.add(ActivityLog(
        farm_id=farm_id,
        action_type=f"auto_irrigation_{'start' if valve_state else 'stop'}",
        device_id=command_device_id,
        details={
            "valve": valve_state,
            "duration_min": 15,
            "triggered_by": "automation",
            "decision_source": decision.get("source"),
            "decision_confidence": decision.get("confidence"),
            "reason": decision.get("reason"),
            "targets": decision.get("targets"),
        },
        performed_by="system",
    ))

    return {"executed": True, "action": action, "valve": valve_state, "tuya_sent": tuya_sent}


async def _irrigation_transition_guard(
    db: AsyncSession,
    farm_id: int,
    action: str,
    active_event: IrrigationEvent | None,
) -> str:
    if action == "stop" and active_event:
        elapsed = _elapsed_since(active_event.timestamp)
        if elapsed is not None and elapsed < IRRIGATION_MIN_RUNTIME:
            remaining = IRRIGATION_MIN_RUNTIME - elapsed
            return f"minimum irrigation runtime active ({remaining.total_seconds() / 60:.1f} min remaining)"

    if action == "start":
        latest_stop = await _latest_irrigation_stop_log(db, farm_id)
        elapsed = _elapsed_since(latest_stop.created_at if latest_stop else None)
        if elapsed is not None and elapsed < IRRIGATION_RESTART_COOLDOWN:
            remaining = IRRIGATION_RESTART_COOLDOWN - elapsed
            return f"irrigation restart cooldown active ({remaining.total_seconds() / 60:.1f} min remaining)"

    return ""


async def _latest_irrigation_stop_log(db: AsyncSession, farm_id: int) -> ActivityLog | None:
    result = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.farm_id == farm_id,
            ActivityLog.action_type.in_([
                "auto_irrigation_stop",
                "manual_irrigation_stop",
                "irrigation_auto_stop",
            ]),
        )
        .order_by(desc(ActivityLog.created_at), desc(ActivityLog.id))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _active_irrigation_event(db: AsyncSession, actuator_id: int) -> IrrigationEvent | None:
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .options(selectinload(IrrigationEvent.command))
        .where(
            IrrigationCommand.actuator_id == actuator_id,
            IrrigationEvent.status == IrrigationStatus.active,
        )
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_or_create_irrigation_actuator(db: AsyncSession, farm_id: int) -> Actuator:
    device_id = _irrigation_device_id(farm_id)
    result = await db.execute(select(Device).where(Device.device_id == device_id).limit(1))
    device = result.scalar_one_or_none()
    if device is None:
        device = Device(farm_id=farm_id, device_id=device_id, name="Irrigation Valve", type="actuator")
        db.add(device)
        await db.flush()
    elif device.farm_id != farm_id:
        raise ValueError(f"Device {device_id} belongs to farm {device.farm_id}, not farm {farm_id}")

    result = await db.execute(select(Actuator).where(Actuator.device_id == device_id).limit(1))
    actuator = result.scalar_one_or_none()
    if actuator is None:
        actuator = Actuator(device_id=device_id, actuator_type="irrigation_valve", state="off", power_rating_kw=0.5)
        db.add(actuator)
        await db.flush()
    return actuator


def _irrigation_device_id(farm_id: int) -> str:
    if tuya_client.is_tuya_farm(farm_id):
        return tuya_client.get_tuya_actuator_device_id("irrigation") or f"tuya_irrigation_{farm_id}"
    return f"irrigation_{farm_id}"


def _climate_device_id(farm_id: int, kind: str) -> str:
    simulator_id = f"fan_unit_{farm_id}" if kind == "fan" else f"cooling_unit_{farm_id}"
    return tuya_client.get_farm_actuator_device_id(farm_id, kind, simulator_id)
