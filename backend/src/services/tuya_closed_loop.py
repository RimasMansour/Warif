# backend/src/services/tuya_closed_loop.py
"""
Tuya Closed-Loop Climate Control Service
=======================================
Monitors physical sensors on the real Tuya farm, verifies them against crop targets
when cooling is active, and automatically sends physical shutdown commands to Tuya
actuators once the target temperature and humidity are successfully achieved.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from sqlalchemy import select, desc

from src.db.session import AsyncSessionLocal
from src.db.models.models import (
    Farm, SensorReading, ActivityLog, DeviceCommand,
    IrrigationCommand, IrrigationEvent, IrrigationStatus, Actuator, Device
)
from src.services import tuya_client
from src.services.climate_control_policy import evaluate_climate_control

log = logging.getLogger("tuya_closed_loop")

# Standard Crop Profiles matching simulator constants
CROP_PROFILES = {
    "tomatoes": {
        "optimal_temp_max": 27.0,
        "optimal_hum_max": 70.0,
        "optimal_soil_max": 70.0,
    },
    "cucumber": {
        "optimal_temp_max": 28.0,
        "optimal_hum_max": 70.0,
        "optimal_soil_max": 80.0,
    },
    "pepper": {
        "optimal_temp_max": 28.0,
        "optimal_hum_max": 70.0,
        "optimal_soil_max": 65.0,
    },
    "herbs": {
        "optimal_temp_max": 25.0,
        "optimal_hum_max": 70.0,
        "optimal_soil_max": 60.0,
    },
    "default": {
        "optimal_temp_max": 28.0,
        "optimal_hum_max": 70.0,
        "optimal_soil_max": 70.0,
    }
}

async def run_closed_loop_once(db):
    """Check target status for Tuya farm and turn off devices if targets are met."""
    farm_id = tuya_client.get_tuya_farm_id()
    if farm_id <= 0:
        return
    fan_device_id = tuya_client.get_tuya_actuator_device_id("fan") or f"tuya_fan_{farm_id}"
    cooling_device_id = tuya_client.get_tuya_actuator_device_id("cooling") or f"tuya_cooling_{farm_id}"

    # 1. Fetch latest cooling activity log for the Tuya farm
    latest_log_q = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.farm_id == farm_id,
            ActivityLog.action_type.in_([
                "manual_cooling_full",
                "manual_cooling_fan_only",
                "manual_cooling_stop",
                "auto_cooling_full",
                "auto_cooling_fan_only",
                "auto_cooling_stop",
            ]),
        )
        .order_by(desc(ActivityLog.created_at), desc(ActivityLog.id))
        .limit(1)
    )
    latest_log = latest_log_q.scalar_one_or_none()
    if not latest_log:
        return

    # Inferred active cooling mode
    details = latest_log.details or {}
    mode = details.get("mode") or ("full" if "full" in latest_log.action_type else ("fan_only" if "fan_only" in latest_log.action_type else "stop"))
    if mode == "stop" or "stop" in latest_log.action_type:
        # Cooling is physically OFF, nothing to monitor
        return

    # 2. Cooling is active (full or fan_only). Let's load the crop profile
    farm_q = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = farm_q.scalar_one_or_none()
    if not farm:
        return

    crop_type = (farm.crop_type or "default").lower()
    profile = CROP_PROFILES.get(crop_type, CROP_PROFILES["default"])
    target_temp = profile.get("optimal_temp_max", 28.0)
    target_hum = 80.0
    hum_resume_cooling = 75.0

    # 3. Fetch latest physical sensor readings
    temp_q = await db.execute(
        select(SensorReading)
        .where(SensorReading.farm_id == farm_id, SensorReading.sensor_type == "air_temperature")
        .order_by(desc(SensorReading.timestamp))
        .limit(1)
    )
    latest_temp_r = temp_q.scalar_one_or_none()

    hum_q = await db.execute(
        select(SensorReading)
        .where(SensorReading.farm_id == farm_id, SensorReading.sensor_type == "air_humidity")
        .order_by(desc(SensorReading.timestamp))
        .limit(1)
    )
    latest_hum_r = hum_q.scalar_one_or_none()

    if not latest_temp_r or not latest_hum_r:
        # Cannot evaluate without recent readings
        return

    current_temp = latest_temp_r.value
    current_hum = latest_hum_r.value
    climate_decision = evaluate_climate_control(
        current_mode=mode,
        air_temperature=current_temp,
        air_humidity=current_hum,
        target_temperature=target_temp,
        target_humidity=target_hum,
        resume_cooling_humidity=hum_resume_cooling,
    )

    if climate_decision["mode"] == "stop":
        log.info(f"[Tuya Closed-Loop] Climate targets achieved for Farm {farm_id}. Turning OFF cooling and fan.")
        try:
            ok_cooling = await asyncio.to_thread(tuya_client.control_cooling, False)
            ok_fan = await asyncio.to_thread(tuya_client.control_fan, False)
            if ok_cooling or ok_fan:
                stop_cmd = DeviceCommand(
                    device_id=cooling_device_id,
                    command="COOLING_OFF",
                    payload=json.dumps({"fan": False, "cooler": False, "reason": climate_decision["reason"]}),
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    issued_at=datetime.now(timezone.utc)
                )
                db.add(stop_cmd)

                stop_log = ActivityLog(
                    farm_id=farm_id,
                    action_type="auto_cooling_stop",
                    device_id=cooling_device_id,
                    details={
                        "fan": False,
                        "cooler": False,
                        "mode": "stop",
                        "triggered_by": "automation",
                        "reason": climate_decision["reason"],
                        "actual_temp": current_temp,
                        "actual_hum": current_hum,
                        "targets": climate_decision["targets"],
                    },
                    performed_by="system",
                )
                db.add(stop_log)
                await db.commit()
        except Exception as tuya_err:
            log.error(f"[Tuya Closed-Loop] Failed to physically stop cooling: {tuya_err}")
            await db.rollback()
        return

    # 4. Check if targets have been achieved and execute multi-stage physical shut down
    if mode == "full":
        # A. If temperature is achieved or humidity is too high, physically turn off
        # the cooler and keep the fan running for ventilation/dehumidification.
        if climate_decision["mode"] == "fan_only":
            reason = climate_decision["reason"]
            log.info(
                f"[Tuya Closed-Loop] Switching Farm {farm_id} to fan-only "
                f"(temp={current_temp}C target={target_temp}C, hum={current_hum}% target={target_hum}%)."
            )
            try:
                ok_cooler = await asyncio.to_thread(tuya_client.control_cooler_only, False)
                if ok_cooler:
                    # Log stage transition to fan_only in DB
                    cooler_cmd = DeviceCommand(
                        device_id=cooling_device_id,
                        command="COOLER_OFF",
                        payload=json.dumps({"fan": True, "cooler": False}),
                        status="completed",
                        completed_at=datetime.now(timezone.utc),
                        issued_at=datetime.now(timezone.utc)
                    )
                    db.add(cooler_cmd)
                    
                    stage_log = ActivityLog(
                        farm_id=farm_id,
                        action_type="auto_cooling_fan_only",
                        device_id=cooling_device_id,
                        details={
                            "fan": True,
                            "cooler": False,
                            "mode": "fan_only",
                            "triggered_by": "automation",
                            "reason": reason,
                            "actual_temp": current_temp,
                            "actual_hum": current_hum,
                            "targets": climate_decision["targets"],
                        },
                        performed_by="system",
                    )
                    db.add(stage_log)
                    await db.commit()
            except Exception as tuya_err:
                log.error(f"[Tuya Closed-Loop] Failed to physically turn off cooler: {tuya_err}")
                await db.rollback()

    # B. If we are in fan_only mode (or if we just transitioned because temp is achieved):
    # Fetch the latest state again to see if cooler is now OFF or was never ON
    latest_log_q = await db.execute(
        select(ActivityLog)
        .where(
            ActivityLog.farm_id == farm_id,
            ActivityLog.action_type.in_([
                "manual_cooling_full",
                "manual_cooling_fan_only",
                "manual_cooling_stop",
                "auto_cooling_full",
                "auto_cooling_fan_only",
                "auto_cooling_stop",
            ]),
        )
        .order_by(desc(ActivityLog.created_at), desc(ActivityLog.id))
        .limit(1)
    )
    latest_log = latest_log_q.scalar_one_or_none()
    details = latest_log.details if latest_log else {}
    current_mode = details.get("mode") or ("full" if "full" in latest_log.action_type else ("fan_only" if "fan_only" in latest_log.action_type else "stop")) if latest_log else "stop"

    if current_mode == "fan_only" and climate_decision["mode"] == "full":
        log.info(
            f"[Tuya Closed-Loop] Humidity is safe for Farm {farm_id} ({current_hum}% <= "
            f"{hum_resume_cooling}%). Resuming full cooling because temp is {current_temp}C."
        )
        try:
            ok_cooler = await asyncio.to_thread(tuya_client.control_cooler_only, True)
            if ok_cooler:
                cooler_cmd = DeviceCommand(
                    device_id=cooling_device_id,
                    command="COOLER_ON",
                    payload=json.dumps({"fan": True, "cooler": True}),
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    issued_at=datetime.now(timezone.utc)
                )
                db.add(cooler_cmd)

                full_log = ActivityLog(
                    farm_id=farm_id,
                    action_type="auto_cooling_full",
                    device_id=cooling_device_id,
                    details={
                        "fan": True,
                        "cooler": True,
                        "mode": "full",
                        "triggered_by": "automation",
                        "reason": climate_decision["reason"],
                        "actual_temp": current_temp,
                        "actual_hum": current_hum,
                        "targets": climate_decision["targets"],
                    },
                    performed_by="system",
                )
                db.add(full_log)
                await db.commit()
        except Exception as tuya_err:
            log.error(f"[Tuya Closed-Loop] Failed to physically resume cooler: {tuya_err}")
            await db.rollback()

    elif current_mode == "fan_only" and climate_decision["mode"] == "stop":
        log.info(f"[Tuya Closed-Loop] Climate targets achieved for Farm {farm_id}. Turning OFF physical fan.")
        try:
            ok_fan = await asyncio.to_thread(tuya_client.control_fan, False)
            if ok_fan:
                fan_cmd = DeviceCommand(
                    device_id=fan_device_id,
                    command="FAN_OFF",
                    payload=json.dumps({"fan": False, "cooler": False}),
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    issued_at=datetime.now(timezone.utc)
                )
                db.add(fan_cmd)
                
                stop_log = ActivityLog(
                    farm_id=farm_id,
                    action_type="auto_cooling_stop",
                    device_id=fan_device_id,
                    details={
                        "fan": False,
                        "cooler": False,
                        "mode": "stop",
                        "triggered_by": "automation",
                        "reason": "climate targets successfully achieved",
                        "actual_temp": current_temp,
                        "actual_hum": current_hum,
                        "targets": climate_decision["targets"],
                    },
                    performed_by="system",
                )
                db.add(stop_log)
                await db.commit()
        except Exception as tuya_err:
            log.error(f"[Tuya Closed-Loop] Failed to physically turn off fan: {tuya_err}")
            await db.rollback()

async def run_irrigation_closed_loop_once(db):
    """Check target status for Tuya farm's irrigation and turn off valve if targets are met or safety timeout reached."""
    farm_id = tuya_client.get_tuya_farm_id()
    if farm_id <= 0:
        return

    # 1. Fetch latest active irrigation event for the Tuya farm
    from sqlalchemy.orm import selectinload
    irr_evt_q = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(
            Device.farm_id == farm_id,
            IrrigationEvent.status == IrrigationStatus.active,
        )
        .options(selectinload(IrrigationEvent.command).selectinload(IrrigationCommand.actuator))
        .order_by(desc(IrrigationEvent.timestamp))
        .limit(1)
    )
    event = irr_evt_q.scalar_one_or_none()
    if not event:
        return

    # 2. Irrigation is running physically. Let's load the crop profile
    farm_q = await db.execute(select(Farm).where(Farm.id == farm_id))
    farm = farm_q.scalar_one_or_none()
    if not farm:
        return

    crop_type = (farm.crop_type or "default").lower()
    profile = CROP_PROFILES.get(crop_type, CROP_PROFILES["default"])
    target_soil = profile.get("optimal_soil_max", 70.0)

    # 3. Fetch latest physical soil moisture reading
    soil_q = await db.execute(
        select(SensorReading)
        .where(SensorReading.farm_id == farm_id, SensorReading.sensor_type == "soil_moisture")
        .order_by(desc(SensorReading.timestamp))
        .limit(1)
    )
    latest_soil_r = soil_q.scalar_one_or_none()
    current_soil = latest_soil_r.value if latest_soil_r else None

    # 4. Check targets & safety timeout
    target_met = False
    stop_reason = ""
    
    # A. Check soil saturation target
    if current_soil is not None and current_soil >= target_soil:
        target_met = True
        stop_reason = f"soil_saturated (moisture {current_soil}% >= {target_soil}%)"

    # B. Check safety duration timeout
    if not target_met:
        # Calculate running duration in minutes
        started_at = event.timestamp
        if started_at:
            start_utc = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
            elapsed_minutes = (datetime.now(timezone.utc) - start_utc).total_seconds() / 60
            
            # Default safety backup of 20 minutes if command doesn't have duration_min
            duration_min = event.command.duration_min or 20
            if elapsed_minutes >= duration_min:
                target_met = True
                stop_reason = f"safety_timeout (running for {elapsed_minutes:.1f} min >= {duration_min} min)"

    # 5. If stop conditions are met, physically turn off the valve!
    if target_met:
        log.info(f"[Tuya Closed-Loop] Stopping physical irrigation for Farm {farm_id} due to: {stop_reason}")
        try:
            ok = await asyncio.to_thread(tuya_client.control_irrigation, False)
            if not ok:
                log.warning("[Tuya Closed-Loop] Physical irrigation stop returned false")
        except Exception as tuya_err:
            log.error(f"[Tuya Closed-Loop] Failed to physically stop irrigation: {tuya_err}")
            return

        # 6. Set IrrigationEvent to completed in database
        event.status = IrrigationStatus.completed
        
        # 7. Log to Activity Logs
        activity = ActivityLog(
            farm_id=farm_id,
            action_type="irrigation_auto_stop",
            device_id=event.command.actuator.device_id,
            details={
                "reason": stop_reason,
                "soil_moisture": current_soil,
                "triggered_by": "automation",
            },
            performed_by="system",
        )
        db.add(activity)
        
        # 8. Record completed valve command to keep UI in sync
        valve_cmd = DeviceCommand(
            device_id=event.command.actuator.device_id,
            command="VALVE_OFF",
            payload=json.dumps({"valve": False, "reason": stop_reason}),
            status="completed",
            completed_at=datetime.now(timezone.utc),
            issued_at=datetime.now(timezone.utc)
        )
        db.add(valve_cmd)
        
        await db.commit()
        log.info(f"[Tuya Closed-Loop] Database state committed for physical irrigation shutdown on Farm {farm_id}.")

async def run():
    """Service poll loop. Runs every 30 seconds to monitor physical Tuya climate and irrigation state."""
    log.info("[Tuya Closed-Loop] Service started — checking every 30s")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_closed_loop_once(db)
                await run_irrigation_closed_loop_once(db)
        except Exception as e:
            log.error(f"[Tuya Closed-Loop] Error in cycle: {e}")
        await asyncio.sleep(30)
