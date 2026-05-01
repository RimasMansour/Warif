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

    # Get latest irrigation event
    result = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(Device.farm_id == farm_id)
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
