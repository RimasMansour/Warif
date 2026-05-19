# backend/src/ml/evaluation/evaluate.py
"""
Warif ML Evaluation Pipeline -- Academic Evaluation Suite
=========================================================
Authors: Senior ML Engineer & Data Scientist (Warif Team)

Overview:
    This script implements the Stage 1 (Ensemble ML Classification) and 
    Stage 2 (Agronomic Physical Simulation) hybrid evaluation framework.
    It loads the trained models and the dataset, calculates detailed metrics 
    for each model, performs the water usage simulation, and writes a 
    comprehensive academic summary report.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
)

# Suppress TensorFlow logging warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
import tensorflow as tf

# Define Feature & Label Columns
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

def setup_directories():
    """Create directory structure for evaluation output."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    plots_dir = os.path.join(base_dir, "plots")
    os.makedirs(plots_dir, exist_ok=True)
    return base_dir, plots_dir

def load_data(dataset_path: str):
    """Load dataset and perform the exact stratified train/test split (80/20)."""
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
    
    df = pd.read_csv(dataset_path)
    X = df[FEATURE_COLS].values
    y = df[LABEL_COL].values

    # Stratified split matching train_models.py
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )
    return X_test, y_test

def load_models(models_dir: str):
    """Load pre-trained models and scaler."""
    rf_path = os.path.join(models_dir, "rf_model.pkl")
    xgb_path = os.path.join(models_dir, "xgb_model.pkl")
    scaler_path = os.path.join(models_dir, "scaler.pkl")
    lstm_path = os.path.join(models_dir, "lstm_model.keras")

    if not (os.path.exists(rf_path) and os.path.exists(xgb_path) and os.path.exists(scaler_path)):
        raise FileNotFoundError(
            f"Pre-trained models not found in {models_dir}. Please run train_models.py first."
        )

    rf = joblib.load(rf_path)
    xgb = joblib.load(xgb_path)
    scaler = joblib.load(scaler_path)

    lstm = None
    if os.path.exists(lstm_path):
        try:
            lstm = tf.keras.models.load_model(lstm_path)
            print("[ML Eval] LSTM model loaded successfully.")
        except Exception as e:
            print(f"[ML Eval] Warning: Failed to load LSTM model: {e}")
    else:
        print("[ML Eval] Warning: LSTM model file not found. Running without LSTM.")

    return rf, xgb, lstm, scaler

def run_predictions(rf, xgb, lstm, scaler, X_test, y_test):
    """Generate probability and class predictions for all models and the Ensemble."""
    # Scale test features
    X_test_sc = scaler.transform(X_test)

    # 1. Random Forest Predictions
    rf_probs = rf.predict_proba(X_test_sc)[:, 1]
    rf_preds = rf.predict(X_test_sc)

    # 2. XGBoost Predictions
    xgb_probs = xgb.predict_proba(X_test_sc)[:, 1]
    xgb_preds = xgb.predict(X_test_sc)

    # 3. LSTM Predictions
    if lstm is not None:
        X_test_3d = X_test_sc.reshape(X_test_sc.shape[0], 1, X_test_sc.shape[1])
        lstm_probs = lstm.predict(X_test_3d, verbose=0).flatten()
        lstm_preds = (lstm_probs >= 0.5).astype(int)
    else:
        lstm_probs = rf_probs
        lstm_preds = rf_preds

    # 4. Weighted Voting Ensemble (Soft Voting)
    # Weights matching continual_learning.py: RF=0.35, XGB=0.40, LSTM=0.25
    if lstm is not None:
        ensemble_probs = 0.35 * rf_probs + 0.40 * xgb_probs + 0.25 * lstm_probs
    else:
        # If LSTM is not available, re-allocate weights: RF=0.45, XGB=0.55
        ensemble_probs = 0.45 * rf_probs + 0.55 * xgb_probs
    
    ensemble_preds = (ensemble_probs >= 0.5).astype(int)

    return {
        'rf': (rf_preds, rf_probs),
        'xgb': (xgb_preds, xgb_probs),
        'lstm': (lstm_preds, lstm_probs),
        'ensemble': (ensemble_preds, ensemble_probs)
    }

def calculate_classification_metrics(predictions, y_test):
    """Compute classification metrics for each model configuration."""
    metrics = {}
    for model_name, (preds, probs) in predictions.items():
        tn, fp, fn, tp = confusion_matrix(y_test, preds).ravel()
        metrics[model_name] = {
            'accuracy': float(accuracy_score(y_test, preds)),
            'precision': float(precision_score(y_test, preds)),
            'recall': float(recall_score(y_test, preds)),
            'f1_score': float(f1_score(y_test, preds)),
            'roc_auc': float(roc_auc_score(y_test, probs)),
            'confusion_matrix': {
                'tn': int(tn),
                'fp': int(fp),
                'fn': int(fn),
                'tp': int(tp)
            }
        }
    return metrics

def run_agronomic_simulation(X_test, predictions):
    """
    Stage 2: Agronomic Physical Simulation.
    Calculates dynamic water volume deficits and compares against a naive timer-based baseline.
    """
    soil_moisture = X_test[:, 0]  # First column in FEATURE_COLS is soil_moisture
    ensemble_preds, _ = predictions['ensemble']

    # Simulation Parameters
    AREA = 1.0                # 1.0 m^2 zone
    ROOT_DEPTH = 0.25         # 0.25 m depth
    FIELD_CAPACITY = 75.0     # 75.0% Target soil moisture

    baseline_usage = []
    optimized_usage = []
    savings = []

    for i in range(len(soil_moisture)):
        current_sm = soil_moisture[i]
        ens_pred = ensemble_preds[i]

        # 1. Baseline Naive Scheduling (Fixed timer: triggers every step, always applies 5L)
        v_base = 5.0
        baseline_usage.append(v_base)

        # 2. Warif Optimized Scheduling
        if ens_pred == 1 and current_sm < FIELD_CAPACITY:
            # Deficit formula: V = Area * Root_Depth * (Field_Capacity - Current_SM)
            v_opt = AREA * ROOT_DEPTH * (FIELD_CAPACITY - current_sm)
            v_opt = max(0.1, round(float(v_opt), 2))  # Ensure minimal water if triggered
        else:
            v_opt = 0.0
        optimized_usage.append(v_opt)

        savings.append(v_base - v_opt)

    total_baseline = sum(baseline_usage)
    total_optimized = sum(optimized_usage)
    total_savings = total_baseline - total_optimized
    pct_savings = (total_savings / total_baseline) * 100 if total_baseline > 0 else 0.0

    return {
        'baseline_history': baseline_usage,
        'optimized_history': optimized_usage,
        'total_baseline_L': float(total_baseline),
        'total_optimized_L': float(total_optimized),
        'total_savings_L': float(total_savings),
        'percentage_savings': float(pct_savings)
    }

def save_predictions_csv(X_test, y_test, predictions, simulation, output_path):
    """Save raw prediction and simulation data to CSV for plotting."""
    df = pd.DataFrame({
        'soil_moisture': X_test[:, 0],
        'y_true': y_test,
        'rf_pred': predictions['rf'][0],
        'rf_prob': predictions['rf'][1],
        'xgb_pred': predictions['xgb'][0],
        'xgb_prob': predictions['xgb'][1],
        'lstm_pred': predictions['lstm'][0],
        'lstm_prob': predictions['lstm'][1],
        'ensemble_pred': predictions['ensemble'][0],
        'ensemble_prob': predictions['ensemble'][1],
        'baseline_water': simulation['baseline_history'],
        'optimized_water': simulation['optimized_history']
    })
    df.to_csv(output_path, index=False)
    print(f"[ML Eval] Evaluation predictions saved to CSV: {output_path}")

def generate_report(metrics, simulation, output_path):
    """Generate metrics_summary.md file for thesis copy-paste."""
    report_content = f"""# Warif ML Model Evaluation Summary Report
This document summarizes the performance of the Warif Digital Twin ML Models under the Hybrid Two-Stage Evaluation Framework.

---

## Stage 1: Classification Performance
This stage evaluates the models' ability to correctly classify the binary state of whether irrigation is required (`irrigation_needed`).

| Model Configuration | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Random Forest** | {metrics['rf']['accuracy']:.4f} | {metrics['rf']['precision']:.4f} | {metrics['rf']['recall']:.4f} | {metrics['rf']['f1_score']:.4f} | {metrics['rf']['roc_auc']:.4f} |
| **XGBoost** | {metrics['xgb']['accuracy']:.4f} | {metrics['xgb']['precision']:.4f} | {metrics['xgb']['recall']:.4f} | {metrics['xgb']['f1_score']:.4f} | {metrics['xgb']['roc_auc']:.4f} |
| **LSTM Recurrent** | {metrics['lstm']['accuracy']:.4f} | {metrics['lstm']['precision']:.4f} | {metrics['lstm']['recall']:.4f} | {metrics['lstm']['f1_score']:.4f} | {metrics['lstm']['roc_auc']:.4f} |
| **Weighted Ensemble (Warif)** | {metrics['ensemble']['accuracy']:.4f} | {metrics['ensemble']['precision']:.4f} | {metrics['ensemble']['recall']:.4f} | {metrics['ensemble']['f1_score']:.4f} | {metrics['ensemble']['roc_auc']:.4f} |

### Confusion Matrices Overview
* **Random Forest**: TN={metrics['rf']['confusion_matrix']['tn']}, FP={metrics['rf']['confusion_matrix']['fp']}, FN={metrics['rf']['confusion_matrix']['fn']}, TP={metrics['rf']['confusion_matrix']['tp']}
* **XGBoost**: TN={metrics['xgb']['confusion_matrix']['tn']}, FP={metrics['xgb']['confusion_matrix']['fp']}, FN={metrics['xgb']['confusion_matrix']['fn']}, TP={metrics['xgb']['confusion_matrix']['tp']}
* **LSTM**: TN={metrics['lstm']['confusion_matrix']['tn']}, FP={metrics['lstm']['confusion_matrix']['fp']}, FN={metrics['lstm']['confusion_matrix']['fn']}, TP={metrics['lstm']['confusion_matrix']['tp']}
* **Weighted Ensemble**: TN={metrics['ensemble']['confusion_matrix']['tn']}, FP={metrics['ensemble']['confusion_matrix']['fp']}, FN={metrics['ensemble']['confusion_matrix']['fn']}, TP={metrics['ensemble']['confusion_matrix']['tp']}

---

## Stage 2: Resource Efficiency Analysis
This stage evaluates the physical water quantity optimizations made by applying the soil water deficit formula:
$$V = \\text{{Area}} \\times \\text{{Root\\_Depth}} \\times (\\text{{Field\\_Capacity}} - \\text{{Current\\_Soil\\_Moisture}})$$

* **Evaluation Test Set Size**: {len(simulation['baseline_history'])} time-steps
* **Total Baseline Naive Scheduling Water Used**: {simulation['total_baseline_L']:.2f} Liters
* **Total Warif Optimized Water Used**: {simulation['total_optimized_L']:.2f} Liters
* **Cumulative Water Savings**: **{simulation['total_savings_L']:.2f} Liters**
* **Percentage Water Saved**: **{simulation['percentage_savings']:.2f}%**

*Note: The naive baseline assumes a standard agricultural timer-based irrigation event occurring every time-step applying exactly 5.0L.*
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"[ML Eval] Markdown report generated: {output_path}")

if __name__ == "__main__":
    print("=" * 60)
    print("Warif ML Evaluation Pipeline -- Initiating Evaluation Suite")
    print("=" * 60)

    # 1. Directories setup
    base_dir, plots_dir = setup_directories()
    
    # Paths setup
    ml_dir = os.path.dirname(base_dir)
    models_dir = os.path.join(ml_dir, "models")
    root_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "..", ".."))
    dataset_path = os.path.join(root_dir, "data", "datasets", "warif_dataset.csv")

    # 2. Load Data & Models
    X_test, y_test = load_data(dataset_path)
    rf, xgb, lstm, scaler = load_models(models_dir)

    # 3. Generate predictions
    predictions = run_predictions(rf, xgb, lstm, scaler, X_test, y_test)

    # 4. Compute Stage 1 (Classification Metrics)
    metrics = calculate_classification_metrics(predictions, y_test)

    # 5. Compute Stage 2 (Physical Agronomic Simulation)
    simulation = run_agronomic_simulation(X_test, predictions)

    # 6. Save raw predictions and simulation history to CSV
    predictions_csv_path = os.path.join(base_dir, "predictions_eval.csv")
    save_predictions_csv(X_test, y_test, predictions, simulation, predictions_csv_path)

    # 7. Generate metrics report
    report_path = os.path.join(base_dir, "metrics_summary.md")
    generate_report(metrics, simulation, report_path)

    print("\n[ML Eval] Stage 1 & Stage 2 evaluation calculations completed successfully.")
    print("=" * 60)
