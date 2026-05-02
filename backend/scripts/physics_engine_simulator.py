#!/usr/bin/env python
# backend/scripts/physics_engine_simulator.py
"""
Warif Physics Engine Simulator (Digital Twin) - Universal Daemon
Simulates physics (thermodynamics, water, energy) for ALL registered farms.
"""
import asyncio
import time
import requests
import sys
import os
import math
from datetime import datetime

# Adjust Python path to load backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.db.session import AsyncSessionLocal
from src.db.models.models import Farm, Device, Actuator, SensorReading, IrrigationCommand, IrrigationEvent

# --- Engineering Constants ---
AREA_SQM = 80.0
HEIGHT_M = 3.0
VOLUME_CBM = AREA_SQM * HEIGHT_M
FAN_POWER_KW = 1.1
PUMP_FLOW_L_PER_MIN = 20.0  # 20 Liters per minute
PUMP_POWER_KW = 0.5         # Pump uses 0.5 kW
INTERVAL = 10               # Seconds per simulation tick

# A global dictionary to keep track of the physical state of each farm
farm_states = {}

def fetch_makkah_weather():
    url = "https://api.open-meteo.com/v1/forecast?latitude=21.3891&longitude=39.8579&current=temperature_2m,relative_humidity_2m,cloudcover,is_day&timezone=auto"
    try:
        r = requests.get(url, timeout=5)
        data = r.json()["current"]
        return data["temperature_2m"], data["relative_humidity_2m"], data["cloudcover"], data["is_day"]
    except Exception as e:
        return 35.0, 30.0, 0, 1

def calculate_lux(is_day, cloudcover):
    if not is_day:
        return 0.0
    hour = datetime.now().hour
    if hour < 6 or hour > 18:
        return 0.0
    intensity = 1.0 - ((hour - 12) / 6.0)**2
    max_lux = 100000.0 * (1.0 - (cloudcover / 100.0) * 0.5)
    return max(0.0, (intensity * max_lux) * 0.7)

async def process_farm(db: AsyncSession, farm: Farm, ext_temp, ext_hum, lux):
    global farm_states
    fid = farm.id
    
    # Initialize physics state for new farms
    if fid not in farm_states:
        farm_states[fid] = {
            "internal_temp": ext_temp,
            "internal_hum": ext_hum,
            "soil_moisture": 40.0,
            "soil_temp": ext_temp - 2.0,
            "fan_on": False
        }
        
    state = farm_states[fid]
    
    # Fetch latest irrigation event for this farm to see if pump is on
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

    # Physics Calculations
    heating_factor = (lux / 100000.0) * 0.5 
    
    if state["internal_temp"] >= 33.0:
        state["fan_on"] = True
    elif state["internal_temp"] <= 30.0:
        state["fan_on"] = False

    if state["fan_on"]:
        cooling_efficiency = max(0.1, (100 - ext_hum) / 100.0) 
        temp_drop = 0.6 * cooling_efficiency
        state["internal_temp"] -= temp_drop
        state["internal_hum"] += 1.5 
    else:
        if state["internal_temp"] < ext_temp:
            state["internal_temp"] += 0.2
        state["internal_temp"] += heating_factor
        diff_hum = ext_hum - state["internal_hum"]
        state["internal_hum"] += (diff_hum * 0.05)

    water_consumed = 0.0
    energy_consumed = 0.0
    
    if pump_on:
        water_consumed = (PUMP_FLOW_L_PER_MIN / 60.0) * INTERVAL
        energy_consumed += (PUMP_POWER_KW / 3600.0) * INTERVAL
        state["soil_moisture"] += 1.0 
        state["soil_temp"] -= 0.1     
    else:
        state["soil_moisture"] -= max(0.01, (state["internal_temp"] / 100.0)) 

    if state["fan_on"]:
        energy_consumed += (FAN_POWER_KW / 3600.0) * INTERVAL
        
    state["internal_temp"] = max(10.0, min(55.0, state["internal_temp"]))
    state["internal_hum"] = max(10.0, min(99.0, state["internal_hum"]))
    state["soil_moisture"] = max(0.0, min(100.0, state["soil_moisture"]))

    # Update Farm resources
    if water_consumed > 0:
        farm.current_water_level = max(0.0, farm.current_water_level - water_consumed)
    if energy_consumed > 0:
        farm.total_energy_kwh += energy_consumed

    # Ensure farm has devices to log sensors
    devices_result = await db.execute(select(Device).where(Device.farm_id == fid))
    devices = devices_result.scalars().all()

    if not devices:
        print(f"Farm {fid} has no devices. Auto-registering default devices...")
        dev_sensors = Device(farm_id=fid, device_id=f"sensor_fw_{fid}", name="Main Sensors", type="sensor")
        dev_pump = Device(farm_id=fid, device_id=f"pump_fw_{fid}", name="Main Pump", type="actuator")
        db.add(dev_sensors)
        db.add(dev_pump)
        await db.flush()
        await db.commit()  # Commit so HTTP endpoint can find the devices
        devices = [dev_sensors, dev_pump]

    sensor_device = next((d for d in devices if d.type == "sensor"), devices[0])

    # Send sensor readings via HTTP API (triggers Decision Engine)
    sensors_to_send = [
        ("air_temperature", state["internal_temp"], "C"),
        ("air_humidity", state["internal_hum"], "%"),
        ("soil_temperature", state["soil_temp"], "C"),
        ("soil_moisture", state["soil_moisture"], "%"),
        ("light_intensity", lux, "lux"),
        ("water_usage", round(water_consumed, 3), "L"),
        ("power_usage", round(energy_consumed * 1000, 3), "Wh"),
    ]

    for stype, val, unit in sensors_to_send:
        try:
            payload = {
                "device_id": sensor_device.device_id,
                "sensor_type": stype,
                "value": round(val, 2),
                "unit": unit
            }
            requests.post("http://localhost:8000/api/v1/sensors", json=payload, timeout=2)
        except Exception as e:
            pass  # Ignore network errors

    print(f"[{datetime.now().strftime('%H:%M:%S')}] Farm {fid} | EXT: {ext_temp:.1f}C | INT: {state['internal_temp']:.1f}C | SOIL: {state['soil_moisture']:.1f}% | PUMP: {'ON' if pump_on else 'OFF'}")

async def engine_loop():
    print("Warif Physics Engine Simulator (Daemon) Started")
    while True:
        try:
            ext_temp, ext_hum, cloudcover, is_day = fetch_makkah_weather()
            lux = calculate_lux(is_day, cloudcover)
            
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Farm))
                farms = result.scalars().all()
                
                for farm in farms:
                    await process_farm(db, farm, ext_temp, ext_hum, lux)
                
                await db.commit()
                
        except Exception as e:
            print(f"[ERROR] Engine tick failed: {e}")
            
        await asyncio.sleep(INTERVAL)

if __name__ == "__main__":
    asyncio.run(engine_loop())
