"""
Warif Anomaly Evaluation Pipeline
=================================
Evaluates the anomaly detection layer independently from irrigation prediction.

Outputs:
    - anomaly_metrics_summary.md
    - anomaly_predictions_eval.csv
    - plots/anomaly_confusion_matrices.png
    - plots/anomaly_metrics_comparison.png
    - plots/anomaly_roc_curves.png
    - plots/anomaly_detection_rate.png
"""

from __future__ import annotations

import sys
from pathlib import Path
import asyncio
from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

ROOT_DIR = Path(__file__).resolve().parents[4]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from src.ml.anomaly_knn import predict as knn_predict  # noqa: E402
from src.ml.anomaly_isolation_forest import predict as if_predict  # noqa: E402
from src.ml.anomaly_detector import AnomalyDetector  # noqa: E402

BRAND_PRIMARY = "#1B5E20"
BRAND_SECONDARY = "#4CAF50"
BRAND_ACCENT = "#81C784"
BRAND_MUTED = "#E8F5E9"
TEXT_COLOR = "#263238"
RISK_COLOR = "#D32F2F"

sns.set_theme(style="whitegrid")
plt.rcParams.update(
    {
        "text.color": TEXT_COLOR,
        "axes.labelcolor": TEXT_COLOR,
        "xtick.color": TEXT_COLOR,
        "ytick.color": TEXT_COLOR,
        "axes.titlecolor": TEXT_COLOR,
        "font.family": "sans-serif",
        "figure.dpi": 150,
    }
)


def setup_paths():
    base_dir = Path(__file__).resolve().parent
    plots_dir = base_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)
    return base_dir, plots_dir


def load_telemetry() -> pd.DataFrame:
    dataset_path = ROOT_DIR / "data" / "datasets" / "irrigation_data.csv"
    df = pd.read_csv(dataset_path)
    cols = ["air_temperature", "air_humidity", "soil_moisture", "soil_temperature"]
    df = df.dropna(subset=cols).reset_index(drop=True)
    return df


def build_static_eval_set(df: pd.DataFrame, n_normal: int = 180):
    normal = df[["air_temperature", "air_humidity", "soil_moisture", "soil_temperature"]].sample(
        n=min(n_normal, len(df)), random_state=42
    ).reset_index(drop=True)

    anomaly = normal.copy()
    for i in range(len(anomaly)):
        r = i % 5
        if r == 0:
            anomaly.loc[i, "air_temperature"] = 65.0
        elif r == 1:
            anomaly.loc[i, "air_humidity"] = -8.0
        elif r == 2:
            anomaly.loc[i, "soil_moisture"] = 2.0 if anomaly.loc[i, "soil_moisture"] > 50 else 98.0
        elif r == 3:
            anomaly.loc[i, "soil_temperature"] = -15.0
        else:
            anomaly.loc[i, "air_temperature"] = 38.0
            anomaly.loc[i, "air_humidity"] = 95.0
            anomaly.loc[i, "soil_moisture"] = 10.0
            anomaly.loc[i, "soil_temperature"] = 40.0

    X = pd.concat([normal, anomaly], ignore_index=True)
    y = np.array([0] * len(normal) + [1] * len(anomaly))
    return X, y


def build_stream_eval_set(df: pd.DataFrame, n_segments: int = 60):
    """
    Build a time-ordered sequence for evaluating the rule-based detector.
    Each segment contributes one or more normal readings, followed by an injected anomaly.
    """
    base = df[["air_temperature", "air_humidity", "soil_moisture", "soil_temperature"]].sample(
        n=min(n_segments * 3, len(df)), random_state=7
    ).reset_index(drop=True)

    samples = []
    labels = []
    anomaly_types = []

    detector = AnomalyDetector()
    ts = datetime.now()

    # Warm-up history with normal readings
    for i in range(20):
        row = base.iloc[i].to_dict()
        samples.append(row)
        labels.append(0)
        anomaly_types.append("normal")
        detector.update_history("air_temperature", float(row["air_temperature"]), ts + timedelta(seconds=i))
        detector.update_history("air_humidity", float(row["air_humidity"]), ts + timedelta(seconds=i))
        detector.update_history("soil_moisture", float(row["soil_moisture"]), ts + timedelta(seconds=i))
        detector.update_history("soil_temperature", float(row["soil_temperature"]), ts + timedelta(seconds=i))

    for i in range(20, min(len(base), n_segments * 3)):
        row = base.iloc[i].copy()
        mod = i % 4
        label = 0
        a_type = "normal"

        if mod == 0:
            row["air_temperature"] = 70.0
            label = 1
            a_type = "unrealistic_jump"
        elif mod == 1:
            row["soil_temperature"] = -20.0
            label = 1
            a_type = "threshold_violation"
        elif mod == 2:
            row["soil_moisture"] = base.iloc[i - 1]["soil_moisture"]
            row["air_humidity"] = base.iloc[i - 1]["air_humidity"]
            label = 1
            a_type = "sensor_stuck"
        else:
            # plausible values, but unusual combined pattern
            row["air_temperature"] = 37.5
            row["air_humidity"] = 96.0
            row["soil_moisture"] = 12.0
            row["soil_temperature"] = 39.0
            label = 1
            a_type = "pattern_break"

        samples.append(row.to_dict())
        labels.append(label)
        anomaly_types.append(a_type)
        detector.update_history("air_temperature", float(row["air_temperature"]), ts + timedelta(seconds=i))
        detector.update_history("air_humidity", float(row["air_humidity"]), ts + timedelta(seconds=i))
        detector.update_history("soil_moisture", float(row["soil_moisture"]), ts + timedelta(seconds=i))
        detector.update_history("soil_temperature", float(row["soil_temperature"]), ts + timedelta(seconds=i))

    return pd.DataFrame(samples), np.array(labels), anomaly_types


def evaluate_model(name: str, predict_fn, X: pd.DataFrame, y: np.ndarray):
    preds = []
    scores = []
    for _, row in X.iterrows():
        res = predict_fn(row.to_dict())
        preds.append(int(res.get("is_anomaly", False)))
        scores.append(float(res.get("confidence", 0.0)))

    preds = np.array(preds)
    scores = np.array(scores)
    cm = confusion_matrix(y, preds)
    tnr = cm[0, 0] / max(1, (cm[0, 0] + cm[0, 1]))
    far = 1 - tnr

    metrics = {
        "model": name,
        "accuracy": accuracy_score(y, preds),
        "precision": precision_score(y, preds, zero_division=0),
        "recall": recall_score(y, preds, zero_division=0),
        "f1_score": f1_score(y, preds, zero_division=0),
        "roc_auc": roc_auc_score(y, scores) if len(np.unique(y)) > 1 else float("nan"),
        "false_alarm_rate": far,
        "confusion_matrix": {
            "tn": int(cm[0, 0]),
            "fp": int(cm[0, 1]),
            "fn": int(cm[1, 0]),
            "tp": int(cm[1, 1]),
        },
        "preds": preds,
        "scores": scores,
    }
    return metrics


def save_predictions_csv(X: pd.DataFrame, y: np.ndarray, anomaly_types, pred_map, output_path: Path):
    df = X.copy()
    df["y_true"] = y
    df["anomaly_type"] = anomaly_types
    for model_name, data in pred_map.items():
        prefix = model_name.lower().replace(" ", "_")
        df[f"{prefix}_pred"] = data["preds"]
        df[f"{prefix}_score"] = data["scores"]
    df.to_csv(output_path, index=False)


def plot_confusion_matrices(metrics_map, plots_dir: Path):
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    fig.suptitle("Anomaly Detection Confusion Matrices", y=1.03, color=TEXT_COLOR, weight="bold")
    cmap = sns.light_palette(BRAND_PRIMARY, as_cmap=True)
    model_order = ["KNN", "Isolation Forest", "Rule-based Detector"]
    for ax, model_name in zip(axes, model_order):
        cm = np.array(
            [[metrics_map[model_name]["confusion_matrix"]["tn"], metrics_map[model_name]["confusion_matrix"]["fp"]],
             [metrics_map[model_name]["confusion_matrix"]["fn"], metrics_map[model_name]["confusion_matrix"]["tp"]]]
        )
        sns.heatmap(
            cm / cm.sum(axis=1, keepdims=True),
            annot=True,
            fmt=".2%",
            cmap=cmap,
            cbar=False,
            ax=ax,
            xticklabels=["Normal", "Anomaly"],
            yticklabels=["Normal", "Anomaly"],
            annot_kws={"size": 10, "weight": "bold", "color": TEXT_COLOR},
        )
        ax.set_title(model_name, fontsize=11, pad=10, weight="semibold")
        ax.set_xlabel("Predicted")
        ax.set_ylabel("True")
    plt.tight_layout()
    path = plots_dir / "anomaly_confusion_matrices.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"[Anomaly Eval] Confusion matrices saved to: {path}")


def plot_metrics_comparison(metrics_map, plots_dir: Path):
    rows = []
    for model_name, data in metrics_map.items():
        rows.append(
            {
                "Model": model_name,
                "Precision": data["precision"],
                "Recall": data["recall"],
                "F1-Score": data["f1_score"],
                "False Alarm Rate": data["false_alarm_rate"],
            }
        )
    df = pd.DataFrame(rows)
    melted = df.melt(id_vars=["Model"], var_name="Metric", value_name="Score")
    plt.figure(figsize=(10, 5.5))
    palette = [BRAND_ACCENT, BRAND_SECONDARY, BRAND_PRIMARY]
    ax = sns.barplot(data=melted, x="Metric", y="Score", hue="Model", palette=palette, edgecolor="#CFD8DC")
    plt.title("Anomaly Detection Metrics Comparison", fontsize=13, weight="bold", pad=15)
    plt.xlabel("Metric")
    plt.ylabel("Score")
    plt.ylim(0, 1.05)
    for p in ax.patches:
        h = p.get_height()
        if h >= 0:
            ax.annotate(f"{h:.2%}", (p.get_x() + p.get_width() / 2.0, h + 0.01), ha="center", fontsize=8)
    plt.legend(loc="lower left", frameon=True, facecolor="white", edgecolor=BRAND_MUTED)
    plt.tight_layout()
    path = plots_dir / "anomaly_metrics_comparison.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"[Anomaly Eval] Metrics comparison saved to: {path}")


def plot_roc_curves(metrics_map, plots_dir: Path):
    plt.figure(figsize=(8, 6))
    plt.plot([0, 1], [0, 1], color="#90A4AE", linestyle="--", alpha=0.7, label="Random Guess (AUC = 0.50)")
    styles = {
        "KNN": (BRAND_SECONDARY, "-"),
        "Isolation Forest": (BRAND_PRIMARY, "-"),
        "Rule-based Detector": ("#00897B", "--"),
    }
    for model_name, data in metrics_map.items():
        if len(np.unique(data["scores"])) < 2:
            continue
        fpr, tpr, _ = roc_curve(data["truth"], data["scores"])
        color, style = styles[model_name]
        plt.plot(fpr, tpr, color=color, linestyle=style, linewidth=2.2, label=f"{model_name} (AUC = {data['roc_auc']:.4f})")
    plt.title("Anomaly Detection ROC Curves", fontsize=13, weight="bold", pad=15)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.xlim([-0.02, 1.02])
    plt.ylim([-0.02, 1.02])
    plt.legend(loc="lower right", frameon=True, facecolor="white", edgecolor=BRAND_MUTED)
    plt.tight_layout()
    path = plots_dir / "anomaly_roc_curves.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"[Anomaly Eval] ROC curves saved to: {path}")


def plot_detection_rates(metrics_map, plots_dir: Path):
    names = list(metrics_map.keys())
    values = [metrics_map[n]["recall"] for n in names]
    plt.figure(figsize=(7, 4.5))
    bars = plt.bar(names, values, color=[BRAND_ACCENT, BRAND_SECONDARY, BRAND_PRIMARY], edgecolor="#CFD8DC")
    plt.title("Anomaly Detection Rate by Model", fontsize=13, weight="bold", pad=15)
    plt.ylabel("Detection Rate (Recall)")
    plt.ylim(0, 1.05)
    for b, v in zip(bars, values):
        plt.text(b.get_x() + b.get_width() / 2, v + 0.02, f"{v:.2%}", ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    path = plots_dir / "anomaly_detection_rate.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"[Anomaly Eval] Detection rate plot saved to: {path}")


def generate_report(metrics_map, output_path: Path):
    lines = [
        "# Warif Anomaly Detection Evaluation Summary",
        "",
        "This report summarizes the independent evaluation of the anomaly detection layer in Warif.",
        "",
        "## Metric Summary",
        "",
        "| Model | Accuracy | Precision | Recall | F1-Score | False Alarm Rate | ROC-AUC |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for model_name, data in metrics_map.items():
        lines.append(
            f"| **{model_name}** | {data['accuracy']:.4f} | {data['precision']:.4f} | {data['recall']:.4f} | {data['f1_score']:.4f} | {data['false_alarm_rate']:.4f} | {data['roc_auc']:.4f} |"
        )

    lines += [
        "",
        "## Interpretation",
        "",
        "- Precision indicates how many predicted anomalies were correct.",
        "- Recall indicates how many true anomalies were successfully detected.",
        "- F1-score summarizes the balance between precision and recall.",
        "- False alarm rate measures how often normal readings were incorrectly flagged.",
        "- ROC-AUC summarizes discrimination using the anomaly confidence score.",
        "",
        "The rule-based detector is evaluated on streaming scenarios, while KNN and Isolation Forest are evaluated on a balanced validation set containing normal and intentionally injected anomaly cases.",
        "",
    ]
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[Anomaly Eval] Report generated at: {output_path}")


def main():
    base_dir, plots_dir = setup_paths()
    df = load_telemetry()

    X_static, y_static = build_static_eval_set(df)
    X_stream, y_stream, anomaly_types = build_stream_eval_set(df)

    knn_metrics = evaluate_model("KNN", knn_predict, X_static, y_static)
    if_metrics = evaluate_model("Isolation Forest", if_predict, X_static, y_static)

    async def evaluate_rule_based(stream_df: pd.DataFrame):
        detector = AnomalyDetector()
        preds = []
        scores = []
        ts = datetime.now()
        for i, row in stream_df.iterrows():
            vals = row.to_dict()
            anomaly = None
            for sensor_name in ["air_temperature", "air_humidity", "soil_moisture", "soil_temperature"]:
                anomaly = await detector.detect_anomalies(sensor_name, float(vals[sensor_name]), ts + timedelta(seconds=i))
                if anomaly:
                    break
            preds.append(1 if anomaly and anomaly.is_anomalous else 0)
            scores.append(anomaly.confidence if anomaly else 0.0)
        return np.array(preds), np.array(scores)

    rule_preds, rule_scores = asyncio.run(evaluate_rule_based(X_stream))
    cm = confusion_matrix(y_stream, rule_preds)
    far = 1 - (cm[0, 0] / max(1, (cm[0, 0] + cm[0, 1])))
    rule_metrics = {
        "model": "Rule-based Detector",
        "accuracy": accuracy_score(y_stream, rule_preds),
        "precision": precision_score(y_stream, rule_preds, zero_division=0),
        "recall": recall_score(y_stream, rule_preds, zero_division=0),
        "f1_score": f1_score(y_stream, rule_preds, zero_division=0),
        "roc_auc": roc_auc_score(y_stream, rule_scores) if len(np.unique(y_stream)) > 1 else float("nan"),
        "false_alarm_rate": far,
        "confusion_matrix": {"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1])},
        "preds": rule_preds,
        "scores": rule_scores,
        "truth": y_stream,
    }

    # attach truth for ROC plotting
    for m in (knn_metrics, if_metrics):
        m["truth"] = y_static
    rule_metrics["truth"] = y_stream

    metrics_map = {
        "KNN": knn_metrics,
        "Isolation Forest": if_metrics,
        "Rule-based Detector": rule_metrics,
    }

    predictions_csv_path = base_dir / "anomaly_predictions_eval_static.csv"
    save_predictions_csv(
        X_static,
        y_static,
        ["normal"] * len(X_static),
        {"KNN": knn_metrics, "Isolation Forest": if_metrics},
        predictions_csv_path,
    )
    stream_csv_path = base_dir / "anomaly_predictions_eval_stream.csv"
    save_predictions_csv(
        X_stream,
        y_stream,
        anomaly_types,
        {"Rule-based Detector": rule_metrics},
        stream_csv_path,
    )

    generate_report(metrics_map, base_dir / "anomaly_metrics_summary.md")
    plot_confusion_matrices(metrics_map, plots_dir)
    plot_metrics_comparison(metrics_map, plots_dir)
    plot_detection_rates(metrics_map, plots_dir)
    plot_roc_curves(metrics_map, plots_dir)

    print("[Anomaly Eval] Completed successfully.")
    for model_name, data in metrics_map.items():
        print(f"  - {model_name}: acc={data['accuracy']:.4f}, prec={data['precision']:.4f}, rec={data['recall']:.4f}, f1={data['f1_score']:.4f}, far={data['false_alarm_rate']:.4f}")


if __name__ == "__main__":
    main()
