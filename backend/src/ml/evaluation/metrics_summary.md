# Warif ML Model Evaluation Summary Report
This document summarizes the performance of the Warif Digital Twin ML Models under the Hybrid Two-Stage Evaluation Framework.

---

## Stage 1: Classification Performance
This stage evaluates the models' ability to correctly classify the binary state of whether irrigation is required (`irrigation_needed`).

| Model Configuration | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Random Forest** | 0.9875 | 0.9857 | 0.9904 | 0.9881 | 0.9996 |
| **XGBoost** | 0.9900 | 0.9904 | 0.9904 | 0.9904 | 0.9997 |
| **LSTM Recurrent** | 0.9650 | 0.9535 | 0.9809 | 0.9670 | 0.9959 |
| **Weighted Ensemble (Warif)** | 0.9900 | 0.9904 | 0.9904 | 0.9904 | 0.9998 |

### Confusion Matrices Overview
* **Random Forest**: TN=188, FP=3, FN=2, TP=207
* **XGBoost**: TN=189, FP=2, FN=2, TP=207
* **LSTM**: TN=181, FP=10, FN=4, TP=205
* **Weighted Ensemble**: TN=189, FP=2, FN=2, TP=207

---

## Stage 2: Resource Efficiency Analysis
This stage evaluates the physical water quantity optimizations made by applying the soil water deficit formula:
$$V = \text{Area} \times \text{Root\_Depth} \times (\text{Field\_Capacity} - \text{Current\_Soil\_Moisture})$$

* **Evaluation Test Set Size**: 400 time-steps
* **Total Baseline Naive Scheduling Water Used**: 2000.00 Liters
* **Total Warif Optimized Water Used**: 1403.82 Liters
* **Cumulative Water Savings**: **596.18 Liters**
* **Percentage Water Saved**: **29.81%**

*Note: The naive baseline assumes a standard agricultural timer-based irrigation event occurring every time-step applying exactly 5.0L.*
