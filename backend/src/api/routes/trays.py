# backend/src/api/routes/trays.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import get_db
from src.db.models.models import Tray
from src.api.schemas.schemas import TrayIn, TrayOut

router = APIRouter()


@router.get("", response_model=List[TrayOut])
async def list_trays(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tray).where(Tray.is_active == True))
    return result.scalars().all()


@router.post("", response_model=TrayOut, status_code=201)
async def create_tray(payload: TrayIn, db: AsyncSession = Depends(get_db)):
    tray = Tray(**payload.model_dump())
    db.add(tray)
    await db.flush()
    await db.refresh(tray)
    return tray


@router.put("/{tray_id}", response_model=TrayOut)
async def update_tray(tray_id: int, payload: TrayIn, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tray).where(Tray.id == tray_id))
    tray = result.scalar_one_or_none()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tray, k, v)
    await db.flush()
    return tray


@router.delete("/{tray_id}", status_code=204)
async def delete_tray(tray_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tray).where(Tray.id == tray_id))
    tray = result.scalar_one_or_none()
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    tray.is_active = False   # soft delete
    await db.flush()
