"""
validate_models.py
------------------
Validates all Warif ML models and produces a metrics report.
Metrics calculated: MAE, RMSE, R², MAPE

These metrics are required by the project scope for model evaluation.

Usage:
    python -m backend.src.ml.trainers.validate_models
"""

import sys
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from tensorflow.keras.models import load_model

# Add project root to path
ROOT = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(ROOT))

from backend.src.ml.lstm_model import build_sequences, SEQ_LENGTH

# Paths
DATA_PATH  = ROOT / "data" / "datasets" / "irrigation_data.csv"
MODELS_DIR = ROOT / "backend" / "src" / "ml" / "models"

# Features and target
FEATURES = [
    "air_temperature",
    "air_humidity",
    "co2",
    "soil_moisture",
    "soil_temperature",
    "cum_irr",
]
TARGET = "irrigation_needed"


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Mean Absolute Percentage Error.
    Only calculated on positive true values to avoid division by zero.
    """
    mask  = y_true > 0
    if mask.sum() == 0:
        return 0.0
    return float(
        np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
    )


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Computes MAE, RMSE, R², and MAPE for a set of predictions.
    """
    return {
        "MAE" : round(float(mean_absolute_error(y_true, y_pred)), 4),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "R2"  : round(float(r2_score(y_true, y_pred)), 4),
        "MAPE": round(mape(y_true, y_pred), 4),
    }


def load_test_data() -> tuple:
    """
    Loads the test split (last 20%) from irrigation_data.csv.
    Returns X_test, y_test for flat models and X_seq, y_seq for LSTM.
    """
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=FEATURES + [TARGET])

    X = df[FEATURES].values
    y = df[TARGET].values

    # Use last 20% as test set - same split as training
    split = int(len(X) * 0.8)
    X_test = X[split:]
    y_test = y[split:]

    return X_test, y_test


def validate_random_forest(X_test: np.ndarray, y_test: np.ndarray) -> dict:
    """
    Validates Random Forest on test set.
    """
    model  = joblib.load(MODELS_DIR / "random_forest.pkl")
    scaler = joblib.load(MODELS_DIR / "rf_scaler.pkl")

    X_scaled = scaler.transform(X_test)
    y_pred   = model.predict(X_scaled).astype(float)

    return compute_metrics(y_test.astype(float), y_pred)


def validate_xgboost(X_test: np.ndarray, y_test: np.ndarray) -> dict:
    """
    Validates XGBoost on test set.
    """
    model  = joblib.load(MODELS_DIR / "xgboost_model.pkl")
    scaler = joblib.load(MODELS_DIR / "xgb_scaler.pkl")

    X_scaled = scaler.transform(X_test)
    y_pred   = model.predict(X_scaled).astype(float)

    return compute_metrics(y_test.astype(float), y_pred)


def validate_lstm(X_test: np.ndarray, y_test: np.ndarray) -> dict:
    """
    Validates LSTM on test set using sequences.
    """
    from sklearn.preprocessing import StandardScaler

    model  = load_model(MODELS_DIR / "lstm_model.keras")
    scaler = joblib.load(MODELS_DIR / "lstm_scaler.pkl")

    # Build sequences from test data
    X_scaled      = scaler.transform(X_test)
    X_seq, y_seq  = build_sequences(X_scaled, y_test, SEQ_LENGTH)

    y_pred_prob = model.predict(X_seq, verbose=0).flatten()
    y_pred      = (y_pred_prob >= 0.5).astype(float)

    return compute_metrics(y_seq.astype(float), y_pred)


def validate_all() -> dict:
    """
    Runs validation for all prediction models and prints report.
    """
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Data file not found: {DATA_PATH}\n"
            f"Run data/prepare_data.py first."
        )

    print("Loading test data...")
    X_test, y_test = load_test_data()
    print(f"Test samples: {len(X_test):,}\n")

    results = {}

    # Random Forest
    print("Validating Random Forest...")
    results["random_forest"] = validate_random_forest(X_test, y_test)

    # XGBoost
    print("Validating XGBoost...")
    results["xgboost"] = validate_xgboost(X_test, y_test)

    # LSTM
    print("Validating LSTM...")
    results["lstm"] = validate_lstm(X_test, y_test)

    # Print report
    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)
    print(f"{'Model':<20} {'MAE':>8} {'RMSE':>8} {'R2':>8} {'MAPE':>10}")
    print("-" * 60)
    for model, metrics in results.items():
        print(
            f"{model:<20} "
            f"{metrics['MAE']:>8.4f} "
            f"{metrics['RMSE']:>8.4f} "
            f"{metrics['R2']:>8.4f} "
            f"{metrics['MAPE']:>10.4f}"
        )
    print("=" * 60)

    return results


if __name__ == "__main__":
    validate_all()