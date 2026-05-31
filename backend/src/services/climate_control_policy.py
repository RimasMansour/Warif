"""Shared climate control policy for fan/cooler balancing."""

from typing import Dict, Optional


def evaluate_climate_control(
    *,
    current_mode: str,
    air_temperature: Optional[float],
    air_humidity: Optional[float],
    target_temperature: float,
    target_humidity: float = 80.0,
    resume_cooling_humidity: float = 75.0,
    ventilation_humidity: float = 70.0,
    max_cooling_humidity: float = 85.0,
) -> Dict:
    temp = float(air_temperature or 0.0)
    hum = float(air_humidity or 0.0)
    mode = (current_mode or "stop").lower()

    temp_ok = temp <= target_temperature
    hum_ok = hum <= target_humidity

    if temp_ok and hum_ok:
        action = "stop"
        reason = "temperature and humidity targets achieved"
    elif hum > target_humidity:
        action = "fan_only"
        reason = "humidity above target, ventilating before cooling"
    elif temp > target_temperature and hum <= resume_cooling_humidity:
        action = "cooling_full"
        reason = "humidity safe, cooling needed to reach temperature target"
    elif temp > target_temperature and hum < max_cooling_humidity and mode == "full":
        action = "cooling_full"
        reason = "continuing full cooling while humidity remains acceptable"
    elif hum >= ventilation_humidity:
        action = "fan_only"
        reason = "humidity is elevated, ventilation needed"
    elif temp > target_temperature:
        action = "fan_only"
        reason = "temperature high but humidity is not safe for full cooling"
    else:
        action = "hold"
        reason = "readings are near target range"

    return {
        "action": action,
        "mode": "full" if action == "cooling_full" else action,
        "fan": action in {"cooling_full", "fan_only"},
        "cooler": action == "cooling_full",
        "reason": reason,
        "temp_ok": temp_ok,
        "hum_ok": hum_ok,
        "targets": {
            "air_temperature_max": target_temperature,
            "air_humidity_max": target_humidity,
            "resume_cooling_humidity": resume_cooling_humidity,
            "ventilation_humidity": ventilation_humidity,
            "max_cooling_humidity": max_cooling_humidity,
        },
    }
