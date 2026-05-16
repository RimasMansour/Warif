<<<<<<< HEAD
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
=======
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
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.db.session import get_db
<<<<<<< HEAD
from src.db.models.models import DeviceCommand, ActivityLog, Recommendation, Farm
=======
from src.db.models.models import DeviceCommand, ActivityLog, Farm
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
from src.api.schemas.schemas import CommandIn, CommandOut
from src.services.mqtt_client import get_mqtt_client
from src.core.security import get_current_user
from src.ai.engine import verify_action_outcome

logger = logging.getLogger(__name__)
router = APIRouter()


<<<<<<< HEAD
# ─── Continuous Learning Helpers ──────────────────────────────────────────────

async def _log_manual_override_feedback(
    db: AsyncSession,
    farm_id: int,
    action_category: str,
    user_action_is_on: bool,
):
    """
    إذا كان المستخدم يتصرف عكس ما أوصى به الذكاء الاصطناعي مؤخراً،
    نسجل فيدباك سلبي على تلك التوصية لتحسين النموذج.
    """
    try:
        since = datetime.now(timezone.utc) - timedelta(minutes=30)
        result = await db.execute(
            select(Recommendation)
            .where(
                Recommendation.farm_id == farm_id,
                Recommendation.category == action_category,
                Recommendation.created_at >= since,
                Recommendation.helpful.is_(None),
            )
            .order_by(desc(Recommendation.created_at))
            .limit(1)
        )
        recent_rec = result.scalar_one_or_none()

        if recent_rec is None:
            return

        # هل التوصية الأخيرة كانت لتفعيل نفس الفعل أم إيقافه؟
        msg_lower = (recent_rec.message or "").lower()
        ai_suggested_on = any(
            kw in msg_lower for kw in ["تفعيل", "تشغيل", "irrigate", "cool", "activate", "start"]
        )

        # إذا تعارض المستخدم مع الذكاء الاصطناعي → فيدباك سلبي
        if ai_suggested_on != user_action_is_on:
            recent_rec.helpful = False
            recent_rec.feedback_at = datetime.now(timezone.utc)
            note = f"[OVERRIDE]: User manually {'activated' if user_action_is_on else 'deactivated'} {action_category}, contradicting AI recommendation."
            current_reasoning = recent_rec.reasoning or ""
            recent_rec.reasoning = f"{current_reasoning}\n{note}".strip()
            db.add(recent_rec)
            logger.info(f"[ContinuousLearning] Negative feedback logged for rec {recent_rec.id} - user override detected.")
    except Exception as e:
        logger.warning(f"[ContinuousLearning] Could not log override feedback: {e}")


=======
# Returns recent device commands ordered by most recent first
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
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
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
<<<<<<< HEAD
    """
    التحكم في منظومة التبريد (مروحة + مبرد).
    - الوضع اليدوي: يسجل التعارض مع توصيات الذكاء الاصطناعي (فيدباك سلبي).
    - الوضع التلقائي: يطلق مهمة التحقق الفيزيائي في الخلفية.
    """
    import json

=======
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
    fan_state = payload.get("fan", False)
    cooler_state = payload.get("cooler", False)
    farm_id_from_payload = payload.get("farm_id")
    is_auto_mode = payload.get("auto_mode", False)  # True عندما تكون الأتمتة هي المُشغِّل
    recommendation_id = payload.get("recommendation_id")  # لربط المهمة الخلفية بالتوصية المصدر

    # ── BOLA Protection: تحقق من ملكية المزرعة ──────────────────────────────
    if farm_id_from_payload:
<<<<<<< HEAD
=======
        # Verify the requesting user owns this farm
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
        farm_check = await db.execute(
            select(Farm).where(
                Farm.id == int(farm_id_from_payload),
                Farm.user_id == int(current_user["sub"])
            )
        )
        if not farm_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied: Farm not owned by current user")
        farm_id = int(farm_id_from_payload)
    else:
        result = await db.execute(
            select(Farm).where(Farm.user_id == int(current_user["sub"]))
        )
        farm = result.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="No farm found for user")
        farm_id = farm.id
<<<<<<< HEAD

    # ── Continuous Learning: Override Detection (Manual Mode) ─────────────────
    if not is_auto_mode:
        user_action_is_on = fan_state or cooler_state
        await _log_manual_override_feedback(
            db=db,
            farm_id=farm_id,
            action_category="temperature",
            user_action_is_on=user_action_is_on,
        )

    # ── Save Device Commands ──────────────────────────────────────────────────
=======
    
    # Save fan and cooler commands as pending device commands
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
    fan_cmd = DeviceCommand(
        device_id=f"fan_unit_{farm_id}",
        command="FAN_ON" if fan_state else "FAN_OFF",
        payload=json.dumps({"fan": fan_state, "cooler": cooler_state}),
        status="pending",
        issued_at=datetime.now(timezone.utc)
    )
    db.add(fan_cmd)
<<<<<<< HEAD

=======
    
>>>>>>> 7cef6c902d234667ffd74d42f9f56a613e01d0f4
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
        action_type=f"{'auto' if is_auto_mode else 'manual'}_cooling_{mode}",
        device_id=f"fan_unit_{farm_id}",
        details={
            "fan": fan_state,
            "cooler": cooler_state,
            "mode": mode,
            "triggered_by": "automation" if is_auto_mode else "user",
        },
        performed_by="system" if is_auto_mode else "user",
    )
    db.add(log)
    await db.commit()

    # ── Autonomous Validation Loop (Auto Mode Only) ───────────────────────────
    # إذا كان التشغيل تلقائياً وكانت هناك توصية مرتبطة، نطلق التحقق الفيزيائي
    if is_auto_mode and recommendation_id and (fan_state or cooler_state):
        background_tasks.add_task(
            verify_action_outcome,
            recommendation_id=int(recommendation_id),
            action_type="cooling",
            farm_id=farm_id,
            target_metric="air_temperature",
            target_value=28.0,  # الهدف العلمي: درجة حرارة أقل من 28°م
            operator="less_than",
        )
        logger.info(
            f"[AutoLoop] Scheduled verify_action_outcome for cooling rec={recommendation_id}, farm={farm_id}"
        )

    return {
        "success": True,
        "fan": fan_state,
        "cooler": cooler_state,
        "farm_id": farm_id,
        "mode": "auto" if is_auto_mode else "manual",
    }


@router.post("/irrigation", status_code=201)
async def control_irrigation(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    التحكم في منظومة الري.
    - الوضع اليدوي: يسجل التعارض مع توصيات الذكاء الاصطناعي.
    - الوضع التلقائي: يطلق مهمة التحقق الفيزيائي (رطوبة التربة) في الخلفية.
    """
    import json

    valve_state = payload.get("valve", False)
    duration_min = payload.get("duration_min", 10)
    farm_id_from_payload = payload.get("farm_id")
    is_auto_mode = payload.get("auto_mode", False)
    recommendation_id = payload.get("recommendation_id")

    # ── BOLA Protection ───────────────────────────────────────────────────────
    if farm_id_from_payload:
        farm_check = await db.execute(
            select(Farm).where(
                Farm.id == int(farm_id_from_payload),
                Farm.user_id == int(current_user["sub"])
            )
        )
        if not farm_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Access denied: Farm not owned by current user")
        farm_id = int(farm_id_from_payload)
    else:
        result = await db.execute(
            select(Farm).where(Farm.user_id == int(current_user["sub"]))
        )
        farm = result.scalars().first()
        if not farm:
            raise HTTPException(status_code=404, detail="No farm found for user")
        farm_id = farm.id

    # ── Continuous Learning: Override Detection (Manual Mode) ─────────────────
    if not is_auto_mode:
        await _log_manual_override_feedback(
            db=db,
            farm_id=farm_id,
            action_category="irrigation",
            user_action_is_on=valve_state,
        )

    # ── Save Device Commands ──────────────────────────────────────────────────
    valve_cmd = DeviceCommand(
        device_id=f"irrigation_valve_{farm_id}",
        command="VALVE_OPEN" if valve_state else "VALVE_CLOSE",
        payload=json.dumps({"valve": valve_state, "duration_min": duration_min}),
        status="pending",
        issued_at=datetime.now(timezone.utc)
    )
    db.add(valve_cmd)

    log = ActivityLog(
        farm_id=farm_id,
        action_type=f"{'auto' if is_auto_mode else 'manual'}_irrigation_{'start' if valve_state else 'stop'}",
        device_id=f"irrigation_valve_{farm_id}",
        details={
            "valve": valve_state,
            "duration_min": duration_min,
            "triggered_by": "automation" if is_auto_mode else "user",
        },
        performed_by="system" if is_auto_mode else "user",
    )
    db.add(log)
    await db.commit()

    # ── Autonomous Validation Loop (Auto Mode Only) ───────────────────────────
    if is_auto_mode and recommendation_id and valve_state:
        background_tasks.add_task(
            verify_action_outcome,
            recommendation_id=int(recommendation_id),
            action_type="irrigation",
            farm_id=farm_id,
            target_metric="soil_moisture",
            target_value=60.0,  # الهدف العلمي: رطوبة تربة ≥ 60%
            operator="greater_than",
        )
        logger.info(
            f"[AutoLoop] Scheduled verify_action_outcome for irrigation rec={recommendation_id}, farm={farm_id}"
        )

    return {
        "success": True,
        "valve": valve_state,
        "duration_min": duration_min,
        "farm_id": farm_id,
        "mode": "auto" if is_auto_mode else "manual",
    }
