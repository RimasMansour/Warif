# backend/src/api/routes/farms.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models.models import Farm, Device
from src.api.schemas.schemas import FarmIn, FarmOut, DeviceIn, DeviceOut
from src.core.security import get_current_user

router = APIRouter()


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
async def create_farm(
    body: FarmIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Register a new farm for the current user."""
    farm = Farm(
        user_id=int(current_user["sub"]),
        name=body.name,
        farm_type=body.farm_type,
        crop_type=body.crop_type,
    )
    db.add(farm)
    await db.commit()
    await db.refresh(farm)
    return farm


@router.get("", response_model=List[FarmOut])
async def list_farms(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all farms belonging to the current user."""
    result = await db.execute(
        select(Farm).where(Farm.user_id == int(current_user["sub"]))
    )
    return result.scalars().all()


@router.get("/{farm_id}", response_model=FarmOut)
async def get_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    farm = await _get_farm_or_404(farm_id, int(current_user["sub"]), db)
    return farm


@router.post("/{farm_id}/devices", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def register_device(
    farm_id: int,
    body: DeviceIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Register a sensor/actuator device under a farm."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)

    # Check device_id not already registered
    result = await db.execute(
        select(Device).where(Device.device_id == body.device_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device ID already registered",
        )

    device = Device(
        farm_id=farm_id,
        device_id=body.device_id,
        name=body.name,
        type=body.type,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{farm_id}/devices", response_model=List[DeviceOut])
async def list_devices(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all devices registered under a farm."""
    await _get_farm_or_404(farm_id, int(current_user["sub"]), db)
    result = await db.execute(
        select(Device).where(Device.farm_id == farm_id)
    )
    return result.scalars().all()


async def _get_farm_or_404(farm_id: int, user_id: int, db: AsyncSession) -> Farm:
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm
