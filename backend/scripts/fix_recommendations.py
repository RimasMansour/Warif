# -*- coding: utf-8 -*-
"""
Fix corrupted Arabic recommendation messages.
Run from backend/ directory:
    python scripts/fix_recommendations.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MESSAGES = {
    1: (
        "رطوبة التربة منخفضة جداً، يُنصح بالري الفوري لتجنب إجهاد النبات.",
        "irrigation",
        "warning",
    ),
    2: (
        "درجة حرارة الهواء في النطاق الأمثل، لا حاجة للتدخل الآن.",
        "temperature",
        "normal",
    ),
    3: (
        "رطوبة الهواء مرتفعة قليلاً، راقب التهوية.",
        "humidity",
        "normal",
    ),
}


async def fix():
    from src.db.session import AsyncSessionLocal
    from src.db.models.models import Recommendation
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        for rec_id, (msg, cat, sev) in MESSAGES.items():
            result = await db.execute(
                select(Recommendation).where(Recommendation.id == rec_id)
            )
            rec = result.scalar_one_or_none()
            if rec:
                rec.message = msg
                print(f"Fixed id={rec_id}")
            else:
                print(f"Not found: id={rec_id}")
        await db.commit()
        print("Committed.")

    # Verify
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Recommendation).order_by(Recommendation.id)
        )
        recs = result.scalars().all()
        print()
        for r in recs:
            print(f"  id={r.id} | category={r.category.value} | {r.message}")


if __name__ == "__main__":
    asyncio.run(fix())
