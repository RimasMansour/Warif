#!/usr/bin/env python
# backend/scripts/physics_engine_simulator.py
"""
Warif Physics Engine Simulator (Digital Twin) - Universal Daemon
Simulates physics (thermodynamics, water, energy) for ALL registered farms.

Scientific References:
- Allen et al. (1998) FAO Irrigation and Drainage Paper 56 - Crop evapotranspiration
- Stanghellini (1987) - Transpiration of greenhouse crops
- ASHRAE Fundamentals Handbook (2021) - Evaporative Cooling, Chapter 41
- Abdel-Ghany & Kozai (2006) - Dynamic modeling of greenhouse temperature
"""
import os
import sys
from pathlib import Path

# Always load from backend directory regardless of where script is run
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(str(BACKEND_DIR))

import asyncio
import json
import time
import requests
import math
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
MAKKAH_TZ = ZoneInfo("Asia/Riyadh")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.db.session import AsyncSessionLocal
from src.db.models.models import (
    Farm, Device, Actuator, SensorReading, 
    Recommendation, Alert, AlertSeverity, AlertStatus,
    IrrigationCommand, IrrigationEvent, IrrigationStatus, IrrigationMode,
    DeviceCommand, ActivityLog
)


async def log_action(db, farm_id, action_type, device_id=None,
                     details=None, performed_by="system"):
    try:
        from src.db.models.models import ActivityLog
        log = ActivityLog(
            farm_id=farm_id,
            action_type=action_type,
            device_id=device_id,
            details=details or {},
            performed_by=performed_by,
        )
        db.add(log)
    except Exception:
        pass  # Never block simulation for logging


# --- Engineering Constants (Science-Based) ---
# Greenhouse specs
AREA_SQM = 80.0
HEIGHT_M = 3.0
VOLUME_CBM = AREA_SQM * HEIGHT_M  # 240 m³

# Fan: evaporative desert cooler
# Ref: ASHRAE Fundamentals 2021, Chapter 41
FAN_POWER_KW = 1.1
FAN_FLOW_CMH = 44000.0
EVAP_EFFICIENCY_BASE = 0.70  # 70% in dry Makkah climate

# Pump: drip irrigation
# Ref: FAO Paper 56 (Allen et al., 1998)
PUMP_FLOW_L_PER_MIN = 20.0
PUMP_POWER_KW = 0.5
# 20L/min → 3.33L/10s over 80m² → ~0.5% VWC increase per tick
SOIL_MOISTURE_GAIN_PER_TICK = 0.5

# Soil drying rate
# Ref: Stanghellini (1987) - at 30°C, 80m² loses ~0.08% VWC per 10s
SOIL_DRY_FACTOR = 0.08

TANK_CAPACITY_L = 1000.0
INTERVAL = 10  # seconds

# --- Crop Profiles ---
# Ref: FAO Paper 56 + Hochmuth (2001) Vegetable Production Guide
CROP_PROFILES = {
    "tomatoes": {
        "optimal_soil_min": 60,
        "optimal_soil_max": 70,
        "optimal_temp_min": 18,
        "optimal_temp_max": 27,
        "water_demand": 1.0,
        "dry_rate_factor": 1.0,
    },
    "cucumber": {
        "optimal_soil_min": 60,
        "optimal_soil_max": 80,
        "optimal_temp_min": 18,
        "optimal_temp_max": 28,
        "water_demand": 1.3,
        "dry_rate_factor": 1.2,
    },
    "pepper": {
        "optimal_soil_min": 55,
        "optimal_soil_max": 65,
        "optimal_temp_min": 20,
        "optimal_temp_max": 28,
        "water_demand": 0.9,
        "dry_rate_factor": 0.9,
    },
    "herbs": {
        "optimal_soil_min": 40,
        "optimal_soil_max": 60,
        "optimal_temp_min": 15,
        "optimal_temp_max": 25,
        "water_demand": 0.7,
        "dry_rate_factor": 0.7,
    },
    "default": {
        "optimal_soil_min": 70,
        "optimal_soil_max": 80,
        "optimal_temp_min": 20,
        "optimal_temp_max": 30,
        "water_demand": 1.3,
        "dry_rate_factor": 1.2,
    }
}

farm_states = {}
_engine_loop_running = False

def fetch_makkah_weather():
    url = "https://api.open-meteo.com/v1/forecast?latitude=21.3891&longitude=39.8579&current=temperature_2m,relative_humidity_2m,cloudcover,is_day&timezone=auto"
    try:
        r = requests.get(url, timeout=5)
        data = r.json()["current"]
        return data["temperature_2m"], data["relative_humidity_2m"], data["cloudcover"], data["is_day"]
    except Exception:
        return 35.0, 30.0, 0, 1

def calculate_lux(is_day, cloudcover):
    if not is_day:
        return 0.0
    hour = datetime.now(MAKKAH_TZ).hour
    if hour < 6 or hour > 18:
        return 0.0
    intensity = 1.0 - ((hour - 12) / 6.0) ** 2
    max_lux = 100000.0 * (1.0 - (cloudcover / 100.0) * 0.5)
    return max(0.0, (intensity * max_lux) * 0.7)

# --- Simulation Registry ---
# Only these farms will be managed by the physics engine.
# Remove a Farm ID from this list when you connect real hardware to it.
SIMULATED_FARM_IDS = [20]

async def process_farm(db, farm, ext_temp, ext_hum, lux, is_day=True):
    fid = farm.id
    
    # Check if this farm is registered for simulation
    if fid not in SIMULATED_FARM_IDS:
        return

    # Get crop profile
    crop_type = (farm.crop_type or "default").lower()
    profile = CROP_PROFILES.get(crop_type, CROP_PROFILES["default"])

    # Check farm auto_mode setting
    farm_auto_mode = getattr(farm, 'auto_mode', True)

    # Initialize physics state from last DB readings
    # Ref: Stanghellini (1987) - optimal starting conditions
    if fid not in farm_states:
        last_soil = await db.execute(
            select(SensorReading)
            .where(SensorReading.sensor_type == "soil_moisture")
            .where(SensorReading.farm_id == fid)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        last_soil_r = last_soil.scalar_one_or_none()
        init_soil = last_soil_r.value if last_soil_r else float(
            (profile["optimal_soil_min"] + profile["optimal_soil_max"]) / 2
        )

        last_temp = await db.execute(
            select(SensorReading)
            .where(SensorReading.sensor_type == "air_temperature")
            .where(SensorReading.farm_id == fid)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        last_temp_r = last_temp.scalar_one_or_none()
        init_temp = last_temp_r.value if last_temp_r else ext_temp

        last_hum = await db.execute(
            select(SensorReading)
            .where(SensorReading.sensor_type == "air_humidity")
            .where(SensorReading.farm_id == fid)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        last_hum_r = last_hum.scalar_one_or_none()
        init_hum = last_hum_r.value if last_hum_r else ext_hum

        farm_states[fid] = {
            "internal_temp": init_temp,
            "internal_hum": init_hum,
            "soil_moisture": max(0.0, min(100.0, init_soil)),
            "soil_temp": ext_temp - 3.0,
            "fan_on": False,
            "cooler_on": False,
            "cooling_on": False,
        }

    state = farm_states[fid]

    latest_cooling_log = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.farm_id == fid)
        .where(ActivityLog.action_type.in_([
            "manual_cooling_full",
            "manual_cooling_fan_only",
            "manual_cooling_stop",
            "auto_cooling_full",
            "auto_cooling_fan_only",
            "auto_cooling_stop",
        ]))
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(1)
    )
    latest_cooling_log = latest_cooling_log.scalar_one_or_none()
    if latest_cooling_log and state.get("last_cooling_log_id") != latest_cooling_log.id:
        details = latest_cooling_log.details if isinstance(latest_cooling_log.details, dict) else {}
        mode = details.get("mode") or (
            "full" if "full" in latest_cooling_log.action_type
            else "fan_only" if "fan_only" in latest_cooling_log.action_type
            else "stop"
        )
        state["fan_on"] = bool(details.get("fan", mode in {"full", "fan_only"}))
        state["cooler_on"] = bool(details.get("cooler", mode == "full"))
        state["cooling_on"] = bool(state["fan_on"] and state["cooler_on"])
        state["manual_cooling_active"] = mode in {"full", "fan_only"}
        state["manual_cooling_until"] = None if state["manual_cooling_active"] else state.get("manual_cooling_until")
        if state["manual_cooling_active"]:
            state["cooling_target_temp"] = profile.get("optimal_temp_max", 28.0)
            state["cooling_target_hum"] = 80.0
            state["cooling_resume_hum"] = 75.0
        state["last_cooling_log_id"] = latest_cooling_log.id

    # Check if pump is active
    pump_on = False
    irr_evt = await db.execute(
        select(IrrigationEvent)
        .join(IrrigationCommand)
        .join(Actuator)
        .join(Device)
        .where(Device.farm_id == fid)
        .order_by(IrrigationEvent.timestamp.desc())
        .limit(1)
    )
    evt = irr_evt.scalar_one_or_none()
    if evt and evt.status.value == "active":
        pump_on = True

        # Auto-stop: soil saturated (FAO Paper 56)
        if state.get("soil_moisture", 0) >= profile["optimal_soil_max"]:
            evt.status = IrrigationStatus.completed
            await db.flush()
            pump_on = False
            await log_action(db, fid, "irrigation_auto_stop", f"irrigation_{fid}",
                {"reason": "soil_saturated", "soil_moisture": round(state.get("soil_moisture", 0), 1)})
            print(f"[AUTO-STOP] Farm {fid} | Soil saturated {state.get('soil_moisture',0):.1f}% >= {profile['optimal_soil_max']}% → stopped")

        # Auto-stop: water tank empty
        elif farm.current_water_level <= 0:
            evt.status = IrrigationStatus.completed
            await db.flush()
            pump_on = False
            farm.current_water_level = 0.0
            await log_action(db, fid, "irrigation_auto_stop", f"irrigation_{fid}",
                {"reason": "water_tank_empty", "soil_moisture": round(state.get("soil_moisture", 0), 1)})
            print(f"[AUTO-STOP] Farm {fid} | Water tank empty → stopped")

    # === CHECK MANUAL COOLING COMMANDS ===
    manual_fan = False
    manual_cooler = False
    manual_override = False

    try:
        # Check for recent cooling command (last 10 minutes)
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        
        # Check fan command
        fan_cmd = await db.execute(
            select(DeviceCommand)
            .where(DeviceCommand.device_id == f"fan_unit_{fid}")
            .where(DeviceCommand.issued_at >= cutoff_time)
            .where(DeviceCommand.status == "pending")
            .order_by(DeviceCommand.issued_at.desc())
            .limit(1)
        )
        fan_cmd_obj = fan_cmd.scalar_one_or_none()
        
        # Check cooler command
        cooler_cmd = await db.execute(
            select(DeviceCommand)
            .where(DeviceCommand.device_id == f"cooling_unit_{fid}")
            .where(DeviceCommand.issued_at >= cutoff_time)
            .where(DeviceCommand.status == "pending")
            .order_by(DeviceCommand.issued_at.desc())
            .limit(1)
        )
        cooler_cmd_obj = cooler_cmd.scalar_one_or_none()
        
        if fan_cmd_obj or cooler_cmd_obj:
            manual_override = True
            if fan_cmd_obj:
                payload = fan_cmd_obj.payload
                if isinstance(payload, str):
                    payload = json.loads(payload)
                payload = payload or {}
                manual_fan = payload.get("fan", False)
            if cooler_cmd_obj:
                payload = cooler_cmd_obj.payload
                if isinstance(payload, str):
                    payload = json.loads(payload)
                payload = payload or {}
                manual_cooler = payload.get("cooler", False)
            
            # Mark commands as completed
            if fan_cmd_obj:
                fan_cmd_obj.status = "completed"
                fan_cmd_obj.completed_at = datetime.now(timezone.utc)
            if cooler_cmd_obj:
                cooler_cmd_obj.status = "completed"
                cooler_cmd_obj.completed_at = datetime.now(timezone.utc)
                
    except Exception as cmd_err:
        try:
            await db.rollback()
        except:
            pass
        print(f"[ERROR] Manual command check failed for Farm {fid}: {cmd_err}")

    # --- Physics Calculations ---

    # Solar heating through greenhouse glass
    # Ref: Abdel-Ghany & Kozai (2006) - glass transmittance ~0.7
    heating_factor = (lux / 100000.0) * 0.4

    # === COOLING DECISION ===
    if manual_override:
        # Check if the command is a stop command (both fan and cooler OFF)
        if not manual_fan and not manual_cooler:
            # User clicked "Stop All" or turned both devices off
            state["fan_on"] = False
            state["cooler_on"] = False
            state["cooling_on"] = False
            state["manual_cooling_active"] = False
            
            # Store manual mode duration (10 min window to prevent auto-restart)
            state["manual_cooling_until"] = (
                datetime.now(timezone.utc) + timedelta(minutes=10)
            ).isoformat()
            
            print(f"[MANUAL STOP] Farm {fid} | Manual cooling stopped by user. 10-min auto-override cooldown started.")
        else:
            # Manual mode activation: user turned on fan and/or cooler
            state["fan_on"] = manual_fan
            state["cooler_on"] = manual_cooler
            state["cooling_on"] = manual_fan and manual_cooler
            state["manual_cooling_active"] = True
            
            # Clear time-based override since we are target-driven now
            state["manual_cooling_until"] = None
            
            # Set target limits based on crop profile
            # Temperature target: profile["optimal_temp_max"] (e.g. 28.0)
            # Humidity guard: full cooling may continue up to 80%, then
            # ventilation pulls it back toward 75% before cooling resumes.
            state["cooling_target_temp"] = profile.get("optimal_temp_max", 28.0)
            state["cooling_target_hum"] = 80.0
            state["cooling_resume_hum"] = 75.0
            
            mode_desc = "FULL" if (manual_fan and manual_cooler) else "FAN ONLY"
            print(f"[MANUAL START] Farm {fid} | Running {mode_desc} until Temp <= {state['cooling_target_temp']}C and Hum <= {state['cooling_target_hum']}%")

    else:
        # Check if we are in target-driven manual cooling mode
        if state.get("manual_cooling_active", False):
            # Target-driven check: has the target been successfully met?
            target_temp = state.get("cooling_target_temp", profile.get("optimal_temp_max", 28.0))
            target_hum = state.get("cooling_target_hum", 80.0)
            hum_resume_cooling = state.get("cooling_resume_hum", 75.0)
            cooling_completed_this_tick = False
            
            # Smart multi-stage cooling logic:
            # 1. If cooler is ON: check if temperature target is reached.
            #    If reached or humidity is already high, turn off cooler immediately
            #    so evaporative cooling does not keep raising greenhouse humidity.
            if state["cooler_on"]:
                if state["internal_temp"] <= target_temp or state["internal_hum"] >= target_hum:
                    state["cooler_on"] = False
                    state["cooling_on"] = False
                    reason = (
                        "humidity limit reached, cooler turned off"
                        if state["internal_hum"] >= target_hum
                        else "temperature target achieved, cooler turned off"
                    )
                    await log_action(
                        db, fid, "auto_cooling_fan_only", f"cooling_unit_{fid}",
                        {
                            "mode": "fan_only",
                            "fan": True,
                            "cooler": False,
                            "reason": reason,
                            "temp": round(state["internal_temp"], 1),
                            "hum": round(state["internal_hum"], 1)
                        }
                    )
                    print(
                        f"[STAGE ACHIEVED] Farm {fid} | Cooler OFF -> fan-only "
                        f"(Temp {state['internal_temp']:.1f}C / target {target_temp}C, "
                        f"Hum {state['internal_hum']:.1f}% / target {target_hum}%)."
                    )
            
            # 2. If fan is ON: check whether humidity and temperature are balanced.
            #    If temperature is already achieved and humidity is safe, turn off the fan too!
            if state["fan_on"]:
                hum_ok = state["internal_hum"] <= target_hum
                temp_ok = state["internal_temp"] <= target_temp

                # If ventilation has pulled humidity back into a safer band but
                # temperature is still high, resume full cooling. This keeps the
                # greenhouse balanced instead of giving up on temperature control.
                if not state["cooler_on"] and not temp_ok and state["internal_hum"] <= hum_resume_cooling:
                    state["cooler_on"] = True
                    state["cooling_on"] = True
                    await log_action(
                        db, fid, "auto_cooling_full", f"cooling_unit_{fid}",
                        {
                            "mode": "full",
                            "fan": True,
                            "cooler": True,
                            "reason": "humidity safe again, resuming cooling until temperature target",
                            "temp": round(state["internal_temp"], 1),
                            "hum": round(state["internal_hum"], 1)
                        }
                    )
                    print(
                        f"[BALANCE] Farm {fid} | Humidity safe ({state['internal_hum']:.1f}% <= "
                        f"{hum_resume_cooling}%) but temp high ({state['internal_temp']:.1f}C > "
                        f"{target_temp}C) -> Full cooling resumed."
                    )
                
                # If cooler is off (or was never on) and the climate is balanced:
                if not state["cooler_on"] and temp_ok and hum_ok:
                    state["fan_on"] = False
                    state["manual_cooling_active"] = False
                    cooling_completed_this_tick = True
                    await log_action(
                        db, fid, "auto_cooling_stop", f"fan_unit_{fid}",
                        {
                            "mode": "stop",
                            "fan": False,
                            "cooler": False,
                            "reason": "climate targets successfully achieved",
                            "temp": round(state["internal_temp"], 1),
                            "hum": round(state["internal_hum"], 1)
                        }
                    )
                    print(f"[STAGE ACHIEVED] Farm {fid} | Climate achieved (Temp <= {target_temp}C and Hum <= {target_hum}%) -> Fan turned OFF.")

            # 3. If both actuators are now OFF, the whole manual cooling cycle is fully complete!
            if not cooling_completed_this_tick and not state["cooler_on"] and not state["fan_on"]:
                state["manual_cooling_active"] = False
                await log_action(
                    db, fid, "auto_cooling_stop", f"cooling_unit_{fid}",
                    {
                        "mode": "stop",
                        "fan": False,
                        "cooler": False,
                        "reason": "climate targets successfully achieved",
                        "temp": round(state["internal_temp"], 1),
                        "hum": round(state["internal_hum"], 1)
                    }
                )
                print(f"[TARGET ACHIEVED] Farm {fid} | Climate fully balanced (Temp: {state['internal_temp']:.1f}C, Hum: {state['internal_hum']:.1f}%) -> Manual cooling completed successfully.")
        else:
            # Check if still in manual STOP window (to prevent auto mode from turning devices back on immediately)
            manual_until = state.get("manual_cooling_until")
            still_manual = False
            if manual_until:
                try:
                    until_dt = datetime.fromisoformat(manual_until)
                    if datetime.now(timezone.utc) < until_dt:
                        still_manual = True
                except:
                    pass
            
            if not still_manual:
                # Automatic mode - Only run if farm auto_mode is enabled
                if farm_auto_mode:
                    # Full cooling: temp >= 28 AND humidity < 85
                    # Ref: Haifa Group Cucumber Guide - ventilation at 26°C, full cooling at 28°C
                    if state["internal_temp"] >= 28.0 and state["internal_hum"] < 85.0:
                        prev_fan = state["fan_on"]
                        state["fan_on"] = True
                        state["cooler_on"] = True
                        state["cooling_on"] = True
                        if not prev_fan:
                            await log_action(db, fid, "fan_auto_on", f"fan_unit_{fid}",
                                {"reason": "temp >= 28C", "temp": round(state["internal_temp"], 1)})
                            await log_action(db, fid, "cooler_auto_on", f"cooling_unit_{fid}",
                                {"reason": "full cooling mode", "temp": round(state["internal_temp"], 1)})
                    # Ventilation only: humidity >= 70 OR temp >= 26
                    # Ref: Haifa Group - optimal humidity 70-90%, ventilation at 26°C
                    elif state["internal_hum"] >= 70.0 or state["internal_temp"] >= 26.0:
                        prev_fan = state["fan_on"]
                        state["fan_on"] = True
                        state["cooler_on"] = False
                        state["cooling_on"] = False
                        if not prev_fan:
                            await log_action(db, fid, "fan_auto_on", f"fan_unit_{fid}",
                                {"reason": "humidity >= 70% or temp >= 26C", "humidity": round(state["internal_hum"], 1)})
                    # All off: good conditions
                    elif state["internal_temp"] < 26.0 and state["internal_hum"] < 70.0:
                        state["fan_on"] = False
                        state["cooler_on"] = False
                        state["cooling_on"] = False
                else:
                    # Manual mode (via auto_mode toggle): stay in current state
                    pass

    # --- Physics Effects ---
    if state["cooling_on"]:
        # When FULL COOLING (fan + cooler):
        # Ref: ASHRAE Ch.41 - cooling efficiency
        cooling_efficiency = EVAP_EFFICIENCY_BASE * (1 - ext_hum/100) * 0.8
        temp_drop = (state["internal_temp"] - ext_temp * 0.7) * cooling_efficiency * 0.15
        target_temp = state.get("cooling_target_temp", profile.get("optimal_temp_max", 28.0))
        if state["internal_temp"] > target_temp:
            controlled_drop = max(0.3, (state["internal_temp"] - target_temp) * 0.2)
            temp_drop = max(temp_drop, controlled_drop)
            state["internal_temp"] = max(target_temp, state["internal_temp"] - temp_drop)
        else:
            state["internal_temp"] -= max(temp_drop, 0.0)
        state["internal_hum"] += 1.0  # cooler adds humidity
        state["internal_hum"] = min(state["internal_hum"], 90.0)

    elif state["fan_on"] and not state["cooler_on"]:
        # When FAN ONLY (ventilation):
        # In the digital twin, fan-only mode is used as a controlled
        # dehumidification stage after evaporative cooling. Move humidity
        # toward the target instead of allowing outdoor humidity to increase it.
        target_hum = state.get("cooling_resume_hum", 75.0)
        if state["internal_hum"] > target_hum:
            hum_reduction = max(0.8, (state["internal_hum"] - target_hum) * 0.12)
            state["internal_hum"] = max(target_hum, state["internal_hum"] - hum_reduction)
        
        # If outdoor is hotter, temp rises slightly
        if ext_temp > state["internal_temp"]:
            state["internal_temp"] += (ext_temp - state["internal_temp"]) * 0.02
    else:
        # Natural heat gain toward outdoor temp + solar gain
        # Ref: Abdel-Ghany & Kozai (2006)
        if state["internal_temp"] < ext_temp + 2.0:
            heat_gain = 0.15 + (0.3 * (1 - math.cos(time.time() / 3600)))
            state["internal_temp"] += heat_gain
        state["internal_temp"] += heating_factor
        diff_hum = ext_hum - state["internal_hum"]
        state["internal_hum"] += (diff_hum * 0.05)


    # === SMART ALERTS GENERATION ===
    # Ref: Warif System Design Section 4.2.1.3
    try:

        # Heat Stress Alert
        if state["internal_temp"] > profile["optimal_temp_max"] + 5:
            heat_exists = await db.execute(
                select(Alert).where(
                    Alert.farm_id == fid,
                    Alert.sensor_type == "air_temperature",
                    Alert.status == AlertStatus.open
                )
            )
            if not heat_exists.scalars().first():
                severity = AlertSeverity.critical if state["internal_temp"] > profile["optimal_temp_max"] + 10 else AlertSeverity.warning
                db.add(Alert(
                    farm_id=fid,
                    sensor_type="air_temperature",
                    severity=severity,
                    status=AlertStatus.open,
                    actual_value=round(state["internal_temp"], 2),
                    message=f"تنبيه حرارة: درجة الحرارة {state['internal_temp']:.1f}°م تتجاوز الحد الأمثل ({profile['optimal_temp_max']}°م)"
                ))
                print(f"[ALERT] Farm {fid} | Heat stress {state['internal_temp']:.1f}°C")

        # Drought Alert
        if state["soil_moisture"] < profile["optimal_soil_min"] - 15:
            drought_exists = await db.execute(
                select(Alert).where(
                    Alert.farm_id == fid,
                    Alert.sensor_type == "soil_moisture",
                    Alert.status == AlertStatus.open
                )
            )
            if not drought_exists.scalars().first():
                severity = AlertSeverity.critical if state["soil_moisture"] < profile["optimal_soil_min"] - 20 else AlertSeverity.warning
                db.add(Alert(
                    farm_id=fid,
                    sensor_type="soil_moisture",
                    severity=severity,
                    status=AlertStatus.open,
                    actual_value=round(state["soil_moisture"], 2),
                    message=f"تنبيه جفاف: رطوبة التربة {state['soil_moisture']:.1f}٪ منخفضة جداً عن الحد الأدنى ({profile['optimal_soil_min']}٪)"
                ))
                print(f"[ALERT] Farm {fid} | Drought stress {state['soil_moisture']:.1f}%")

        # High Humidity Alert
        if state["internal_hum"] > 85:
            hum_exists = await db.execute(
                select(Alert).where(
                    Alert.farm_id == fid,
                    Alert.sensor_type == "air_humidity",
                    Alert.status == AlertStatus.open
                )
            )
            if not hum_exists.scalars().first():
                db.add(Alert(
                    farm_id=fid,
                    sensor_type="air_humidity",
                    severity=AlertSeverity.warning,
                    status=AlertStatus.open,
                    actual_value=round(state["internal_hum"], 2),
                    message=f"تنبيه رطوبة: رطوبة الهواء {state['internal_hum']:.1f}٪ مرتفعة — خطر الأمراض الفطرية"
                ))
                print(f"[ALERT] Farm {fid} | High humidity {state['internal_hum']:.1f}%")

    except Exception as alert_err:
        print(f"[ALERT ERROR] Farm {fid}: {alert_err}")
    # === END SMART ALERTS ===

    # Water from irrigation pump
    irrigation_water = (PUMP_FLOW_L_PER_MIN / 60.0) * INTERVAL if pump_on else 0.0
    # Water from evaporative cooler (5 L/hr = 0.0833 L/min)
    COOLER_WATER_L_PER_MIN = 5.0 / 60.0
    cooler_water = COOLER_WATER_L_PER_MIN * INTERVAL if state["cooler_on"] else 0.0
    water_consumed = irrigation_water + cooler_water

    energy_consumed = 0.0

    if pump_on:
        # Water flow per tick
        # Ref: FAO Paper 56 - drip irrigation flow rates
        # (water_consumed already calculated above)

        energy_consumed += (PUMP_POWER_KW / 3600.0) * INTERVAL
        # Soil moisture increase adjusted by crop water demand
        gain = SOIL_MOISTURE_GAIN_PER_TICK * profile["water_demand"]
        state["soil_moisture"] = min(95.0, state["soil_moisture"] + gain)
        state["soil_temp"] -= 0.05  # irrigation cools soil
    else:
        # Soil drying rate based on temp and crop type
        # Ref: Stanghellini (1987)
        # Temperature accelerates soil drying (Stanghellini 1987)
        temp_factor = max(1.0, (state["internal_temp"] - 25) / 10.0)
        dry_rate = (state["internal_temp"] / 40.0) * SOIL_DRY_FACTOR * profile["dry_rate_factor"] * temp_factor
        state["soil_moisture"] = max(0.0, state["soil_moisture"] - dry_rate)

        # Soil temperature trends toward air temperature gradually
        # Ref: Stanghellini 1987 - soil thermal conductivity
        soil_air_diff = state["internal_temp"] - state["soil_temp"]
        state["soil_temp"] += soil_air_diff * 0.02  # slow thermal equilibrium

    # Clamp soil temp to physical limits
    state["soil_temp"] = max(10.0, min(50.0, state["soil_temp"]))

    if state["fan_on"]:
        # Fan power: 1.1 kW
        energy_consumed += (1.1 / 3600.0) * INTERVAL
    if state["cooler_on"]:
        # Cooler pump power: 0.5 kW
        energy_consumed += (0.5 / 3600.0) * INTERVAL

    # Clamp values to physical limits
    state["internal_temp"] = max(10.0, min(55.0, state["internal_temp"]))
    state["internal_hum"] = max(10.0, min(99.0, state["internal_hum"]))
    state["soil_moisture"] = max(0.0, min(100.0, state["soil_moisture"]))

    # Update farm resource counters in DB
    if water_consumed > 0:
        farm.current_water_level = max(0.0, farm.current_water_level - water_consumed)
        
        # Tank monitoring logic
        if farm.water_tank_capacity > 0:
            pct = (farm.current_water_level / farm.water_tank_capacity) * 100

            if pct <= 5.0:
                # Auto-Refill
                farm.current_water_level = farm.water_tank_capacity
                print(f"[AUTO-REFILL] Farm {fid} | Water tank refilled to {farm.water_tank_capacity}L")
                
                # Resolve low water alerts
                alerts = await db.execute(
                    select(Alert)
                    .where(Alert.farm_id == fid, Alert.status == AlertStatus.open, Alert.sensor_type == "water_tank")
                )
                for a in alerts.scalars().all():
                    a.status = AlertStatus.resolved
                    a.resolved_at = datetime.now(timezone.utc)

            elif pct <= 20.0:
                # Generate Low Water Alert if none exists
                alert_exists = await db.execute(
                    select(Alert)
                    .where(Alert.farm_id == fid, Alert.status == AlertStatus.open, Alert.sensor_type == "water_tank")
                )
                if not alert_exists.scalar_one_or_none():
                    db.add(Alert(
                        farm_id=fid,
                        sensor_type="water_tank",
                        severity=AlertSeverity.warning,
                        status=AlertStatus.open,
                        message=f"تنبيه: مستوى خزان المياه منخفض جداً ({pct:.1f}%). يرجى إعادة التعبئة."
                    ))

    if energy_consumed > 0:
        farm.total_energy_kwh += energy_consumed

    # 1. Device Mapping
    DEVICE_MAP = {
        "soil":     f"soil_sensor_{fid}",
        "climate":  f"climate_sensor_{fid}",
        "cooler":   f"cooling_unit_{fid}",   # evaporative cooler only
        "fan":      f"fan_unit_{fid}",        # fan only
        "irrigation": f"irrigation_{fid}",
    }

    # 2. Auto-register devices if missing
    ARABIC_NAMES = {
        "soil": "حساس التربة",
        "climate": "حساس المناخ",
        "cooler": "المكيف الصحراوي",
        "fan": "المروحة",
        "irrigation": "مضخة الري الذكي"
    }
    
    for d_key, d_id in DEVICE_MAP.items():
        existing = await db.execute(select(Device).where(Device.device_id == d_id))
        if not existing.scalar_one_or_none():
            print(f"[AUTO-CONFIG] Creating device {d_id} for Farm {fid}")
            d_type = "sensor" if d_key in ["soil", "climate"] else "actuator"
            d_name = ARABIC_NAMES.get(d_key, d_id)
            db.add(Device(device_id=d_id, name=d_name, type=d_type, farm_id=fid, status="active"))
            
            # If actuator, add to actuators table too
            if d_type == "actuator":
                db.add(Actuator(
                    device_id=d_id, 
                    actuator_type=d_key if d_key in ["fan", "cooler"] else "irrigation_valve",
                    state="off",
                    power_rating_kw=1.1 if d_key == "fan" else (0.5 if d_key == "cooler" else 0.0)
                ))
    await db.flush() # Ensure devices exist before readings

    # 3. Readings definition
    readings_to_save = [
        (DEVICE_MAP["soil"],      "soil_moisture",     round(state["soil_moisture"], 2),  "%"),
        (DEVICE_MAP["soil"],      "soil_temperature",  round(state["soil_temp"], 2),      "C"),
        (DEVICE_MAP["climate"],   "air_temperature",   round(state["internal_temp"], 2),  "C"),
        (DEVICE_MAP["climate"],   "air_humidity",      round(state["internal_hum"], 2),   "%"),
        (DEVICE_MAP["climate"],   "light_intensity",   round(lux, 1),                     "lux"),
        (DEVICE_MAP["irrigation"],"water_usage",       round(irrigation_water, 3),        "L"),
        (DEVICE_MAP["cooler"],    "water_usage",       round(cooler_water, 3),            "L"),
        (DEVICE_MAP["cooler"],   "power_usage",       round((0.5 / 3600.0 * INTERVAL if state["cooler_on"] else 0) * 1000, 3), "Wh"),
        (DEVICE_MAP["fan"],      "power_usage",       round((1.1 / 3600.0 * INTERVAL if state["fan_on"] else 0) * 1000, 3), "Wh"),
    ]

    # 4. Save to Database and mark devices as online
    from src.services.connectivity_monitor import ConnectivityMonitor
    seen_devices = set()
    for d_id, stype, val, unit in readings_to_save:
        db.add(SensorReading(
            device_id=d_id,
            farm_id=fid,
            sensor_type=stype,
            value=val,
            unit=unit,
            timestamp=datetime.now(timezone.utc)
        ))
        if d_id not in seen_devices:
            await ConnectivityMonitor.update_device_seen(d_id, db)
            seen_devices.add(d_id)

    # ─── DECISION ENGINE INTEGRATION ───
    # Build sensor data dict for Decision Engine
    full_sensor_data = {
        "soil_moisture":    round(state["soil_moisture"], 2),
        "soil_temperature": round(state["soil_temp"], 2),
        "air_temperature":  round(state["internal_temp"], 2),
        "air_humidity":     round(state["internal_hum"], 2),
        "light_intensity":  round(lux, 1),
        "water_usage":      round(water_consumed, 3),
        "power_usage":      round(energy_consumed * 1000, 3),
        "crop_type":        farm.crop_type,
    }

    # Call Decision Engine for recommendations and anomaly detection
    try:
        from src.services.decision_engine import get_engine
        from sqlalchemy import and_

        engine = get_engine()
        intelligence_report = await engine.analyze_with_intelligence(
            full_sensor_data, fid
        )

        # Save recommendations with 5-minute cooldown
        cooldown_5min = datetime.now(timezone.utc) - timedelta(minutes=5)
        for rec in intelligence_report.get('recommendations', []):
            # Use proper AND logic for SQLAlchemy
            existing = await db.execute(
                select(Recommendation).where(
                    and_(
                        Recommendation.farm_id == fid,
                        Recommendation.message == rec.message,
                        Recommendation.created_at >= cooldown_5min
                    )
                )
            )
            if not existing.scalar_one_or_none():
                db.add(Recommendation(
                    farm_id=fid,
                    message=rec.message,
                    reasoning=rec.reasoning,
                    category=rec.category,
                    severity=rec.severity,
                    is_read=False,
                ))
                print(f"[REC] Farm {fid} | Added: {rec.message} ({rec.category})")
        
        # Save alerts with 30-minute cooldown
        cooldown_30min = datetime.now(timezone.utc) - timedelta(minutes=30)
        for anomaly in intelligence_report.get('anomalies', []):
            if anomaly['severity'] in ['critical', 'high']:
                existing_alert = await db.execute(
                    select(Alert).where(
                        and_(
                            Alert.sensor_type == anomaly['sensor'],
                            Alert.farm_id == fid,
                            Alert.status == AlertStatus.open,
                            Alert.created_at >= cooldown_30min
                        )
                    )
                )
                if not existing_alert.scalar_one_or_none():
                    _s = anomaly['sensor']
                    _t = anomaly['type']
                    _val = full_sensor_data.get(_s)
                    _unit = {
                        'air_temperature': '°م', 'soil_temperature': '°م',
                        'air_humidity': '٪', 'soil_moisture': '٪',
                        'light_intensity': ' lux', 'water_usage': ' لتر',
                        'power_usage': ' واط',
                    }.get(_s, '')
                    _sensor_ar = {
                        'air_temperature':  'درجة حرارة الهواء',
                        'air_humidity':     'رطوبة الهواء',
                        'soil_moisture':    'رطوبة التربة',
                        'soil_temperature': 'درجة حرارة التربة',
                        'light_intensity':  'شدة الإضاءة',
                        'water_usage':      'استهلاك المياه',
                        'power_usage':      'استهلاك الطاقة',
                    }.get(_s, _s)
                    _alert_title = {
                        'air_temperature':  'تنبيه حرارة',
                        'soil_temperature': 'تنبيه حرارة التربة',
                        'air_humidity':     'تنبيه رطوبة',
                        'soil_moisture':    'تنبيه رطوبة التربة',
                        'light_intensity':  'تنبيه إضاءة',
                        'water_usage':      'تنبيه مياه',
                        'power_usage':      'تنبيه طاقة',
                    }.get(_s, 'تنبيه')
                    _v = f"{_val:.1f}{_unit}" if _val is not None else '—'
                    _msg = {
                        'sensor_stuck':        f"{_alert_title}: {_sensor_ar} ثابت عند {_v} — قد يكون الحساس عالقاً، تحقق منه أو أعد تشغيله",
                        'unrealistic_jump':    f"{_alert_title}: {_sensor_ar} وصلت إلى {_v} بشكل مفاجئ — افحص الحساس وقناة الإرسال",
                        'pattern_break':       f"{_alert_title}: {_sensor_ar} {_v} — انحراف ملحوظ عن النمط الطبيعي للقراءات",
                        'threshold_violation': f"{_alert_title}: {_sensor_ar} وصلت إلى {_v} — تجاوزت الحد المسموح ومطلوب تدخل فوري",
                    }.get(_t, f"تنبيه: {_sensor_ar} {_v}")
                    db.add(Alert(
                        farm_id=fid,
                        sensor_type=_s,
                        explanation=_t,
                        message=_msg,
                        actual_value=_val,
                        threshold=70 if _s == 'soil_moisture' and _t == 'threshold_violation' else None,
                        severity=AlertSeverity.critical if anomaly['severity'] == 'critical'
                                 else AlertSeverity.warning,
                        status=AlertStatus.open,
                    ))
                    print(f"[ALERT] Farm {fid} | {anomaly['sensor']}: {anomaly['severity']}")
        # === AUTO IRRIGATION DECISION ===
        # Evapotranspiration filter - Ref: Penman-Monteith (FAO Paper 56)
        # High ET = high evaporation = irrigation water is wasted
        ET_rate = (ext_temp / 40.0) * (lux / 100000.0) * (1 - ext_hum / 100)
        irrigation_blocked = False
        irrigation_blocked_reason = ""

        if not is_day:
            # Ref: Greenhouse Management Guide - avoid watering in the evening
            # Night irrigation promotes fungal diseases
            irrigation_blocked = True
            irrigation_blocked_reason = "ليل - خطر أمراض فطرية"
        elif ET_rate > 0.6:
            # High evapotranspiration - irrigation water will evaporate quickly
            # Ref: Penman-Monteith ET method (FAO Paper 56)
            irrigation_blocked = True
            irrigation_blocked_reason = f"تبخر شديد (ET={ET_rate:.2f}) - انتظر تحسن الظروف"

        if irrigation_blocked:
            if state.get("soil_moisture", 100) < 25:
                print(
                    f"[IRRIGATION OVERRIDE] Farm {fid} | Critical soil moisture "
                    f"{state.get('soil_moisture', 0):.1f}% overrides block: {irrigation_blocked_reason}"
                )
                irrigation_blocked = False
                irrigation_blocked_reason = ""
            else:
                print(f"[IRRIGATION BLOCKED] Farm {fid} | {irrigation_blocked_reason}")
        if farm_auto_mode and not pump_on and not irrigation_blocked:
            irrigation_action = intelligence_report.get("irrigation_action", {})
            should_irrigate = irrigation_action.get("should_irrigate", False)
            if should_irrigate and farm.current_water_level > 10:
                irrig_device = await db.execute(
                    select(Device).where(
                        Device.farm_id == fid,
                        Device.device_id == f"irrigation_{fid}"
                    )
                )
                irrig_device_obj = irrig_device.scalar_one_or_none()
                if irrig_device_obj:
                    actuator_result = await db.execute(
                        select(Actuator).where(
                            Actuator.device_id == f"irrigation_{fid}"
                        )
                    )
                    actuator_obj = actuator_result.scalar_one_or_none()
                    if actuator_obj:
                        new_cmd = IrrigationCommand(
                            actuator_id=actuator_obj.id,
                            mode=IrrigationMode.auto,
                            duration_min=15,
                            start_time=datetime.now(timezone.utc)
                        )
                        db.add(new_cmd)
                        await db.flush()
                        new_event = IrrigationEvent(
                            command_id=new_cmd.id,
                            status=IrrigationStatus.active
                        )
                        db.add(new_event)
                        pump_on = True
                        await log_action(db, fid, "irrigation_auto_start", f"irrigation_{fid}",
                            {"ml_score": irrigation_action.get("score"),
                             "soil_moisture": round(state["soil_moisture"], 1)})
                        print(f"[AUTO-IRRIGATE] Farm {fid} | ML Score: {irrigation_action.get('score', 0):.2f} | Starting irrigation")

    except Exception as de_err:
        print(f"[DE] Farm {fid} decision engine error: {de_err}")

    # Flush all pending operations to ensure data consistency
    try:
        await db.flush()
    except Exception as flush_err:
        print(f"[FLUSH] Farm {fid} flush error: {flush_err}")

    mode_str = "AUTO" if farm_auto_mode else "MANUAL"
    print(
        f"[{datetime.now(MAKKAH_TZ).strftime('%H:%M:%S')}] "
        f"Farm {fid} | MODE:{mode_str} | "
        f"EXT:{ext_temp:.0f}C | INT:{state['internal_temp']:.0f}C | "
        f"HUM:{state['internal_hum']:.0f}% | "
        f"SOIL:{state['soil_moisture']:.0f}% | "
        f"FAN:{'ON' if state['fan_on'] else 'OFF'} | "
        f"COOLER:{'ON' if state['cooler_on'] else 'OFF'} | "
        f"PUMP:{'ON' if pump_on else 'OFF'}"
    )

async def engine_loop():
    global _engine_loop_running
    if _engine_loop_running:
        print("[Physics Engine] Duplicate engine_loop ignored")
        while True:
            await asyncio.sleep(3600)

    _engine_loop_running = True
    print(f"Warif Physics Engine Simulator Started (pid={os.getpid()})")
    print("References: FAO Paper 56, ASHRAE 2021, Stanghellini 1987")
    while True:
        try:
            ext_temp, ext_hum, cloudcover, is_day = fetch_makkah_weather()
            lux = calculate_lux(is_day, cloudcover)

            # Add realistic daily temperature variation (Makkah climate)
            # Ref: Saudi Meteorological Authority - Makkah temperature patterns
            hour = datetime.now().hour
            if 6 <= hour <= 18:
                daily_variance = 8 * math.sin((hour - 6) * math.pi / 12)
            else:
                daily_variance = -4
            ext_temp = max(15.0, min(50.0, ext_temp + daily_variance))

            # 1. Fetch all farm IDs first in a temporary session
            async with AsyncSessionLocal() as init_db:
                res = await init_db.execute(select(Farm.id))
                farm_ids = res.scalars().all()

            # 2. Process each farm in its own isolated session
            for fid in farm_ids:
                async with AsyncSessionLocal() as db:
                    try:
                        # Fetch the farm object specifically for this session
                        res = await db.execute(select(Farm).where(Farm.id == fid))
                        farm = res.scalar_one_or_none()
                        if not farm:
                            continue
                            
                        await process_farm(db, farm, ext_temp, ext_hum, lux, is_day)
                        await db.commit()
                        
                    except Exception as e:
                        try:
                            await db.rollback()
                        except:
                            pass
                        
                        error_msg = str(e)
                        if "connection" in error_msg.lower() or "rollback" in error_msg.lower():
                            print(f"[RECONNECT] Farm {fid} - connection reset, will retry next tick")
                        else:
                            print(f"[ERROR] Farm {fid} tick failed: {e}")

        except Exception as outer_e:
            print(f"[CRITICAL] Engine loop error: {outer_e}")

        await asyncio.sleep(INTERVAL)

if __name__ == "__main__":
    asyncio.run(engine_loop())
