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
from src.api.schemas.schemas import (
    IrrigationManualIn, IrrigationScheduleIn,
    IrrigationCommandOut, IrrigationEventOut,
    IrrigationStatusOut
)
from src.core.security import get_current_user

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
    result = await db.execute(select(Actuator).where(Actuator.device_id == body.device_id))
    actuator = result.scalar_one_or_none()
    if not actuator:
        raise HTTPException(
            status_code=404,
            detail=f"Device '{body.device_id}' is not registered. Register it first via POST /api/v1/farms/{{farm_id}}/devices.",
        )

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

    # Resolve farm_id for the activity log
    dev_result = await db.execute(
        select(Device).where(Device.device_id == body.device_id).limit(1)
    )
    dev = dev_result.scalar_one_or_none()
    log = ActivityLog(
        farm_id=dev.farm_id if dev else None,
        action_type="manual_irrigation_start",
        device_id=body.device_id,
        details={"duration_min": body.duration_min},
        performed_by="user",
    )
    db.add(log)
    await db.commit()
    await db.refresh(command)

    # ── Tuya Physical Control (farm 22 only) ──────────────────────────────────
    if dev and tuya_client.is_tuya_farm(dev.farm_id):
        try:
            await asyncio.to_thread(tuya_client.control_irrigation, True)
        except Exception:
            pass  # DB already saved — physical failure is non-blocking

    return command


# Triggered by the frontend when auto mode is ON and ML recommends irrigation
# Stops any existing active irrigation before starting a new one
@router.post("/auto/{farm_id}", response_model=IrrigationCommandOut, status_code=status.HTTP_201_CREATED)
async def trigger_auto_irrigation(
    farm_id: int,
    duration_min: int = 15,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Trigger automatic irrigation based on ML/AI decision.
    Called by the frontend when auto mode is ON and ML recommends irrigation.
    """
    # Get the sensor device for this farm
    device_result = await db.execute(
        select(Device).where(Device.farm_id == farm_id, Device.type == "sensor").limit(1)
    )
    device = device_result.scalar_one_or_none()

    if not device:
        # Auto-create device if not exists
        device = Device(
            farm_id=farm_id,
            device_id=f"irrigation_{farm_id}",
            name="Irrigation",
            type="actuator",
        )
        db.add(device)
        await db.flush()

    device_id = f"irrigation_{farm_id}"
    actuator = await _get_or_create_actuator(device_id, db)

    # Stop any existing active irrigation first
    existing = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .where(
            Actuator.device_id == device_id,
            IrrigationEvent.status == IrrigationStatus.active,
        )
        .limit(1)
    )
    existing_event = existing.scalar_one_or_none()
    if existing_event:
        existing_event.status = IrrigationStatus.completed
        await db.flush()

    command = IrrigationCommand(
        actuator_id=actuator.id,
        mode=IrrigationMode.auto,
        duration_min=duration_min,
    )
    db.add(command)
    await db.flush()

    event = IrrigationEvent(
        command_id=command.id,
        status=IrrigationStatus.active,
    )
    db.add(event)
    await db.commit()
    await db.refresh(command)
    return command


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

    started_at = event.timestamp
    event.status = IrrigationStatus.completed
    await db.commit()
    await db.refresh(event)

    # ── Water usage + Tuya close (farm 22 only) ───────────────────────────────
    dev_result = await db.execute(
        select(Device).where(Device.device_id == device_id).limit(1)
    )
    dev = dev_result.scalar_one_or_none()
    if dev and tuya_client.is_tuya_farm(dev.farm_id):
        try:
            await asyncio.to_thread(tuya_client.control_irrigation, False)
        except Exception:
            pass

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

    stopped = 0
    for event in events:
        event.status = IrrigationStatus.completed
        stopped += 1

    await db.commit()

    # ── Tuya Physical Control (farm 22 only) ─────────────────────────────────
    if tuya_client.is_tuya_farm(farm_id):
        try:
            await asyncio.to_thread(tuya_client.control_irrigation, False)
        except Exception:
            pass

    return {"stopped": stopped, "farm_id": farm_id}


# Returns today's water and power usage compared to yesterday
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
    yesterday_start = today_start - timedelta(days=1)

    # Today's water usage
    water_today_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= today_start
        )
    )
    water_today = water_today_res.scalar() or 0.0

    # Yesterday's water usage
    water_yest_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= yesterday_start,
            SensorReading.timestamp < today_start
        )
    )
    water_yesterday = water_yest_res.scalar() or 0.0

    # Today's power usage
    power_today_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "power_usage",
            SensorReading.timestamp >= today_start
        )
    )
    power_today_wh = power_today_res.scalar() or 0.0

    # Yesterday's power usage
    power_yest_res = await db.execute(
        select(func.sum(SensorReading.value))
        .where(
            SensorReading.farm_id == farm_id,
            SensorReading.sensor_type == "power_usage",
            SensorReading.timestamp >= yesterday_start,
            SensorReading.timestamp < today_start
        )
    )
    power_yesterday_wh = power_yest_res.scalar() or 0.0

    water_diff = 0
    if water_yesterday > 0:
        water_diff = round(((water_today - water_yesterday) / water_yesterday) * 100)
    elif water_today > 0:
        water_diff = 100

    power_diff = 0
    if power_yesterday_wh > 0:
        power_diff = round(((power_today_wh - power_yesterday_wh) / power_yesterday_wh) * 100)
    elif power_today_wh > 0:
        power_diff = 100

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


async def _get_or_create_actuator(device_id: str, db: AsyncSession) -> Actuator:
    """Get actuator by device_id, or create Device + Actuator if neither exists."""
    result = await db.execute(
        select(Actuator).where(Actuator.device_id == device_id)
    )
    actuator = result.scalar_one_or_none()

    if not actuator:
        # Make sure the Device row exists first (FK requirement)
        dev_result = await db.execute(
            select(Device).where(Device.device_id == device_id)
        )
        device = dev_result.scalar_one_or_none()

        if not device:
            # Determine farm_id from device naming convention.
            # Handles "valve_farm_<id>_xx" and "irrigation_<id>" formats.
            farm_id = 1
            parts = device_id.split("_")
            for i, p in enumerate(parts):
                if p == "farm" and i + 1 < len(parts):
                    try:
                        farm_id = int(parts[i + 1])
                    except ValueError:
                        pass
            if farm_id == 1:  # fallback: try last segment (e.g. "irrigation_22")
                try:
                    farm_id = int(parts[-1])
                except (ValueError, IndexError):
                    pass
            # Check if farm exists, get first farm if not
            farm_res = await db.execute(select(Farm).where(Farm.id == farm_id))
            farm = farm_res.scalar_one_or_none()
            if not farm:
                any_farm = await db.execute(select(Farm).limit(1))
                farm = any_farm.scalar_one_or_none()
                farm_id = farm.id if farm else 1

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
