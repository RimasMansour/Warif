# backend/src/api/routes/farms.py
"""
Farm Routes — Warif API
========================
Handles all farm and device management endpoints:
  - POST   /farms                    : create a new farm
  - GET    /farms                    : list all farms for current user
  - GET    /farms/{farm_id}          : get farm details
  - PATCH  /farms/{farm_id}          : update farm details
  - DELETE /farms/{farm_id}          : delete a farm
  - PATCH  /farms/{farm_id}/auto-mode     : toggle auto irrigation mode
  - PATCH  /farms/{farm_id}/resources     : update water and energy consumption
  - POST   /farms/{farm_id}/devices       : register a new device under a farm
  - GET    /farms/{farm_id}/devices       : list all devices under a farm

All endpoints require JWT authentication.
Farm ownership is verified on every request.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models.models import Farm, Device
from src.api.schemas.schemas import FarmIn, FarmOut, DeviceIn, DeviceOut, FarmResourceUpdateIn
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
    

@router.patch("/{farm_id}", response_model=FarmOut)
async def update_farm(
    farm_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update farm name or details."""
    result = await db.execute(
        select(Farm).where(
            Farm.id == farm_id,
            Farm.user_id == int(current_user["sub"])
        )
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    
    if "name" in body:
        farm.name = body["name"]
    if "farm_type" in body:
        farm.farm_type = body["farm_type"]
    if "crop_type" in body:
        farm.crop_type = body["crop_type"]
    if "auto_mode" in body:
        farm.auto_mode = body["auto_mode"]
    
    await db.commit()
    await db.refresh(farm)
    return farm


@router.patch("/{farm_id}/auto-mode")
async def update_auto_mode(
    farm_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Specific endpoint to toggle auto_mode."""
    result = await db.execute(
        select(Farm).where(
            Farm.id == farm_id,
            Farm.user_id == int(current_user["sub"])
        )
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    
    farm.auto_mode = payload.get("auto_mode", True)
    await db.commit()
    await db.refresh(farm)
    
    return {
        "farm_id": farm_id,
        "auto_mode": farm.auto_mode,
        "message": "Auto mode updated successfully"
    }


# Returns full details of a single farm owned by the current user
@router.get("/{farm_id}", response_model=FarmOut)
async def get_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Fetch a single farm by ID, verifying ownership."""
    farm = await _get_farm_or_404(farm_id, int(current_user["sub"]), db)
    return farm


@router.patch("/{farm_id}/resources")
async def update_farm_resources(
    farm_id: int,
    body: FarmResourceUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update water and energy consumption directly from the simulator/edge device."""
    farm = await _get_farm_or_404(farm_id, int(current_user["sub"]), db)
    
    # Deduct water consumed — floor at 0 to prevent negative tank levels
    farm.current_water_level = max(0.0, farm.current_water_level - body.water_consumed_l)

    # Accumulate total energy usage across all sessions
    farm.total_energy_kwh += body.energy_consumed_kwh
    
    await db.commit()
    await db.refresh(farm)
    return {"status": "success", "water_level": farm.current_water_level, "energy_kwh": farm.total_energy_kwh}


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
    """Fetch farm by ID and verify ownership. Raises 404 if not found or not owned by user."""
    result = await db.execute(
        select(Farm).where(Farm.id == farm_id, Farm.user_id == user_id)
    )
    farm = result.scalar_one_or_none()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm(
    farm_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a farm belonging to the current user."""
    farm = await _get_farm_or_404(farm_id, int(current_user["sub"]), db)
    
    # Note: ensure all related devices and data are deleted before calling this
    # to avoid foreign key constraint violations
    await db.delete(farm)
    await db.commit()
    return None
