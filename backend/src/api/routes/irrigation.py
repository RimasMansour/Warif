# backend/src/api/routes/irrigation.py
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import (
    Farm, Device, Actuator, IrrigationCommand,
    IrrigationEvent, IrrigationMode, IrrigationStatus
)
from src.api.schemas.schemas import (
    IrrigationManualIn, IrrigationScheduleIn,
    IrrigationCommandOut, IrrigationEventOut,
    IrrigationStatusOut
)
from src.core.security import get_current_user

router = APIRouter()


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
        status=event.status.value,
        mode=event.command.mode.value,
        duration_min=event.command.duration_min,
        daily_rate=None,
        start_time=event.command.start_time,
    )


@router.post("/manual", response_model=IrrigationCommandOut, status_code=status.HTTP_201_CREATED)
async def start_manual_irrigation(
    body: IrrigationManualIn,
    db: AsyncSession = Depends(get_db),
):
    """Trigger manual irrigation for a specific device."""
    actuator = await _get_or_create_actuator(body.device_id, db)

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
    await db.commit()
    await db.refresh(command)
    return command


@router.post("/auto/{farm_id}", response_model=IrrigationCommandOut, status_code=status.HTTP_201_CREATED)
async def trigger_auto_irrigation(
    farm_id: int,
    duration_min: int = 15,
    db: AsyncSession = Depends(get_db),
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
        mode=IrrigationMode.manual,
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


@router.post("/stop/{device_id}", response_model=IrrigationEventOut)
async def stop_irrigation(
    device_id: str,
    db: AsyncSession = Depends(get_db),
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

    event.status = IrrigationStatus.completed
    await db.commit()
    await db.refresh(event)
    return event


@router.post("/stop-farm/{farm_id}", response_model=dict)
async def stop_farm_irrigation(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
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
    return {"stopped": stopped, "farm_id": farm_id}


@router.get("/resources/{farm_id}", response_model=dict)
async def get_irrigation_resources(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get water and power usage from sensor readings for a farm."""
    from sqlalchemy import func
    from src.db.models.models import SensorReading, Device

    # Get today's total water usage
    water_result = await db.execute(
        select(func.sum(SensorReading.value))
        .join(Device, SensorReading.device_id == Device.device_id)
        .where(
            Device.farm_id == farm_id,
            SensorReading.sensor_type == "water_usage",
            SensorReading.timestamp >= func.date_trunc('day', func.now())
        )
    )
    water_total = water_result.scalar() or 0.0

    # Get today's total power usage (in Wh → convert to kWh)
    power_result = await db.execute(
        select(func.sum(SensorReading.value))
        .join(Device, SensorReading.device_id == Device.device_id)
        .where(
            Device.farm_id == farm_id,
            SensorReading.sensor_type == "power_usage",
            SensorReading.timestamp >= func.date_trunc('day', func.now())
        )
    )
    power_total_wh = power_result.scalar() or 0.0

    # Get fan status from latest air_temperature reading context
    fan_result = await db.execute(
        select(SensorReading.value)
        .join(Device, SensorReading.device_id == Device.device_id)
        .where(
            Device.farm_id == farm_id,
            SensorReading.sensor_type == "air_temperature",
        )
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    latest_temp = fan_result.scalar() or 0.0
    fan_active = latest_temp >= 30.0

    return {
        "water_usage_liters": round(water_total, 2),
        "power_usage_kwh": round(power_total_wh / 1000, 3),
        "fan_active": fan_active,
        "farm_id": farm_id,
    }


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
            # Determine farm_id from device naming convention (valve_farm_<id>_xx)
            farm_id = 1
            parts = device_id.split("_")
            for i, p in enumerate(parts):
                if p == "farm" and i + 1 < len(parts):
                    try:
                        farm_id = int(parts[i + 1])
                    except ValueError:
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
