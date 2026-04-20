# backend/src/services/decision_engine.py
from dataclasses import dataclass
from typing import Optional


@dataclass
class IrrigationDecision:
    should_irrigate: bool
    duration_min: int
    confidence: float
    reason: str
    mode: str = "auto"


class DecisionEngine:
    """
    Evaluates ML predictions + sensor data + safety rules
    to decide whether to irrigate and for how long.
    Based on Sequence Diagram 26 in the Warif scope document.
    """

    # ── Safety thresholds ──────────────────────────────────────────────
    SOIL_MOISTURE_MAX   = 80.0   # don't irrigate above this
    SOIL_MOISTURE_MIN   = 20.0   # always irrigate below this
    AIR_TEMP_MAX        = 45.0   # pause irrigation in extreme heat
    MIN_REST_MINUTES    = 30     # minimum gap between irrigations

    def evaluate(
        self,
        predicted_need: bool,
        confidence: float,
        sensor_data: dict,
        auto_control_enabled: bool = True,
        minutes_since_last: Optional[int] = None,
    ) -> IrrigationDecision:
        """
        Main decision logic.

        Args:
            predicted_need:        ML ensemble output (True = irrigate)
            confidence:            ML confidence score (0.0 - 1.0)
            sensor_data:           latest sensor readings dict
            auto_control_enabled:  user setting from dashboard
            minutes_since_last:    minutes since last irrigation event

        Returns:
            IrrigationDecision with action and reason
        """

        soil_moisture = sensor_data.get("soil_moisture", 50.0)
        air_temp      = sensor_data.get("air_temperature", 25.0)

        # ── Rule 1: Safety — soil too wet ──────────────────────────────
        if soil_moisture >= self.SOIL_MOISTURE_MAX:
            return IrrigationDecision(
                should_irrigate=False,
                duration_min=0,
                confidence=1.0,
                reason=f"Soil moisture {soil_moisture}% is above safe max {self.SOIL_MOISTURE_MAX}%",
                mode="auto",
            )

        # ── Rule 2: Safety — extreme heat ─────────────────────────────
        if air_temp >= self.AIR_TEMP_MAX:
            return IrrigationDecision(
                should_irrigate=False,
                duration_min=0,
                confidence=1.0,
                reason=f"Air temperature {air_temp}°C is too high for irrigation",
                mode="auto",
            )

        # ── Rule 3: Safety — rest period ──────────────────────────────
        if minutes_since_last is not None and minutes_since_last < self.MIN_REST_MINUTES:
            return IrrigationDecision(
                should_irrigate=False,
                duration_min=0,
                confidence=1.0,
                reason=f"Rest period not complete ({minutes_since_last}/{self.MIN_REST_MINUTES} min)",
                mode="auto",
            )

        # ── Rule 4: Critical — soil too dry (override ML) ─────────────
        if soil_moisture <= self.SOIL_MOISTURE_MIN:
            duration = self._calculate_duration(soil_moisture)
            return IrrigationDecision(
                should_irrigate=True,
                duration_min=duration,
                confidence=1.0,
                reason=f"Soil moisture critically low at {soil_moisture}%",
                mode="auto",
            )

        # ── Rule 5: Auto control disabled — recommendation only ────────
        if not auto_control_enabled:
            return IrrigationDecision(
                should_irrigate=predicted_need,
                duration_min=self._calculate_duration(soil_moisture) if predicted_need else 0,
                confidence=confidence,
                reason="Auto control disabled — recommendation only",
                mode="recommendation",
            )

        # ── Rule 6: ML decision with confidence check ─────────────────
        if predicted_need and confidence >= 0.6:
            duration = self._calculate_duration(soil_moisture)
            return IrrigationDecision(
                should_irrigate=True,
                duration_min=duration,
                confidence=confidence,
                reason=f"ML model recommends irrigation (confidence: {confidence:.0%})",
                mode="auto",
            )

        # ── Default: no irrigation needed ─────────────────────────────
        return IrrigationDecision(
            should_irrigate=False,
            duration_min=0,
            confidence=confidence,
            reason="No irrigation needed based on current conditions",
            mode="auto",
        )

    def _calculate_duration(self, soil_moisture: float) -> int:
        """
        Calculate irrigation duration based on soil moisture deficit.
        Returns duration in minutes (5 - 30).
        """
        deficit = max(0.0, 60.0 - soil_moisture)   # target 60% moisture
        duration = int(deficit * 0.5)               # 0.5 min per % deficit
        return max(5, min(30, duration))             # clamp 5-30 min