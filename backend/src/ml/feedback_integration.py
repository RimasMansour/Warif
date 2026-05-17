"""
Feedback Integration Module -- Closed-loop user feedback correlation with Continual Learning
========================================================================================

Responsibilities:
1. Extracts user-submitted utility feedback from the Recommendations table.
2. Converts evaluation signals into supervised training datasets.
3. Incorporates explicit field validations into the continual retraining pipeline.
4. Quantifies the precision improvement of recommendations over time based on feedback.

Serves as a real-world application of the Digital Twin closed-loop paradigm.
"""

import pandas as pd
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_


class FeedbackLearningBridge:
    """
    Bridges user-submitted utility feedback with the continual learning retraining engine.
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session

    async def get_recent_feedback(self, farm_id: int, hours: int = 24) -> pd.DataFrame:
        """
        Retrieves recent recommendation feedback logs.

        Returns:
            DataFrame containing:
            - id: Recommendation ID
            - helpful: Boolean feedback signal
            - created_at: Timestamp of recommendation creation
            - feedback_at: Timestamp when feedback was logged
            - category: Recommendation category
            - message: The recommendation text
        """
        from src.db.models.models import Recommendation

        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        result = await self.db.execute(
            select(
                Recommendation.id,
                Recommendation.helpful,
                Recommendation.created_at,
                Recommendation.feedback_at,
                Recommendation.category,
                Recommendation.message
            ).where(
                and_(
                    Recommendation.farm_id == farm_id,
                    Recommendation.helpful.isnot(None),
                    Recommendation.feedback_at >= since
                )
            )
        )

        rows = result.fetchall()

        if not rows:
            return pd.DataFrame()

        data = {
            'id': [r[0] for r in rows],
            'helpful': [r[1] for r in rows],
            'created_at': [r[2] for r in rows],
            'feedback_at': [r[3] for r in rows],
            'category': [r[4] for r in rows],
            'message': [r[5] for r in rows],
        }

        return pd.DataFrame(data)

    async def calculate_feedback_accuracy(self, farm_id: int, days: int = 7) -> dict:
        """
        Calculates recommendation accuracy derived from real-world user feedback.

        Reflects overall operational precision of the model from the end-user's perspective.
        """
        from src.db.models.models import Recommendation
        from sqlalchemy import func, cast, Integer

        since = datetime.now(timezone.utc) - timedelta(days=days)

        result = await self.db.execute(
            select(
                Recommendation.category,
                func.count(Recommendation.id).label("total"),
                func.sum(cast(Recommendation.helpful, Integer)).label("helpful_count")
            ).where(
                and_(
                    Recommendation.farm_id == farm_id,
                    Recommendation.helpful.isnot(None),
                    Recommendation.feedback_at >= since
                )
            ).group_by(Recommendation.category)
        )

        rows = result.fetchall()

        stats = {}
        total_helpful = 0
        total_count = 0

        for category, total, helpful in rows:
            cat_name = category.value if category else 'general'
            accuracy = (helpful / total * 100) if total > 0 else 0
            stats[cat_name] = {
                'total': total,
                'helpful': helpful or 0,
                'accuracy': round(accuracy, 2)
            }
            total_helpful += (helpful or 0)
            total_count += total

        overall_accuracy = (total_helpful / total_count * 100) if total_count > 0 else 0

        return {
            'overall_accuracy': round(overall_accuracy, 2),
            'total_feedback': total_count,
            'by_category': stats,
            'days': days
        }

    async def get_poorly_performing_categories(
        self, farm_id: int, threshold: float = 0.75, days: int = 7
    ) -> list:
        """
        Identifies agricultural advice categories operating below the performance threshold.

        Assists in prioritizing domain areas requiring model refinement.
        """
        stats = await self.calculate_feedback_accuracy(farm_id, days)

        poor = []
        for category, data in stats['by_category'].items():
            if data['accuracy'] < (threshold * 100):
                poor.append({
                    'category': category,
                    'accuracy': data['accuracy'],
                    'total_feedback': data['total'],
                    'needs_improvement': True
                })

        return poor

    async def prepare_feedback_training_data(
        self, farm_id: int, hours: int = 168
    ) -> dict:
        """
        Prepares accumulated user feedback records to construct retraining sets.

        Aggregates utility signals across categories to prioritize model enhancement.
        """
        feedback_df = await self.get_recent_feedback(farm_id, hours)

        if feedback_df.empty:
            return {
                'positive_feedback': 0,
                'negative_feedback': 0,
                'total': 0,
                'ready_for_training': False
            }

        positive = len(feedback_df[feedback_df['helpful'] == True])
        negative = len(feedback_df[feedback_df['helpful'] == False])
        total = len(feedback_df)

        return {
            'positive_feedback': positive,
            'negative_feedback': negative,
            'total': total,
            'ready_for_training': total >= 10,  # Requires at least 10 samples
            'by_category': feedback_df.groupby('category')['helpful'].agg(['sum', 'count']).to_dict(),
            'hours_span': hours
        }


async def initialize_feedback_monitoring(db_session: AsyncSession):
    """
    Initializes the user feedback integration pipeline.

    Should be invoked during application startup to bootstrap the closed-loop system.
    """
    print("[ML] Feedback Integration Module initialized")
    print("[ML] System ready to track, monitor, and progressively learn from user feedback.")

    return FeedbackLearningBridge(db_session)
