# Warif Anomaly Detection Evaluation Summary

This report summarizes the independent evaluation of the anomaly detection layer in Warif.

## Metric Summary

| Model | Accuracy | Precision | Recall | F1-Score | False Alarm Rate | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **KNN** | 0.9083 | 0.8451 | 1.0000 | 0.9160 | 0.1833 | 0.9583 |
| **Isolation Forest** | 0.9250 | 0.9527 | 0.8944 | 0.9226 | 0.0444 | 0.9892 |
| **Rule-based Detector** | 0.1333 | 1.0000 | 0.0250 | 0.0488 | 0.0000 | 0.5125 |

## Interpretation

- Precision indicates how many predicted anomalies were correct.
- Recall indicates how many true anomalies were successfully detected.
- F1-score summarizes the balance between precision and recall.
- False alarm rate measures how often normal readings were incorrectly flagged.
- ROC-AUC summarizes discrimination using the anomaly confidence score.

The rule-based detector is evaluated on streaming scenarios, while KNN and Isolation Forest are evaluated on a balanced validation set containing normal and intentionally injected anomaly cases.
