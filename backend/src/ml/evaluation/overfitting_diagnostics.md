# Warif ML Overfitting Diagnostics

This report evaluates whether the high irrigation prediction scores are likely caused by overfitting or label leakage.

## Summary Conclusion

**No strong evidence of severe overfitting or direct label leakage was detected.**

The model reaches perfect training performance, but the holdout test and cross-validation scores remain very close to training performance. In addition, the shuffled-label control drops to near-random performance, which argues against direct leakage from the target label.

## Diagnostic Metrics

| Check | Accuracy | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: |
| Training Set | 1.0000 | 1.0000 | 1.0000 |
| Holdout Test Set | 0.9875 | 0.9881 | 0.9996 |
| 5-Fold Cross-Validation | 0.9830 +/- 0.0051 | 0.9836 +/- 0.0050 | 0.9985 +/- 0.0007 |
| Shuffled-Label Control | 0.5120 +/- 0.0122 | N/A | 0.4953 +/- 0.0157 |

## Interpretation

- The train-test accuracy gap is **0.0125**, which is small and does not indicate severe overfitting.
- The shuffled-label ROC-AUC is **0.4953**, close to random guessing. This suggests the model is not succeeding because the label is accidentally exposed.
- The strongest decision signal is **soil_moisture**, with a permutation importance of **0.4795**. This means the high score is largely explained by a strong agronomic signal in the dataset.

## Top Permutation Importances

| Feature | Mean Accuracy Drop | Std |
| :--- | :---: | :---: |
| soil_moisture | 0.4795 | 0.0254 |
| air_temp | 0.0330 | 0.0052 |
| soil_ec | 0.0203 | 0.0054 |
| growth_stage_encoded | 0.0133 | 0.0049 |
| vpd_kpa | 0.0040 | 0.0012 |
| humidity | 0.0008 | 0.0016 |
| soil_temp | 0.0005 | 0.0019 |
| soil_ph | 0.0003 | 0.0039 |
| co2_ppm | -0.0007 | 0.0020 |
| days_since_transplant | -0.0007 | 0.0011 |

## Recommended Thesis Wording

The overfitting diagnostic results show no strong evidence of severe overfitting or direct label leakage. The model maintains high performance across holdout and cross-validation evaluation, while shuffled-label validation drops to near-random performance. The high accuracy is likely explained by the dataset being strongly separable, especially through soil moisture patterns. External validation on newly collected greenhouse data remains recommended for confirming real-world generalization.
