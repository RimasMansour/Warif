# -*- coding: utf-8 -*-
# backend/src/services/recommendation_service.py
from typing import List
from dataclasses import dataclass


@dataclass
class RecommendationItem:
    message: str
    category: str
    severity: str


class RecommendationService:
    """
    Generates actionable recommendations based on
    real-time sensor data and ML predictions.
    """

    def generate(self, sensor_data: dict, prediction=None) -> List[RecommendationItem]:
        recommendations = []

        soil_moisture    = sensor_data.get("soil_moisture")
        soil_temperature = sensor_data.get("soil_temperature")
        air_temperature  = sensor_data.get("air_temperature")
        air_humidity     = sensor_data.get("air_humidity")

        # Irrigation
        if soil_moisture is not None:
            if soil_moisture < 20:
                recommendations.append(RecommendationItem(
                    message="Soil moisture is critically low. Immediate irrigation required.",
                    category="irrigation",
                    severity="urgent",
                ))
            elif soil_moisture < 35:
                recommendations.append(RecommendationItem(
                    message="Soil moisture is below optimal. Consider irrigating soon.",
                    category="irrigation",
                    severity="warning",
                ))
            elif soil_moisture > 80:
                recommendations.append(RecommendationItem(
                    message="Soil moisture is too high. Pause irrigation.",
                    category="irrigation",
                    severity="warning",
                ))
            else:
                recommendations.append(RecommendationItem(
                    message="Soil moisture is within optimal range.",
                    category="irrigation",
                    severity="normal",
                ))

        # Soil temperature
        if soil_temperature is not None:
            if soil_temperature < 10:
                recommendations.append(RecommendationItem(
                    message="Soil temperature is too low. Plant growth may be affected.",
                    category="soil",
                    severity="warning",
                ))
            elif soil_temperature > 35:
                recommendations.append(RecommendationItem(
                    message="Soil temperature is high. Consider shading or cooling.",
                    category="soil",
                    severity="warning",
                ))
            else:
                recommendations.append(RecommendationItem(
                    message="Soil temperature is within optimal range.",
                    category="soil",
                    severity="normal",
                ))

        # Air temperature
        if air_temperature is not None:
            if air_temperature > 40:
                recommendations.append(RecommendationItem(
                    message="Air temperature is very high. Activate ventilation immediately.",
                    category="temperature",
                    severity="urgent",
                ))
            elif air_temperature > 32:
                recommendations.append(RecommendationItem(
                    message="Air temperature is above optimal. Monitor ventilation.",
                    category="temperature",
                    severity="warning",
                ))
            elif air_temperature < 10:
                recommendations.append(RecommendationItem(
                    message="Air temperature is too low. Consider heating.",
                    category="temperature",
                    severity="warning",
                ))
            else:
                recommendations.append(RecommendationItem(
                    message="Air temperature is within optimal range.",
                    category="temperature",
                    severity="normal",
                ))

        # Humidity
        if air_humidity is not None:
            if air_humidity < 30:
                recommendations.append(RecommendationItem(
                    message="Air humidity is too low. Consider misting.",
                    category="humidity",
                    severity="warning",
                ))
            elif air_humidity > 85:
                recommendations.append(RecommendationItem(
                    message="Air humidity is too high. Increase ventilation.",
                    category="humidity",
                    severity="warning",
                ))
            else:
                recommendations.append(RecommendationItem(
                    message="Air humidity is within optimal range.",
                    category="humidity",
                    severity="normal",
                ))

        # ML prediction
        if prediction is not None and prediction.should_irrigate:
            recommendations.append(RecommendationItem(
                message=f"AI recommends irrigation for {prediction.duration_min} min. {prediction.reason}",
                category="irrigation",
                severity="warning",
            ))

        return recommendations