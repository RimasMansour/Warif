"""Automatic execution of Decision Engine action contracts."""

import asyncio
import json
import logging
from datetime import datetime, timezone
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
    if irrigation and "soil_moisture" in sensor_data:
        results["irrigation"] = await _execute_auto_irrigation(db, farm_id, irrigation, sensor_data)

    climate = action_decisions.get("climate")
    if climate and {"air_temperature", "air_humidity"}.issubset(sensor_data):
        results["climate"] = await _execute_auto_climate(db, farm_id, climate)

    return {"executed": any(item.get("executed") for item in results.values()), "results": results}


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
    current_mode = await _latest_cooling_mode(db, farm_id)
    if current_mode == next_mode:
        return {"executed": False, "action": action, "reason": "climate mode already active"}

    fan_state = next_mode in {"full", "fan_only"}
    cooler_state = next_mode == "full"
    payload = {
        "fan": fan_state,
        "cooler": cooler_state,
        "mode": next_mode,
        "decision": decision,
        "triggered_by": "automation",
    }

    db.add(DeviceCommand(
        device_id=f"fan_unit_{farm_id}",
        command="FAN_ON" if fan_state else "FAN_OFF",
        payload=json.dumps(payload),
        status="pending",
        issued_at=datetime.now(timezone.utc),
    ))
    db.add(DeviceCommand(
        device_id=f"cooling_unit_{farm_id}",
        command="COOLER_ON" if cooler_state else "COOLER_OFF",
        payload=json.dumps(payload),
        status="pending",
        issued_at=datetime.now(timezone.utc),
    ))
    db.add(ActivityLog(
        farm_id=farm_id,
        action_type=f"auto_cooling_{next_mode}",
        device_id=f"cooling_unit_{farm_id}" if cooler_state else f"fan_unit_{farm_id}",
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

    return {"executed": True, "action": action, "mode": next_mode, "tuya_sent": tuya_sent}


async def _latest_cooling_mode(db: AsyncSession, farm_id: int) -> str:
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
    latest = result.scalar_one_or_none()
    if not latest:
        return "stop"
    details = latest.details or {}
    return details.get("mode") or ("full" if "full" in latest.action_type else "fan_only" if "fan_only" in latest.action_type else "stop")


async def _execute_auto_irrigation(db: AsyncSession, farm_id: int, decision: Dict, sensor_data: Dict) -> Dict:
    action = decision.get("action")
    actuator = await _get_or_create_irrigation_actuator(db, farm_id)
    active_event = await _active_irrigation_event(db, actuator.id)
    stop_reason = _irrigation_stop_reason(active_event, sensor_data, decision)

    if active_event and stop_reason:
        action = "stop"
        decision = {**decision, "action": "stop", "reason": stop_reason}

    if action == "hold":
        return {"executed": False, "action": action, "reason": decision.get("reason")}

    if action == "start" and active_event:
        return {"executed": False, "action": action, "reason": "irrigation already active"}
    if action == "stop" and not active_event:
        return {"executed": False, "action": action, "reason": "irrigation already stopped"}

    valve_state = action == "start"
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
    command_device_id = _irrigation_device_id(farm_id)
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

    tuya_sent = False
    if tuya_client.is_tuya_farm(farm_id):
        tuya_sent = await asyncio.to_thread(tuya_client.control_irrigation, valve_state)

    return {"executed": True, "action": action, "valve": valve_state, "tuya_sent": tuya_sent}


def _irrigation_stop_reason(active_event: IrrigationEvent | None, sensor_data: Dict, decision: Dict) -> str:
    if not active_event:
        return ""

    soil_moisture = sensor_data.get("soil_moisture")
    targets = decision.get("targets") or {}
    target_soil = targets.get("soil_moisture_max", 70)
    if soil_moisture is not None and soil_moisture >= target_soil:
        return f"soil_saturated (moisture {soil_moisture}% >= {target_soil}%)"

    started_at = active_event.timestamp
    duration_min = active_event.command.duration_min if active_event.command else None
    duration_min = duration_min or 20
    if started_at:
        start_utc = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
        elapsed_minutes = (datetime.now(timezone.utc) - start_utc).total_seconds() / 60
        if elapsed_minutes >= duration_min:
            return f"safety_timeout (running for {elapsed_minutes:.1f} min >= {duration_min} min)"

    return ""


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
