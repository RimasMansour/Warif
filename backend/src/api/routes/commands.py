# backend/src/api/routes/commands.py
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import DeviceCommand
from src.api.schemas.schemas import CommandIn, CommandOut

router = APIRouter()


@router.get("", response_model=List[CommandOut])
async def list_commands(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DeviceCommand).order_by(desc(DeviceCommand.issued_at)).limit(limit)
    )
    return result.scalars().all()


@router.post("", response_model=CommandOut, status_code=201)
async def send_command(payload: CommandIn, db: AsyncSession = Depends(get_db)):
    cmd = DeviceCommand(**payload.model_dump())
    db.add(cmd)
    await db.flush()
    await db.refresh(cmd)
    # TODO: publish command to MQTT broker via mqtt.client
    return cmd
