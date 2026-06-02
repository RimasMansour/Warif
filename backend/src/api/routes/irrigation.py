# backend/src/api/routes/irrigation.py
"""
Irrigation Routes — Warif API
==============================
Handles all irrigation control and monitoring endpoints:
  - GET  /status/{farm_id}       : get current irrigation status (public)
  - POST /manual                 : start manual irrigation for a device
  - POST /auto/{farm_id}         : trigger AI-based automatic irrigation
  - POST /schedule               : schedule irrigation for a future time
  - POST /stop/{device_id}       : stop active irrigation for a device
  - POST /stop-farm/{farm_id}    : stop all active irrigation for a farm
  - GET  /resources/{farm_id}    : get water and power usage statistics
  - GET  /history/{farm_id}      : get irrigation history

Note: The simulator writes directly to the DB and does NOT call these endpoints.
All POST endpoints require JWT authentication.
"""
import asyncio
import logging
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from src.db.session import get_db
from src.db.models.models import (
    Farm, Device, Actuator, IrrigationCommand,
    IrrigationEvent, IrrigationMode, IrrigationStatus, ActivityLog, SensorReading
)
from src.services import tuya_client
from src.services.automation_executor import execute_auto_decisions
from src.services.decision_engine import get_engine
from src.api.schemas.schemas import (
    IrrigationManualIn, IrrigationScheduleIn,
    IrrigationCommandOut, IrrigationEventOut,
    IrrigationStatusOut
)
from src.core.security import get_current_user

log = logging.getLogger(__name__)

router = APIRouter()


# Public endpoint — no auth required (used by dashboard and simulator status checks)
@router.get("/status/{farm_id}", response_model=IrrigationStatusOut)
async def get_irrigation_status(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get current irrigation status for a farm."""

    from sqlalchemy.orm import selectinload
    # Get latest irrigation event
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(Device.farm_id == farm_id)
        .options(selectinload(IrrigationEvent.command))
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(1)
    )
    event = result.scalar_one_or_none()

    if not event:
        return IrrigationStatusOut(status="idle", mode=None, duration_min=None, daily_rate=None, start_time=None)

    return IrrigationStatusOut(
        status=event.status.value if hasattr(event.status, "value") else str(event.status or "idle"),
        mode=event.command.mode.value if hasattr(event.command.mode, "value") else str(event.command.mode or "manual"),
        duration_min=event.command.duration_min,
        daily_rate=None,
        start_time=event.command.start_time,
    )


# Triggered by the farmer manually from the dashboard
# Creates an IrrigationCommand + IrrigationEvent and logs the action
@router.post("/manual", response_model=IrrigationCommandOut, status_code=status.HTTP_201_CREATED)
async def start_manual_irrigation(
    body: IrrigationManualIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Trigger manual irrigation for a specific device."""
    farm_id = await _resolve_manual_irrigation_farm_id(body, db, int(current_user["sub"]))
    device_id = _irrigation_device_id_for_farm(farm_id, body.device_id)
    actuator = await _get_or_create_actuator(device_id, db, farm_id=farm_id)

    command = IrrigationCommand(
        actuator_id=actuator.id,
        mode=IrrigationMode.manual,
        duration_min=body.duration_min,
    )
    db.add(command)
    await db.flush()

    event = IrrigationEvent(
        command_id=command.id,
        status=IrrigationStatus.active,
    )
    db.add(event)

    dev_result = await db.execute(
        select(Device).where(Device.device_id == device_id).limit(1)
    )
    dev = dev_result.scalar_one_or_none()
    activity = ActivityLog(
        farm_id=dev.farm_id if dev else None,
        action_type="manual_irrigation_start",
        device_id=device_id,
        details={"duration_min": body.duration_min},
        performed_by="user",
    )
    db.add(activity)

    # ── Tuya Physical Control ──────────────────────────────────────────────────
    if dev is None:
        log.warning("start_manual_irrigation: Device row not found for device_id=%s — skipping Tuya", body.device_id)
    elif not tuya_client.is_tuya_farm(dev.farm_id):
        log.info("start_manual_irrigation: farm_id=%s is not the Tuya farm — skipping physical control", dev.farm_id)
    else:
        try:
            ok = await asyncio.to_thread(tuya_client.control_irrigation, True)
            if not ok:
                await db.rollback()
                log.error("start_manual_irrigation: Tuya valve open command FAILED for device_id=%s", body.device_id)
                raise HTTPException(status_code=502, detail="Failed to open Tuya irrigation valve")
            log.info("start_manual_irrigation: Tuya valve opened OK for device_id=%s", body.device_id)
        except Exception as e:
            await db.rollback()
            log.error("start_manual_irrigation: Tuya call raised exception: %s", e)
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=502, detail="Failed to open Tuya irrigation valve") from e

    await db.commit()
    await db.refresh(command)

    return command


# Legacy trigger: asks the backend automation path to execute the current ML decision.
@router.post("/auto/{farm_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def trigger_auto_irrigation(
    farm_id: int,
    duration_min: int = 15,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger automatic irrigation through the current backend ML/Decision Engine contract.
    Kept for compatibility; the frontend no longer decides irrigation by itself.
    """
    farm_result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == int(current_user["sub"]))
    )
    farm = farm_result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    sensor_data = await _latest_sensor_snapshot(farm_id, db)
    sensor_data["crop_type"] = farm.crop_type or "tomatoes"
    report = await get_engine().analyze_with_intelligence(sensor_data, farm_id)
    decisions = report.get("action_decisions", {})
    irrigation_decision = decisions.get("irrigation")
    if not irrigation_decision:
        raise HTTPException(status_code=422, detail="No irrigation decision is available")

    result = await execute_auto_decisions(
        db=db,
        farm_id=farm_id,
        sensor_data=sensor_data,
        action_decisions={"irrigation": irrigation_decision},
    )
    await db.commit()
    return {
        "success": True,
        "farm_id": farm_id,
        "duration_min": duration_min,
        "decision": irrigation_decision,
        "automation": result,
    }


# Schedules irrigation for a specific future time
# Creates a pending IrrigationEvent that activates at start_time
@router.post("/schedule", response_model=IrrigationCommandOut, status_code=status.HTTP_201_CREATED)
async def schedule_irrigation(
    body: IrrigationScheduleIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Schedule irrigation for a future time."""
    actuator = await _get_or_create_actuator(body.device_id, db)

    command = IrrigationCommand(
        actuator_id=actuator.id,
        mode=IrrigationMode.scheduled,
        duration_min=body.duration_min,
        start_time=body.start_time,
    )
    db.add(command)
    await db.flush()

    event = IrrigationEvent(
        command_id=command.id,
        status=IrrigationStatus.pending,
    )
    db.add(event)
    await db.commit()
    await db.refresh(command)
    return command


# Stops the currently active irrigation session for a specific device
@router.post("/stop/{device_id}", response_model=IrrigationEventOut)
async def stop_irrigation(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Stop active irrigation for a device."""
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .where(
            Actuator.device_id == device_id,
            IrrigationEvent.status == IrrigationStatus.active,
        )
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(1)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="No active irrigation found")

    # ── Water usage + Tuya close (farm 22 only) ───────────────────────────────
    dev_result = await db.execute(
        select(Device).where(Device.device_id == device_id).limit(1)
    )
    dev = dev_result.scalar_one_or_none()
    started_at = event.timestamp
    if dev and tuya_client.is_tuya_farm(dev.farm_id):
        try:
            ok = await asyncio.to_thread(tuya_client.control_irrigation, False)
            if not ok:
                await db.rollback()
                log.error("stop_irrigation: Tuya valve close command FAILED for device_id=%s", device_id)
                raise HTTPException(status_code=502, detail="Failed to close Tuya irrigation valve")
            log.info("stop_irrigation: Tuya valve closed OK for device_id=%s", device_id)
        except Exception as e:
            await db.rollback()
            log.error("stop_irrigation: Tuya call raised exception: %s", e)
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=502, detail="Failed to close Tuya irrigation valve") from e

    event.status = IrrigationStatus.completed

    if dev and tuya_client.is_tuya_farm(dev.farm_id):
        # Calculate liters used: flow_rate = 3 L/min
        if started_at:
            start = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
            minutes = (datetime.now(timezone.utc) - start).total_seconds() / 60
            liters = round(minutes * 3.0, 2)
            db.add(SensorReading(
                device_id="tuya_irrigation_001",
                farm_id=dev.farm_id,
                sensor_type="water_usage",
                value=liters,
                unit="L",
            ))

    await db.commit()
    await db.refresh(event)

    return event


# Stops ALL active irrigation sessions across the entire farm
@router.post("/stop-farm/{farm_id}", response_model=dict)
async def stop_farm_irrigation(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Stop all active irrigation for a farm by farm_id."""
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(
            Device.farm_id == farm_id,
            IrrigationEvent.status == IrrigationStatus.active,
        )
    )
    events = result.scalars().all()

    # ── Tuya Physical Control ─────────────────────────────────────────────────
    if tuya_client.is_tuya_farm(farm_id):
        try:
            ok = await asyncio.to_thread(tuya_client.control_irrigation, False)
            if not ok:
                await db.rollback()
                log.error("stop_farm_irrigation: Tuya valve close command FAILED for farm_id=%s", farm_id)
                raise HTTPException(status_code=502, detail="Failed to close Tuya irrigation valve")
            log.info("stop_farm_irrigation: Tuya valve closed OK for farm_id=%s", farm_id)
        except Exception as e:
            await db.rollback()
            log.error("stop_farm_irrigation: Tuya call raised exception: %s", e)
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(status_code=502, detail="Failed to close Tuya irrigation valve") from e

    stopped = 0
    for event in events:
        event.status = IrrigationStatus.completed
        stopped += 1

    await db.commit()

    return {"stopped": stopped, "farm_id": farm_id}


# Returns today's water and power usage compared to the same elapsed period yesterday
# Fan status is inferred from the latest air temperature reading (>= 30°C = active)
@router.get("/resources/{farm_id}", response_model=dict)
async def get_irrigation_resources(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get water and power usage from sensor readings for a farm."""
    from sqlalchemy import func
    from datetime import datetime, timezone, timedelta
    from src.db.models.models import SensorReading

    # Calculate today and yesterday boundaries in Saudi Arabia timezone (UTC+3)
    saudi_tz = timezone(timedelta(hours=3))
    now_saudi = datetime.now(saudi_tz)
    today_start = datetime(now_saudi.year, now_saudi.month, now_saudi.day, tzinfo=saudi_tz).astimezone(timezone.utc).replace(tzinfo=None)
    now_utc = now_saudi.astimezone(timezone.utc).replace(tzinfo=None)
    yesterday_start = today_start - timedelta(days=1)
    yesterday_same_time = yesterday_start + (now_utc - today_start)

    # Today's water usage
    water_today_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= today_start,
            SensorReading.timestamp < now_utc,
        )
    )
    water_today = water_today_res.scalar() or 0.0

    # Yesterday's water usage for the same elapsed day period
    water_yest_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= yesterday_start,
            SensorReading.timestamp < yesterday_same_time,
        )
    )
    water_yesterday = water_yest_res.scalar() or 0.0

    # Today's power usage
    power_today_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "power_usage",
            SensorReading.timestamp >= today_start,
            SensorReading.timestamp < now_utc,
        )
    )
    power_today_wh = power_today_res.scalar() or 0.0

    # Yesterday's power usage for the same elapsed day period
    power_yest_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "power_usage",
            SensorReading.timestamp >= yesterday_start,
            SensorReading.timestamp < yesterday_same_time,
        )
    )
    power_yesterday_wh = power_yest_res.scalar() or 0.0

    water_diff = None
    if water_yesterday > 0:
        water_diff = round(((water_today - water_yesterday) / water_yesterday) * 100)

    power_diff = None
    if power_yesterday_wh > 0:
        power_diff = round(((power_today_wh - power_yesterday_wh) / power_yesterday_wh) * 100)

    # Get fan status from latest air_temperature reading context
    fan_result = await db.execute(
        select(SensorReading.value)
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "air_temperature",
        )
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    latest_temp = fan_result.scalar() or 0.0
    fan_active = latest_temp >= 30.0

    return {
        "water_usage_liters": round(water_today, 2),
        "power_usage_kwh": round(power_today_wh / 1000, 3),
        "water_diff_percent": water_diff,
        "power_diff_percent": power_diff,
        "water_yesterday_liters": round(water_yesterday, 2),
        "power_yesterday_kwh": round(power_yesterday_wh / 1000, 3),
        "comparison_window": "same_elapsed_period_yesterday",
        "fan_active": fan_active,
        "farm_id": farm_id,
    }


# Returns paginated irrigation event history for a farm
@router.get("/history/{farm_id}", response_model=List[IrrigationEventOut])
async def get_irrigation_history(
    farm_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get irrigation history for a farm."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(Device.farm_id == farm_id)
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(limit)
    )
    return result.scalars().all()


# ── Helpers ────────────────────────────────────────────────────────────────

async def _get_farm_or_404(farm_id: int, user_id: int, db: AsyncSession) -> Farm:
    """Fetch farm by ID and verify ownership. Raises 404 if not found or not owned by user."""
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


async def _latest_sensor_snapshot(farm_id: int, db: AsyncSession) -> dict:
    snapshot = {}
    for sensor_type in ("soil_moisture", "soil_temperature", "air_temperature", "air_humidity", "light_intensity"):
        result = await db.execute(
            select(SensorReading)
            .where(SensorReading.farm_id == farm_id, SensorReading.sensor_type == sensor_type)
            .order_by(desc(SensorReading.timestamp))
            .limit(1)
        )
        reading = result.scalar_one_or_none()
        if reading is not None:
            snapshot[sensor_type] = reading.value
    return snapshot


async def _resolve_manual_irrigation_farm_id(body: IrrigationManualIn, db: AsyncSession, user_id: int) -> int:
    if body.farm_id is not None:
        await _get_farm_or_404(int(body.farm_id), user_id, db)
        return int(body.farm_id)

    device_result = await db.execute(select(Device).where(Device.device_id == body.device_id).limit(1))
    device = device_result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=422, detail="farm_id is required for unknown irrigation devices")

    await _get_farm_or_404(device.farm_id, user_id, db)
    return device.farm_id


def _irrigation_device_id_for_farm(farm_id: int, requested_device_id: str | None = None) -> str:
    if tuya_client.is_tuya_farm(farm_id):
        return tuya_client.get_tuya_actuator_device_id("irrigation") or f"tuya_irrigation_{farm_id}"
    return requested_device_id or f"irrigation_{farm_id}"


async def _get_or_create_actuator(device_id: str, db: AsyncSession, farm_id: int | None = None) -> Actuator:
    """Get actuator by device_id, or create Device + Actuator if neither exists."""
    dev_result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = dev_result.scalar_one_or_none()
    if device is not None and farm_id is not None and device.farm_id != farm_id:
        raise HTTPException(status_code=409, detail="Device belongs to a different farm")

    result = await db.execute(
        select(Actuator).where(Actuator.device_id == device_id)
    )
    actuator = result.scalar_one_or_none()

    if not actuator:
        # Make sure the Device row exists first (FK requirement)
        if not device:
            if farm_id is None:
                raise HTTPException(status_code=422, detail="farm_id is required to create an irrigation actuator")

            device = Device(
                farm_id=farm_id,
                device_id=device_id,
                name=f"Irrigation Valve {device_id}",
                type="actuator",
            )
            db.add(device)
            await db.flush()

        actuator = Actuator(
            device_id=device_id,
            actuator_type="irrigation_valve",
            state="off",
        )
        db.add(actuator)
        await db.flush()

    return actuator
