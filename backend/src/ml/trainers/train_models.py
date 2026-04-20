"""
train_models.py
---------------
Runs training for all Warif ML models in sequence.
Use this script to train or retrain all models at once.

Models trained:
    1. Random Forest  - baseline irrigation prediction
    2. XGBoost        - high accuracy irrigation prediction
    3. LSTM           - temporal irrigation prediction
    4. Anomaly SVM    - deep anomaly detection
    5. Anomaly KNN    - fast edge anomaly detection

Usage:
    python -m backend.src.ml.trainers.train_models
"""

import sys
import time
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.src.ml.random_forest  import train as train_rf
from backend.src.ml.xgboost_model  import train as train_xgb
from backend.src.ml.lstm_model     import train as train_lstm
from backend.src.ml.anomaly_svm    import train as train_svm
from backend.src.ml.anomaly_knn    import train as train_knn

DATA_PATH = ROOT / "data" / "datasets" / "irrigation_data.csv"


def train_all() -> dict:
    """
    Trains all models in sequence and returns a summary report.
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Data file not found: {DATA_PATH}\n"
            f"Run data/prepare_data.py first."
        )

    results = {}
    total_start = time.time()

    # 1. Random Forest
    print("=" * 50)
    print("1 / 5  Random Forest")
    print("=" * 50)
    start = time.time()
    results["random_forest"] = train_rf(DATA_PATH)
    results["random_forest"]["duration_sec"] = round(time.time() - start, 2)
    print(f"Done in {results['random_forest']['duration_sec']}s\n")

    # 2. XGBoost
    print("=" * 50)
    print("2 / 5  XGBoost")
    print("=" * 50)
    start = time.time()
    results["xgboost"] = train_xgb(DATA_PATH)
    results["xgboost"]["duration_sec"] = round(time.time() - start, 2)
    print(f"Done in {results['xgboost']['duration_sec']}s\n")

    # 3. LSTM
    print("=" * 50)
    print("3 / 5  LSTM")
    print("=" * 50)
    start = time.time()
    results["lstm"] = train_lstm(DATA_PATH)
    results["lstm"]["duration_sec"] = round(time.time() - start, 2)
    print(f"Done in {results['lstm']['duration_sec']}s\n")

    # 4. Anomaly SVM
    print("=" * 50)
    print("4 / 5  Anomaly Detection (Isolation Forest)")
    print("=" * 50)
    start = time.time()
    results["anomaly_svm"] = train_svm(DATA_PATH)
    results["anomaly_svm"]["duration_sec"] = round(time.time() - start, 2)
    print(f"Done in {results['anomaly_svm']['duration_sec']}s\n")

    # 5. Anomaly KNN
    print("=" * 50)
    print("5 / 5  Anomaly Detection (KNN)")
    print("=" * 50)
    start = time.time()
    results["anomaly_knn"] = train_knn(DATA_PATH)
    results["anomaly_knn"]["duration_sec"] = round(time.time() - start, 2)
    print(f"Done in {results['anomaly_knn']['duration_sec']}s\n")

    total_duration = round(time.time() - total_start, 2)

    # Print summary
    print("=" * 50)
    print("TRAINING SUMMARY")
    print("=" * 50)
    for model, result in results.items():
        accuracy = result.get("accuracy", result.get("normal_detection", "N/A"))
        if isinstance(accuracy, float):
            accuracy = f"{accuracy:.4f}"
        duration = result.get("duration_sec", "N/A")
        print(f"  {model:20} accuracy: {accuracy}  time: {duration}s")

    print(f"\nTotal training time: {total_duration}s")
    print("All models saved to: backend/src/ml/models/")

    return results


if __name__ == "__main__":
    train_all()