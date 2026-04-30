"""
xgboost_model.py
----------------
XGBoost model for irrigation prediction in Warif system.
Uses gradient boosting to improve prediction accuracy over Random Forest.

Input features:
    air_temperature, air_humidity, co2,
    soil_moisture, soil_temperature, cum_irr

Target:
    irrigation_needed (0 = no irrigation, 1 = irrigation needed)
"""

import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Paths
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH  = Path(__file__).parent.parent.parent.parent / "data" / "datasets" / "irrigation_data.csv"

MODEL_PATH  = MODELS_DIR / "xgboost_model.pkl"
SCALER_PATH = MODELS_DIR / "xgb_scaler.pkl"

# Features used for prediction
FEATURES = [
    "air_temperature",
    "air_humidity",
    "co2",
    "soil_moisture",
    "soil_temperature",
    "cum_irr",
]

TARGET = "irrigation_needed"


def load_data(path: Path) -> tuple:
    """
    Loads irrigation_data.csv and splits into train/test sets.
    Uses temporal split to avoid data leakage.
    80% train, 20% test - keeping time order.
    """
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURES + [TARGET])

    X = df[FEATURES].values
    y = df[TARGET].values

    # Temporal split - do not shuffle, time order matters
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False
    )

    print(f"Training samples : {len(X_train):,}")
    print(f"Testing samples  : {len(X_test):,}")
    print(f"Irrigation ratio : {y.mean():.2%}")

    return X_train, X_test, y_train, y_test


def train(data_path: Path = DATA_PATH) -> dict:
    """
    Trains the XGBoost model and saves it to models/.
    Returns training summary with feature importance.
    """
    print("Loading data...")
    X_train, X_test, y_train, y_test = load_data(data_path)

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # Calculate class weight to handle imbalanced data
    # irrigation_needed=1 is only 6.66% of data, so we give it more weight
    negative_count = int((y_train == 0).sum())
    positive_count = int((y_train == 1).sum())
    scale_pos_weight = negative_count / positive_count

    print(f"Class weight scale: {scale_pos_weight:.2f}")

    # Train model
    print("Training XGBoost...")
    model = XGBClassifier(
        n_estimators=100,             # number of boosting rounds
        max_depth=6,                  # maximum tree depth
        learning_rate=0.1,            # step size for each boosting round
        scale_pos_weight=scale_pos_weight,  # handle class imbalance
        random_state=42,
        eval_metric="logloss",
        verbosity=0,
    )
    model.fit(X_train_scaled, y_train)

    # Evaluate on test set
    accuracy = model.score(X_test_scaled, y_test)
    print(f"Test accuracy: {accuracy:.4f}")

    # Feature importance
    importance = dict(zip(FEATURES, model.feature_importances_))
    importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    print("\nFeature importance:")
    for feature, score in importance.items():
        print(f"  {feature}: {score:.4f}")

    # Save model and scaler
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nModel saved to : {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")

    return {
        "model"             : "xgboost",
        "accuracy"          : accuracy,
        "feature_importance": importance,
        "train_samples"     : len(X_train),
        "test_samples"      : len(X_test),
    }


def predict(features: dict) -> dict:
    """
    Predicts whether irrigation is needed given sensor readings.

    Args:
        features: dict with keys matching FEATURES list
            Example:
            {
                "air_temperature" : 24.5,
                "air_humidity"    : 68.0,
                "co2"             : 850.0,
                "soil_moisture"   : 35.0,
                "soil_temperature": 21.0,
                "cum_irr"         : 1.2,
            }

    Returns:
        dict with prediction and confidence
            {
                "irrigation_needed": 1,
                "confidence"       : 0.91,
            }
    """
    # Load saved model and scaler
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train() first."
        )

    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    # Build input array in correct feature order
    X = np.array([[features[f] for f in FEATURES]])
    X_scaled = scaler.transform(X)

    # Predict
    prediction  = int(model.predict(X_scaled)[0])
    probability = float(model.predict_proba(X_scaled)[0][prediction])

    return {
        "irrigation_needed": prediction,
        "confidence"       : round(probability, 4),
    }


if __name__ == "__main__":
    train()