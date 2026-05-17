"""
Warif ML Pipeline -- Step 2: Model Training Pipeline
==================================================
Overview:
    1. Loads dataset from warif_dataset.csv (generated in Step 1).
    2. Trains three distinct base estimators: Random Forest, XGBoost, and LSTM.
    3. Evaluates performance metrics for each estimator.
    4. Persists the trained model artifacts to individual files.

Why Ensemble Estimation?
    Each base estimator operates on a distinct architectural principle:
    - Random Forest: Robust handling of tabular data, high interpretability.
    - XGBoost: Superior gradient boosted tree formulation for complex feature interactions.
    - LSTM: Recurrent architecture specialized in learning temporal dependency sequences.
    
    The final Ensemble aggregates predictions to produce a optimized, unified decision.
"""

import os
import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble         import RandomForestClassifier
from sklearn.model_selection  import train_test_split, cross_val_score
from sklearn.preprocessing    import StandardScaler
from sklearn.metrics          import (accuracy_score, classification_report,
                                      confusion_matrix)
from xgboost import XGBClassifier

import tensorflow as tf
from tensorflow.keras.models  import Sequential
from tensorflow.keras.layers  import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

import warnings
warnings.filterwarnings("ignore")


# ── Feature & Label Column Definitions ─────────────────────────────────────────
FEATURE_COLS = [
    'soil_moisture',
    'soil_temp',
    'soil_ph',
    'soil_ec',
    'air_temp',
    'humidity',
    'co2_ppm',
    'vpd_kpa',
    'growth_stage_encoded',
    'days_since_transplant',
]
LABEL_COL = 'irrigation_needed'


def load_data(path: str):
    """
    Loads dataset and performs a stratified train/test split.

    Split Strategy:
        80% Training: Used to optimize model parameters.
        20% Testing: Held out to evaluate generalization performance.
    """
    df = pd.read_csv(path)

    X = df[FEATURE_COLS].values
    y = df[LABEL_COL].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,    # Guarantees reproducibility across runs
        stratify=y          # Preserves class distribution proportions
    )

    print(f"[ML] Dataset Split Completed. Training size: {len(X_train)} | Test size: {len(X_test)}")
    return X_train, X_test, y_train, y_test


def scale_features(X_train, X_test):
    """
    Standardizes feature scales using a StandardScaler.

    Rationale:
        Variables like soil moisture and CO2 ppm operate on different scales.
        Feature scaling prevents distance-biased parameters from weighting larger values unfairly.

    Note:
        The scaler is fit solely on the training partition to avoid data leakage.
    """
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)
    return X_train_sc, X_test_sc, scaler


def train_random_forest(X_train, y_train):
    """
    Random Forest Estimator.

    Parameters:
        n_estimators=200: Builds 200 decision trees to vote on outcome, reducing variance.
        max_depth=15: Limits maximum tree depth to prevent overfitting.
    """
    print("\n[1/3] Training Random Forest Classifier...")

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1           # Parallel processing using all available CPU cores
    )
    rf.fit(X_train, y_train)

    # Feature importances extraction
    importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS)
    top3 = importances.nlargest(3)
    print("   Top 3 Feature Importances:")
    for feat, val in top3.items():
        print(f"      {feat}: {val:.3f}")

    return rf


def train_xgboost(X_train, y_train):
    """
    XGBoost Gradient Boosted Decision Trees.

    Parameters:
        n_estimators=300: 300 sequential boosting stages.
        learning_rate=0.05: Moderate step size shrinkage to prevent overfitting.
    """
    print("\n[2/3] Training XGBoost Classifier...")

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,          # Row subsample ratio
        colsample_bytree=0.8,   # Column subsample ratio
        random_state=42,
        eval_metric='logloss',
        verbosity=0
    )
    xgb.fit(X_train, y_train)

    return xgb


def train_lstm(X_train, y_train, X_test, y_test):
    """
    Recurrent Neural Network (LSTM).

    Specialization:
        Sensor telemetry naturally possesses sequential temporal dynamics.
        LSTM nodes leverage memory gates to capture temporal correlations over time.

    Reshaping:
        LSTM layers expect 3D tensors: (samples, timesteps, features).
    """
    print("\n[3/3] Training LSTM Recurrent Network...")

    # reshape: (samples, 1, features)
    X_train_3d = X_train.reshape(X_train.shape[0], 1, X_train.shape[1])
    X_test_3d  = X_test.reshape(X_test.shape[0],  1, X_test.shape[1])

    model = Sequential([
        LSTM(64, input_shape=(1, X_train.shape[1]),
             return_sequences=True),
        Dropout(0.2),           # Dropout regularization layer
        LSTM(32),               # Secondary recurrent layer
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1,  activation='sigmoid')  # Sigmoid output activation for binary classification
    ])

    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    # Early Stopping callback terminates training when validation loss ceases to improve.
    early_stop = EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )

    model.fit(
        X_train_3d, y_train,
        epochs=50,
        batch_size=32,
        validation_split=0.1,
        callbacks=[early_stop],
        verbose=0
    )

    return model, X_test_3d


def evaluate_model(name, model, X_test, y_test, is_lstm=False):
    """
    Evaluates model and prints key performance metrics.

    Metrics:
        Accuracy: Overall percentage of correct classifications.
        Precision: Ratio of true positive decisions out of all positive predictions.
        Recall: Sensitivity in detecting actual irrigation requirements.
        F1-Score: Harmonic mean of precision and recall.
    """
    if is_lstm:
        X_input = X_test.reshape(X_test.shape[0], 1, X_test.shape[1]) \
                  if len(X_test.shape) == 2 else X_test
        y_pred = (model.predict(X_input, verbose=0) > 0.5).astype(int).flatten()
    else:
        y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)

    print(f"\n   --- {name} ---")
    print(f"   Accuracy : {acc:.4f}  ({acc*100:.1f}%)")
    print(classification_report(
        y_test, y_pred,
        target_names=['no_irrigation', 'irrigation_required'],
        digits=3
    ))

    return acc, y_pred


def save_models(rf, xgb, lstm_model, scaler, base_dir):
    """
    Serializes and persists trained model weights and transformer pipelines.

    Ensures trained models can be loaded directly for operational inference
    without redundant training cycles.
    """
    models_dir = os.path.join(base_dir, "saved_models")
    os.makedirs(models_dir, exist_ok=True)

    joblib.dump(rf,     os.path.join(models_dir, "rf_model.pkl"))
    joblib.dump(xgb,    os.path.join(models_dir, "xgb_model.pkl"))
    joblib.dump(scaler, os.path.join(models_dir, "scaler.pkl"))
    lstm_model.save(    os.path.join(models_dir, "lstm_model.keras"))

    print(f"\nModels successfully saved to: {models_dir}")
    print("   rf_model.pkl")
    print("   xgb_model.pkl")
    print("   lstm_model.keras")
    print("   scaler.pkl")


if __name__ == "__main__":
    base_dir   = os.path.dirname(os.path.abspath(__file__))
    data_path  = os.path.join(base_dir, "warif_dataset.csv")

    print("=" * 50)
    print("Warif ML Pipeline: Model Optimization")
    print("=" * 50)

    # 1. Load telemetry dataset
    X_train, X_test, y_train, y_test = load_data(data_path)

    # 2. Execute feature scaling
    X_train_sc, X_test_sc, scaler = scale_features(X_train, X_test)

    # 3. Train base estimators
    rf         = train_random_forest(X_train_sc, y_train)
    xgb        = train_xgboost(X_train_sc, y_train)
    lstm, X3d  = train_lstm(X_train_sc, y_train, X_test_sc, y_test)

    # 4. Generalization performance evaluation
    print("\n" + "=" * 50)
    print("Estimator Evaluation Metrics on Holdout Test Set")
    print("=" * 50)

    acc_rf,  _ = evaluate_model("Random Forest", rf,   X_test_sc, y_test)
    acc_xgb, _ = evaluate_model("XGBoost",       xgb,  X_test_sc, y_test)
    acc_lstm,_ = evaluate_model("LSTM",           lstm, X_test_sc, y_test,
                                is_lstm=True)

    # 5. Performance comparison summary
    print("\n" + "=" * 50)
    print("Comparative Model Summary")
    print("=" * 50)
    results = {
        "Random Forest": acc_rf,
        "XGBoost"      : acc_xgb,
        "LSTM"         : acc_lstm,
    }
    for name, acc in sorted(results.items(), key=lambda x: x[1], reverse=True):
        bar = "#" * int(acc * 30)
        print(f"   {name:15s}: {acc*100:5.1f}%  {bar}")

    best = max(results, key=results.get)
    print(f"\n   Top Performing Estimator: {best} ({results[best]*100:.1f}%)")
    print("   Note: The Ensemble voting system combines all estimators for optimal decisions.")

    # 6. Persist Estimator Artifacts
    save_models(rf, xgb, lstm, scaler, base_dir)

    print("\nStep 2 Completed -- System ready for Step 3 (Database & Continual Learning setup).")