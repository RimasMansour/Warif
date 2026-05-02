"""
anomaly_knn.py
--------------
KNN-based anomaly detection for Warif system.
Designed for fast edge-level detection of abnormal sensor readings.

Unlike anomaly_svm which does deep analysis,
this model is optimized for speed at the edge layer.

Logic:
    - Find k nearest neighbors for incoming reading
    - If distance to neighbors is large, reading is anomalous
    - If distance is small, reading is normal
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

# Paths
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH  = Path(__file__).parent.parent.parent.parent / "data" / "datasets" / "irrigation_data.csv"

MODEL_PATH     = MODELS_DIR / "anomaly_knn.pkl"
SCALER_PATH    = MODELS_DIR / "anomaly_knn_scaler.pkl"
THRESHOLD_PATH = MODELS_DIR / "anomaly_knn_threshold.pkl"

# Features to monitor
FEATURES = [
    "air_temperature",
    "air_humidity",
    "co2",
    "soil_moisture",
    "soil_temperature",
    "cum_irr",
]

# Hard rules - same as anomaly_svm for consistency
NORMAL_RANGES = {
    "air_temperature" : (-5,  50),
    "air_humidity"    : (0,  100),
    "co2"             : (300, 1800),
    "soil_moisture"   : (0,  100),
    "soil_temperature": (-5,  50),
    "cum_irr"         : (0,  50),
}

K_NEIGHBORS = 5   # number of neighbors to compare against


def load_data(path: Path) -> np.ndarray:
    """
    Loads normal sensor readings for training.
    """
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURES)

    for feature, (low, high) in NORMAL_RANGES.items():
        df = df[df[feature].between(low, high)]

    print(f"Training samples: {len(df):,}")
    return df[FEATURES].values


def train(data_path: Path = DATA_PATH) -> dict:
    """
    Trains KNN model on normal sensor readings.
    Calculates distance threshold from training data.
    Saves model, scaler, and threshold to models/.
    """
    print("Loading data...")
    X = load_data(data_path)

    X_train, X_test = train_test_split(
        X, test_size=0.2, shuffle=False
    )

    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # Train KNN
    print("Training KNN...")
    model = NearestNeighbors(
        n_neighbors=K_NEIGHBORS,
        algorithm="ball_tree",   # fast for medium datasets
        metric="euclidean",
    )
    model.fit(X_train_scaled)

    # Calculate threshold from training data
    # Use 95th percentile of distances as the anomaly threshold
    distances, _ = model.kneighbors(X_train_scaled)
    avg_distances = distances.mean(axis=1)
    threshold = float(np.percentile(avg_distances, 99))
    print(f"Anomaly threshold (95th percentile): {threshold:.4f}")

    # Evaluate on test set
    test_distances, _ = model.kneighbors(X_test_scaled)
    test_avg_distances = test_distances.mean(axis=1)
    normal_rate = (test_avg_distances <= threshold).mean()
    print(f"Normal detection rate: {normal_rate:.2%}")

    # Save model, scaler, and threshold
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(threshold, THRESHOLD_PATH)
    print(f"\nModel saved to    : {MODEL_PATH}")
    print(f"Scaler saved to   : {SCALER_PATH}")
    print(f"Threshold saved to: {THRESHOLD_PATH}")

    return {
        "model"           : "anomaly_knn",
        "threshold"       : threshold,
        "normal_detection": float(normal_rate),
        "train_samples"   : len(X_train),
        "test_samples"    : len(X_test),
    }


def predict(features: dict) -> dict:
    """
    Checks if sensor readings are normal or anomalous using KNN.

    Args:
        features: dict with current sensor readings
            {
                "air_temperature" : 22.9,
                "air_humidity"    : 85.6,
                "co2"             : 634.0,
                "soil_moisture"   : 84.2,
                "soil_temperature": 23.1,
                "cum_irr"         : 2.1,
            }

    Returns:
        {
            "is_anomaly"   : False,
            "confidence"   : 0.85,
            "distance"     : 0.42,
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
                    "distance"      : float("inf"),
                    "rule_violated" : f"{feature} = {value} outside range [{low}, {high}]",
                }

    # Load model, scaler, and threshold
    model     = joblib.load(MODEL_PATH)
    scaler    = joblib.load(SCALER_PATH)
    threshold = joblib.load(THRESHOLD_PATH)

    # Scale input
    X = np.array([[features[f] for f in FEATURES]])
    X_scaled = scaler.transform(X)

    # Get distance to nearest neighbors
    distances, _ = model.kneighbors(X_scaled)
    avg_distance  = float(distances.mean())

    # Compare to threshold
    is_anomaly = avg_distance > threshold

    # Confidence = how far from threshold (normalized)
    confidence = round(
        min(1.0, avg_distance / (threshold * 2)), 4
    ) if is_anomaly else round(
        1.0 - (avg_distance / threshold), 4
    )

    return {
        "is_anomaly"    : bool(is_anomaly),
        "confidence"    : max(0.0, confidence),
        "distance"      : round(avg_distance, 4),
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
        "air_humidity"    : 31.5,
        "co2"             : 1200.0,
        "soil_moisture"   : 71.1,
        "soil_temperature": 23.1,
        "cum_irr"         : 2.1,
    }
    print(predict(anomaly))