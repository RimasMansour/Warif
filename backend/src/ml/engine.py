import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select, desc

from src.db.session import AsyncSessionLocal
from src.db.models.models import SensorReading, Recommendation

logger = logging.getLogger(__name__)

async def verify_action_outcome(
    recommendation_id: int, 
    action_type: str, 
    farm_id: int, 
    target_metric: str, 
    target_value: float,
    operator: str = "less_than"
):
    """
    Autonomous Physical Feedback (Closed-Loop Validation)
    Wait for physical changes to take effect and verify against scientific targets.
    """
    # Wait for physical impact window (10 minutes)
    await asyncio.sleep(600)
    
    async with AsyncSessionLocal() as session:
        try:
            # Get latest sensor reading for the target metric
            result = await session.execute(
                select(SensorReading)
                .where(
                    SensorReading.farm_id == farm_id,
                    SensorReading.sensor_type == target_metric
                )
                .order_by(desc(SensorReading.timestamp))
                .limit(1)
            )
            latest_reading = result.scalar_one_or_none()
            
            if not latest_reading:
                logger.warning(f"Validation loop failed: No reading for {target_metric} on farm {farm_id}")
                return

            current_value = latest_reading.value
            success = False
            
            # Evaluate against scientific thresholds
            if operator == "less_than":
                success = current_value <= target_value
            elif operator == "greater_than":
                success = current_value >= target_value
            elif operator == "near":
                # Assuming near means within 5% tolerance
                success = abs(current_value - target_value) / max(target_value, 1) <= 0.05
            
            # Update Recommendation with Self-Correction Data
            rec_result = await session.execute(
                select(Recommendation).where(Recommendation.id == recommendation_id)
            )
            recommendation = rec_result.scalar_one_or_none()
            
            if recommendation:
                recommendation.actual_outcome = success
                recommendation.outcome_at = datetime.now(timezone.utc)
                
                if not success:
                    # Log physical discrepancy for ML retraining
                    reason = f"Physical failure: {target_metric} reached {current_value}, target was {target_value} ({operator})."
                    if "high ambient thermal inertia" in reason.lower() or target_metric == "air_temperature":
                         reason += " High ambient thermal inertia."
                    elif target_metric == "soil_moisture":
                         reason += " Ineffective irrigation flow or rapid evaporation."
                    
                    # Append reason without losing original reasoning
                    current_reasoning = recommendation.reasoning or ""
                    recommendation.reasoning = f"{current_reasoning}\n[ML_FEEDBACK]: {reason}".strip()
                    logger.info(f"Self-correction logged for recommendation {recommendation_id}: {reason}")
                else:
                    logger.info(f"Action {action_type} successfully met target for recommendation {recommendation_id}.")
                
                session.add(recommendation)
                await session.commit()
                
        except Exception as e:
            logger.error(f"Error in verify_action_outcome: {e}")
            await session.rollback()
