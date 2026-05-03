import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import DeviceCommand
from src.api.schemas.schemas import CommandIn, CommandOut
from src.services.mqtt_client import get_mqtt_client

logger = logging.getLogger(__name__)
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

    try:
        mqtt_client = get_mqtt_client()
        command_payload = {
            "command_id": cmd.id,
            "command_type": cmd.command_type,
            "parameters": cmd.parameters or {},
        }
        success = mqtt_client.publish_command(cmd.device_id, cmd.command_type, command_payload)
        if not success:
            logger.warning(f"Failed to publish command {cmd.id} via MQTT, but command saved to database")
    except Exception as e:
        logger.error(f"Error publishing command to MQTT: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to publish command to device")

    await db.commit()
    return cmd
