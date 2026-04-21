"""
ensemble.py
-----------
Weighted ensemble that combines Random Forest, XGBoost, and LSTM
to produce the final irrigation prediction for Warif system.

Each model contributes a confidence score.
Final decision is based on weighted average of all three.

Weights are based on model accuracy:
    LSTM          : 0.40
    Random Forest : 0.35
    XGBoost       : 0.25
"""

import numpy as np
from pathlib import Path

from backend.src.ml.random_forest import predict as rf_predict
from backend.src.ml.xgboost_model import predict as xgb_predict
from backend.src.ml.lstm_model    import predict as lstm_predict

# Model weights - higher weight means more influence on final decision
WEIGHTS = {
    "random_forest": 0.35,
    "xgboost"      : 0.25,
    "lstm"         : 0.40,
}

# Decision threshold - above this probability, irrigation is needed
THRESHOLD = 0.5


def predict_single(features: dict, sequence: list) -> dict:
    """
    Runs all three models and combines their predictions.

    Args:
        features: dict with current sensor readings (for RF and XGBoost)
            {
                "air_temperature" : 24.5,
                "air_humidity"    : 68.0,
                "co2"             : 850.0,
                "soil_moisture"   : 35.0,
                "soil_temperature": 21.0,
                "cum_irr"         : 1.2,
            }

        sequence: list of last 24 sensor readings (for LSTM)
            [ {same keys as features}, ... ] x 24

    Returns:
        dict with final prediction and each model's contribution
            {
                "irrigation_needed" : 1,
                "confidence"        : 0.84,
                "model_predictions" : {
                    "random_forest" : {"irrigation_needed": 1, "confidence": 0.87},
                    "xgboost"       : {"irrigation_needed": 1, "confidence": 0.91},
                    "lstm"          : {"irrigation_needed": 1, "confidence": 0.76},
                }
            }
    """
    # Get prediction from each model
    rf_result   = rf_predict(features)
    xgb_result  = xgb_predict(features)
    lstm_result = lstm_predict(sequence)

    # Get confidence that irrigation is needed (class 1) from each model
    # If model predicted 0, we invert confidence to get probability of class 1
    def get_prob_of_irrigation(result: dict) -> float:
        if result["irrigation_needed"] == 1:
            return result["confidence"]
        else:
            return 1.0 - result["confidence"]

    rf_prob   = get_prob_of_irrigation(rf_result)
    xgb_prob  = get_prob_of_irrigation(xgb_result)
    lstm_prob = get_prob_of_irrigation(lstm_result)

    # Weighted average
    weighted_prob = (
        WEIGHTS["random_forest"] * rf_prob +
        WEIGHTS["xgboost"]       * xgb_prob +
        WEIGHTS["lstm"]          * lstm_prob
    )

    # Final decision
    final_prediction = int(weighted_prob >= THRESHOLD)
    final_confidence = round(
        weighted_prob if final_prediction == 1 else 1.0 - weighted_prob, 4
    )

    return {
        "irrigation_needed": final_prediction,
        "confidence"       : final_confidence,
        "model_predictions": {
            "random_forest": rf_result,
            "xgboost"      : xgb_result,
            "lstm"         : lstm_result,
        },
    }


def get_weights() -> dict:
    """
    Returns current model weights.
    Useful for the dashboard to display model contributions.
    """
    return WEIGHTS.copy()


if __name__ == "__main__":
    # Quick test with dummy data
    dummy_features = {
        "air_temperature" : 24.5,
        "air_humidity"    : 68.0,
        "co2"             : 850.0,
        "soil_moisture"   : 35.0,
        "soil_temperature": 21.0,
        "cum_irr"         : 1.2,
    }

    dummy_sequence = [dummy_features] * 24

    print("Testing ensemble prediction...")
    result = predict_single(dummy_features, dummy_sequence)

    print(f"\nFinal decision: {'Irrigate' if result['irrigation_needed'] else 'No irrigation'}")
    print(f"Confidence: {result['confidence']:.2%}")
    print("\nIndividual model predictions:")
    for model, pred in result["model_predictions"].items():
        decision = "Irrigate" if pred["irrigation_needed"] else "No irrigation"
        print(f"  {model:15} -> {decision} (confidence: {pred['confidence']:.2%})")