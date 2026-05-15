# backend/src/api/routes/commands.py
"""
Commands Routes — Warif API
============================
Handles device command and cooling control endpoints:
  - GET  /commands         : list recent device commands
  - POST /commands         : send a command to a device via MQTT
  - POST /commands/cooling : control fan and cooler units for a farm

All endpoints require JWT authentication.
Farm ownership is verified on cooling commands.
"""
import logging
import json
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
from src.db.models.models import DeviceCommand, ActivityLog, Farm
from src.api.schemas.schemas import CommandIn, CommandOut
from src.services.mqtt_client import get_mqtt_client
from src.core.security import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# Returns recent device commands ordered by most recent first
@router.get("", response_model=List[CommandOut])
async def list_commands(limit: int = 50, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    result = await db.execute(
        select(DeviceCommand).order_by(desc(DeviceCommand.issued_at)).limit(limit)
    )
    return result.scalars().all()


# Sends a command to a physical device via MQTT broker
# Command is saved to DB first, then published to MQTT
@router.post("", response_model=CommandOut, status_code=201)
async def send_command(payload: CommandIn, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
# Controls fan and cooler units for a specific farm
# Verifies farm ownership before executing any command
@router.post("/cooling", status_code=201)
async def control_cooling(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    fan_state = payload.get("fan", False)
    cooler_state = payload.get("cooler", False)
    farm_id_from_payload = payload.get("farm_id")
    
    if farm_id_from_payload:
        # Verify the requesting user owns this farm
        farm_check = await db.execute(
            select(Farm).where(
                Farm.id == int(farm_id_from_payload),
                Farm.user_id == int(current_user["sub"])
            )
        )
        if not farm_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied: Farm not owned by current user")
        farm_id = farm_id_from_payload
    else:
        # Get user's first farm
        result = await db.execute(
            select(Farm).where(Farm.user_id == int(current_user["sub"]))
        )
        farm = result.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="No farm found for user")
        farm_id = farm.id
    
    # Save fan and cooler commands as pending device commands
    fan_cmd = DeviceCommand(
        device_id=f"fan_unit_{farm_id}",
        command="FAN_ON" if fan_state else "FAN_OFF",
        payload=json.dumps({"fan": fan_state, "cooler": cooler_state}),
        status="pending",
        issued_at=datetime.now(timezone.utc)
    )
    db.add(fan_cmd)
    
    cooler_cmd = DeviceCommand(
        device_id=f"cooling_unit_{farm_id}",
        command="COOLER_ON" if cooler_state else "COOLER_OFF",
        payload=json.dumps({"fan": fan_state, "cooler": cooler_state}),
        status="pending",
        issued_at=datetime.now(timezone.utc)
    )
    db.add(cooler_cmd)

    mode = "full" if fan_state and cooler_state else ("fan_only" if fan_state else "stop")
    log = ActivityLog(
        farm_id=farm_id,
        action_type=f"manual_cooling_{mode}",
        device_id=f"fan_unit_{farm_id}",
        details={"fan": fan_state, "cooler": cooler_state, "mode": mode},
        performed_by="user",
    )
    db.add(log)
    await db.commit()

    return {
        "success": True,
        "fan": fan_state,
        "cooler": cooler_state,
        "farm_id": farm_id
    }
