"""
anomaly_svm.py
--------------
Anomaly detection for Warif system using Isolation Forest.
Detects abnormal sensor readings that may indicate:
    - Sensor malfunction
    - Environmental stress conditions
    - Irrigation system faults

Note: Isolation Forest is used instead of One-Class SVM
because greenhouse data has high natural variability
that makes SVM boundaries unreliable.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

# Paths
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH  = Path(__file__).parent.parent.parent.parent / "data" / "datasets" / "irrigation_data.csv"

MODEL_PATH  = MODELS_DIR / "anomaly_svm.pkl"
SCALER_PATH = MODELS_DIR / "anomaly_svm_scaler.pkl"

# Features to monitor for anomalies
FEATURES = [
    "air_temperature",
    "air_humidity",
    "co2",
    "soil_moisture",
    "soil_temperature",
    "cum_irr",
]

# Hard rules - readings outside these are definite anomalies
NORMAL_RANGES = {
    "air_temperature" : (-5,  50),
    "air_humidity"    : (0,  100),
    "co2"             : (300, 1800),
    "soil_moisture"   : (0,  100),
    "soil_temperature": (-5,  50),
    "cum_irr"         : (0,  50),
}


def load_data(path: Path) -> np.ndarray:
    """
    Loads sensor readings for training.
    Removes obvious outliers before training.
    """
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURES)

    for feature, (low, high) in NORMAL_RANGES.items():
        df = df[df[feature].between(low, high)]

    print(f"Training samples: {len(df):,}")
    return df[FEATURES].values


def train(data_path: Path = DATA_PATH) -> dict:
    """
    Trains Isolation Forest on sensor readings.
    Saves model and scaler to models/.
    """
    print("Loading data...")
    X = load_data(data_path)

    X_train, X_test = train_test_split(
        X, test_size=0.2, shuffle=False
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    print("Training Isolation Forest...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,  # expect 5% anomalies
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_scaled)

    # Evaluate on test set
    predictions = model.predict(X_test_scaled)
    normal_rate = (predictions == 1).mean()
    print(f"Normal detection rate: {normal_rate:.2%}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nModel saved to : {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")

    return {
        "model"           : "anomaly_isolation_forest",
        "normal_detection": float(normal_rate),
        "train_samples"   : len(X_train),
        "test_samples"    : len(X_test),
    }


def predict(features: dict) -> dict:
    """
    Checks if sensor readings are normal or anomalous.

    Args:
        features: dict with current sensor readings
            {
                "air_temperature" : 24.5,
                "air_humidity"    : 68.0,
                "co2"             : 850.0,
                "soil_moisture"   : 35.0,
                "soil_temperature": 21.0,
                "cum_irr"         : 1.2,
            }

    Returns:
        {
            "is_anomaly"   : False,
            "confidence"   : 0.91,
            "rule_violated": None,
        }
    """
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train() first."
        )

    # Check hard rules first
    for feature, (low, high) in NORMAL_RANGES.items():
        if feature in features:
            value = features[feature]
            if not (low <= value <= high):
                return {
                    "is_anomaly"    : True,
                    "confidence"    : 1.0,
                    "rule_violated" : f"{feature} = {value} outside range [{low}, {high}]",
                }

    # Run Isolation Forest check
    model  = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    X = np.array([[features[f] for f in FEATURES]])
    X_scaled = scaler.transform(X)

    # Returns 1 for normal, -1 for anomaly
    prediction = model.predict(X_scaled)[0]
    score      = float(model.score_samples(X_scaled)[0])

    is_anomaly = bool(prediction == -1)

    # score is negative: closer to 0 = normal, more negative = anomaly
    # convert to confidence of being anomaly
    confidence = round(max(0.0, min(1.0, -score)), 4)

    return {
        "is_anomaly"    : is_anomaly,
        "confidence"    : confidence,
        "rule_violated" : None,
    }


if __name__ == "__main__":
    train()

    print("\nTesting with normal reading:")
    normal = {
        "air_temperature" : 22.9,
        "air_humidity"    : 85.6,
        "co2"             : 634.0,
        "soil_moisture"   : 84.2,
        "soil_temperature": 23.1,
        "cum_irr"         : 2.1,
    }
    print(predict(normal))

    print("\nTesting with anomalous reading:")
    anomaly = {
        "air_temperature" : 22.9,
        "air_humidity"    : 85.6,
        "co2"             : 634.0,
        "soil_moisture"   : 71.0,  # far below normal min
        "soil_temperature": 23.1,
        "cum_irr"         : 2.1,
    }
    print(predict(anomaly))