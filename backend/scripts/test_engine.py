#!/usr/bin/env python
"""
Diagnostic Script: Test Decision Engine with real Farm 20 data
استخراج آخر 10 sensor readings من farm_id=20 ومعالجتها عبر engine.analyze()
"""
import os
import sys
import asyncio
from pathlib import Path
from datetime import datetime, timezone

# Setup path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(str(BACKEND_DIR))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def test_engine():
    from src.db.session import AsyncSessionLocal
    from src.db.models.models import SensorReading
    from src.services.decision_engine import SmartDecisionEngine

    print("=" * 80)
    print("DIAGNOSTIC: Testing Decision Engine with Farm 20 Data")
    print("=" * 80)

    # 1. Fetch latest sensor readings for farm 20
    async with AsyncSessionLocal() as db:
        query = (
            select(SensorReading)
            .where(SensorReading.farm_id == 20)
            .order_by(SensorReading.timestamp.desc())
            .limit(20)  # Get latest 20 readings
        )
        result = await db.execute(query)
        readings = result.scalars().all()

    print(f"\n[OK] Found {len(readings)} sensor readings for Farm 20")
    if not readings:
        print("[ERROR] NO SENSOR DATA FOUND! Check if farm_id=20 exists and has readings.")
        return

    # 2. Build sensor_data dict from latest readings
    sensor_data = {}
    for reading in readings:
        sensor_type = reading.sensor_type
        if sensor_type not in sensor_data:  # Take latest value for each type
            sensor_data[sensor_type] = reading.value

    print(f"\n[OK] Extracted {len(sensor_data)} unique sensor types:")
    for stype, val in sensor_data.items():
        print(f"  - {stype}: {val}")

    # Add crop type (default to cucumber)
    sensor_data["crop_type"] = "cucumber"

    # 3. Create engine and run analysis
    print("\n" + "=" * 80)
    print("CALLING: engine.analyze_with_intelligence()")
    print("=" * 80)

    engine = SmartDecisionEngine()

    try:
        intelligence_report = await engine.analyze_with_intelligence(sensor_data, farm_id=20)
    except Exception as e:
        print(f"[ERROR] ERROR during analysis: {e}")
        import traceback
        traceback.print_exc()
        return

    # 4. Display results
    print("\n" + "-" * 80)
    print("RESULT: Intelligence Report for Farm 20")
    print("-" * 80)

    # Recommendations
    recs = intelligence_report.get("recommendations", [])
    print(f"\n[INFO] RECOMMENDATIONS ({len(recs)}):")
    if recs:
        for i, rec in enumerate(recs, 1):
            print(f"\n  {i}. {rec.message}")
            print(f"     Category: {rec.category}")
            print(f"     Severity: {rec.severity}")
            print(f"     Confidence: {rec.confidence:.2f}")
            print(f"     Reasoning: {rec.reasoning}")
    else:
        print("  [WARNING]  NO RECOMMENDATIONS RETURNED!")

    # Anomalies
    anomalies = intelligence_report.get("anomalies", [])
    print(f"\n[ALERT] ANOMALIES ({len(anomalies)}):")
    if anomalies:
        for i, anom in enumerate(anomalies, 1):
            print(f"\n  {i}. {anom['description']}")
            print(f"     Sensor: {anom['sensor']}")
            print(f"     Severity: {anom['severity']}")
    else:
        print("  [OK] No anomalies detected")

    # Irrigation Decision
    irr_action = intelligence_report.get("irrigation_action", {})
    print(f"\n[IRRIGATION] IRRIGATION DECISION:")
    print(f"  Should Irrigate: {irr_action.get('should_irrigate')}")
    print(f"  Score: {irr_action.get('score')}")
    print(f"  Confidence: {irr_action.get('confidence')}")
    print(f"  Reason: {irr_action.get('reason')}")

    # Overall Status
    overall = intelligence_report.get("overall_intelligence", {})
    print(f"\n[DIAGNOSIS] OVERALL STATUS:")
    print(f"  Status: {overall.get('status')}")
    print(f"  Risk Level: {overall.get('risk_level')}")
    print(f"  Risk Score: {overall.get('risk_score')}")

    print("\n" + "=" * 80)
    print("DIAGNOSIS COMPLETE")
    print("=" * 80)

    # 5. Root cause analysis
    print("\n[ANALYSIS] ROOT CAUSE ANALYSIS:")
    print(f"\nProblem: Dashboard shows 0 recommendations for Farm 20")
    print(f"Engine returns: {len(recs)} recommendations")

    if len(recs) == 0:
        print("\n[ERROR] FINDING: Engine.analyze_with_intelligence() returns EMPTY list!")
        print("\nPossible causes:")
        print("  1. Line 372 in decision_engine.py filters out all non-'normal' severity")
        print("  2. analyze() function only generates 'warning'/'urgent' not 'normal'")
        print("  3. Result: All recommendations are filtered and deleted!")
    else:
        print(f"\n[OK] FINDING: Engine returns {len(recs)} recommendations")
        print("Next check: Why aren't they being saved to database?")

if __name__ == "__main__":
    asyncio.run(test_engine())
