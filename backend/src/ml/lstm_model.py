"""
lstm_model.py
-------------
LSTM model for irrigation prediction in Warif system.
Uses 24-hour sequences to capture temporal patterns in sensor data.

Unlike Random Forest and XGBoost which look at a single reading,
LSTM looks at the last 24 hours to understand trends over time.

Input features:
    air_temperature, air_humidity, co2,
    soil_moisture, soil_temperature, cum_irr

Target:
    irrigation_needed (0 = no irrigation, 1 = irrigation needed)
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# Paths
BASE_DIR   = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
DATA_PATH  = Path(__file__).parent.parent.parent.parent / "data" / "datasets" / "irrigation_data.csv"

MODEL_PATH  = MODELS_DIR / "lstm_model.keras"
SCALER_PATH = MODELS_DIR / "lstm_scaler.pkl"

# Features used for prediction
FEATURES = [
    "air_temperature",
    "air_humidity",
    "co2",
    "soil_moisture",
    "soil_temperature",
    "cum_irr",
]

TARGET      = "irrigation_needed"
SEQ_LENGTH  = 24   # look at last 24 readings (2 hours at 5-min intervals)


def build_sequences(X: np.ndarray, y: np.ndarray, seq_length: int) -> tuple:
    """
    Converts flat data into sequences for LSTM.

    Example with seq_length=3:
        Input rows: [r1, r2, r3, r4, r5]
        Output sequences:
            [r1, r2, r3] -> label of r3
            [r2, r3, r4] -> label of r4
            [r3, r4, r5] -> label of r5
    """
    X_seq, y_seq = [], []
    for i in range(seq_length, len(X)):
        X_seq.append(X[i - seq_length:i])
        y_seq.append(y[i])
    return np.array(X_seq), np.array(y_seq)


def load_data(path: Path) -> tuple:
    """
    Loads irrigation_data.csv, builds sequences, and splits into train/test.
    Uses temporal split to avoid data leakage.
    """
    df = pd.read_csv(path)
    df = df.dropna(subset=FEATURES + [TARGET])

    X = df[FEATURES].values
    y = df[TARGET].values

    # Scale before building sequences
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Build sequences
    X_seq, y_seq = build_sequences(X_scaled, y, SEQ_LENGTH)

    # Temporal split - do not shuffle
    split = int(len(X_seq) * 0.8)
    X_train, X_test = X_seq[:split], X_seq[split:]
    y_train, y_test = y_seq[:split], y_seq[split:]

    print(f"Training samples : {len(X_train):,}")
    print(f"Testing samples  : {len(X_test):,}")
    print(f"Sequence shape   : {X_train.shape}")
    print(f"Irrigation ratio : {y_seq.mean():.2%}")

    return X_train, X_test, y_train, y_test, scaler


def build_model(input_shape: tuple) -> Sequential:
    """
    Builds LSTM network architecture.

    Layer structure:
        LSTM(64)  -> learns complex patterns from sequences
        Dropout   -> prevents overfitting
        LSTM(32)  -> refines patterns
        Dropout   -> prevents overfitting
        Dense(1)  -> outputs probability of irrigation needed
    """
    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(32, return_sequences=False),
        Dropout(0.2),
        Dense(16, activation="relu"),
        Dense(1, activation="sigmoid"),   # sigmoid outputs 0 to 1
    ])

    model.compile(
        optimizer="adam",
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    return model


def train(data_path: Path = DATA_PATH) -> dict:
    """
    Trains the LSTM model and saves it to models/.
    Returns training summary.
    """
    print("Loading data and building sequences...")
    X_train, X_test, y_train, y_test, scaler = load_data(data_path)

    # Build model
    print("Building LSTM model...")
    model = build_model(input_shape=(SEQ_LENGTH, len(FEATURES)))
    model.summary()

    # Early stopping - stop training if no improvement for 5 epochs
    early_stop = EarlyStopping(
        monitor="val_loss",
        patience=5,
        restore_best_weights=True,
    )

    # Train
    print("Training LSTM...")
    model.fit(
        X_train, y_train,
        epochs=30,
        batch_size=64,
        validation_split=0.1,
        callbacks=[early_stop],
        verbose=1,
    )

    # Evaluate
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"\nTest accuracy: {accuracy:.4f}")
    print(f"Test loss    : {loss:.4f}")

    # Save model and scaler
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model.save(MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nModel saved to : {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")

    return {
        "model"         : "lstm",
        "accuracy"      : float(accuracy),
        "loss"          : float(loss),
        "seq_length"    : SEQ_LENGTH,
        "train_samples" : len(X_train),
        "test_samples"  : len(X_test),
    }


def predict(sequence: list) -> dict:
    """
    Predicts irrigation need from a sequence of sensor readings.

    Args:
        sequence: list of 24 dicts, each with sensor readings
            Example:
            [
                {
                    "air_temperature" : 24.5,
                    "air_humidity"    : 68.0,
                    "co2"             : 850.0,
                    "soil_moisture"   : 35.0,
                    "soil_temperature": 21.0,
                    "cum_irr"         : 1.2,
                },
                ... (24 readings total)
            ]

    Returns:
        dict with prediction and confidence
            {
                "irrigation_needed": 1,
                "confidence"       : 0.83,
            }
    """
    if len(sequence) != SEQ_LENGTH:
        raise ValueError(
            f"Sequence must have exactly {SEQ_LENGTH} readings, got {len(sequence)}"
        )

    # Load saved model and scaler
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. Run train() first."
        )

    model  = load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    # Build input array
    X = np.array([[reading[f] for f in FEATURES] for reading in sequence])
    X_scaled = scaler.transform(X)
    X_seq = X_scaled.reshape(1, SEQ_LENGTH, len(FEATURES))

    # Predict
    probability = float(model.predict(X_seq, verbose=0)[0][0])
    prediction  = int(probability >= 0.5)

    return {
        "irrigation_needed": prediction,
        "confidence"       : round(probability if prediction == 1 else 1 - probability, 4),
    }


if __name__ == "__main__":
    train()