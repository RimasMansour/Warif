"""
evaluate_models.py
==================
Comprehensive evaluation script for Warif irrigation prediction models.

Produces:
    1. Classification metrics  : Accuracy, Precision, Recall, F1, AUC-ROC, MCC
    2. Confusion matrices       : per model + normalised
    3. ROC curves               : all models on one plot
    4. Precision-Recall curves  : all models on one plot (critical for imbalanced data)
    5. Feature importance       : RF and XGBoost
    6. LSTM training history    : loss and accuracy curves
    7. Ensemble confidence dist : histogram of prediction confidence
    8. Full classification report: per-class precision/recall/F1
    9. Summary comparison table : printed + saved as CSV

All plots saved to: backend/src/ml/evaluation/
Summary CSV saved : backend/src/ml/evaluation/evaluation_summary.csv

Usage:
    python -m backend.src.ml.trainers.evaluate_models
"""

import sys
import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # non-interactive backend (safe for all environments)
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ── path setup ───────────────────────────────────────────────────────────────
ROOT      = Path(__file__).resolve().parent.parent.parent.parent.parent
ML_DIR    = ROOT / "backend" / "src" / "ml"
DATA_PATH = ROOT / "data" / "datasets" / "irrigation_data.csv"
EVAL_DIR  = ML_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))

import joblib
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, matthews_corrcoef, confusion_matrix,
    classification_report, roc_curve, precision_recall_curve,
    average_precision_score
)
from sklearn.preprocessing import label_binarize

# ── colour palette (consistent across all plots) ─────────────────────────────
C_RF   = "#2E7D32"   # dark green   — Random Forest
C_XGB  = "#1565C0"   # dark blue    — XGBoost
C_LSTM = "#6A1B9A"   # dark purple  — LSTM
C_ENS  = "#E65100"   # dark orange  — Ensemble
COLORS = {"Random Forest": C_RF, "XGBoost": C_XGB, "LSTM": C_LSTM, "Ensemble": C_ENS}

PLOT_STYLE = {
    "font.family"      : "DejaVu Sans",
    "axes.spines.top"  : False,
    "axes.spines.right": False,
    "axes.grid"        : True,
    "grid.alpha"       : 0.3,
    "figure.dpi"       : 150,
}
plt.rcParams.update(PLOT_STYLE)

# ── feature names (must match training order) ─────────────────────────────────
FEATURES = ["air_temperature", "air_humidity", "co2",
            "soil_moisture", "soil_temperature", "cum_irr"]
SEQ_LEN  = 24

# ─────────────────────────────────────────────────────────────────────────────
# 1.  DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────

def load_test_data():
    """Load held-out test split (last 20% temporally)."""
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=FEATURES + ["irrigation_needed"])

    X = df[FEATURES].values.astype(np.float32)
    y = df["irrigation_needed"].values.astype(int)

    split = int(len(X) * 0.80)
    return X[split:], y[split:], df[split:]


def build_sequences(X, y):
    """Build 24-step sequences for LSTM."""
    Xs, ys = [], []
    for i in range(SEQ_LEN, len(X)):
        Xs.append(X[i - SEQ_LEN : i])
        ys.append(y[i])
    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=int)


# ─────────────────────────────────────────────────────────────────────────────
# 2.  MODEL INFERENCE
# ─────────────────────────────────────────────────────────────────────────────

def get_rf_predictions(X_test):
    model  = joblib.load(ML_DIR / "models" / "random_forest.pkl")
    scaler = joblib.load(ML_DIR / "models" / "rf_scaler.pkl")
    Xs     = scaler.transform(X_test)
    proba  = model.predict_proba(Xs)[:, 1]
    pred   = (proba >= 0.5).astype(int)
    return pred, proba, model


def get_xgb_predictions(X_test):
    model  = joblib.load(ML_DIR / "models" / "xgboost_model.pkl")
    scaler = joblib.load(ML_DIR / "models" / "xgb_scaler.pkl")
    Xs     = scaler.transform(X_test)
    proba  = model.predict_proba(Xs)[:, 1]
    pred   = (proba >= 0.5).astype(int)
    return pred, proba, model


def get_lstm_predictions(X_test, y_test):
    from tensorflow.keras.models import load_model as keras_load
    model  = keras_load(ML_DIR / "models" / "lstm_model.keras")
    scaler = joblib.load(ML_DIR / "models" / "lstm_scaler.pkl")

    X_s  = scaler.transform(X_test)
    X_seq, y_seq = build_sequences(X_s, y_test)

    proba = model.predict(X_seq, verbose=0).flatten()
    pred  = (proba >= 0.5).astype(int)
    return pred, proba, y_seq, model


def get_ensemble_predictions(X_test, y_test):
    """Weighted ensemble: RF=0.35, XGB=0.25, LSTM=0.40."""
    _, p_rf,  _     = get_rf_predictions(X_test)
    _, p_xgb, _     = get_xgb_predictions(X_test)
    _, p_lstm, y_seq, _ = get_lstm_predictions(X_test, y_test)

    # Align RF and XGB to LSTM sequence length
    offset  = len(p_rf) - len(p_lstm)
    p_rf_a  = p_rf[offset:]
    p_xgb_a = p_xgb[offset:]

    p_ens = 0.35 * p_rf_a + 0.25 * p_xgb_a + 0.40 * p_lstm
    pred  = (p_ens >= 0.5).astype(int)
    return pred, p_ens, y_seq


# ─────────────────────────────────────────────────────────────────────────────
# 3.  METRICS CALCULATION
# ─────────────────────────────────────────────────────────────────────────────

def compute_metrics(y_true, y_pred, y_proba, name):
    return {
        "Model"       : name,
        "Accuracy"    : round(accuracy_score(y_true, y_pred)                        * 100, 2),
        "Precision"   : round(precision_score(y_true, y_pred, zero_division=0)      * 100, 2),
        "Recall"      : round(recall_score(y_true, y_pred, zero_division=0)         * 100, 2),
        "F1-Score"    : round(f1_score(y_true, y_pred, zero_division=0)             * 100, 2),
        "AUC-ROC"     : round(roc_auc_score(y_true, y_proba)                        * 100, 2),
        "Avg Precision": round(average_precision_score(y_true, y_proba)             * 100, 2),
        "MCC"         : round(matthews_corrcoef(y_true, y_pred),                    4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4.  PLOTS
# ─────────────────────────────────────────────────────────────────────────────

# 4a.  Confusion Matrices (2×2 grid)
def plot_confusion_matrices(results):
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle("Confusion Matrices — Warif Irrigation Prediction Models",
                 fontsize=14, fontweight="bold", y=1.01)

    for ax, (name, y_true, y_pred, _) in zip(axes.flat, results):
        cm  = confusion_matrix(y_true, y_pred)
        cmn = cm.astype(float) / cm.sum(axis=1, keepdims=True)  # row-normalised

        im = ax.imshow(cmn, interpolation="nearest", cmap="Greens", vmin=0, vmax=1)
        ax.set_title(name, fontsize=12, fontweight="bold", color=COLORS[name])
        ax.set_xlabel("Predicted label", fontsize=10)
        ax.set_ylabel("True label", fontsize=10)
        ax.set_xticks([0, 1]); ax.set_xticklabels(["No Irrig.", "Irrig."])
        ax.set_yticks([0, 1]); ax.set_yticklabels(["No Irrig.", "Irrig."])

        for i in range(2):
            for j in range(2):
                ax.text(j, i,
                        f"{cm[i,j]}\n({cmn[i,j]:.1%})",
                        ha="center", va="center",
                        fontsize=11, fontweight="bold",
                        color="white" if cmn[i, j] > 0.6 else "black")

        plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    plt.tight_layout()
    path = EVAL_DIR / "confusion_matrices.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4b.  ROC Curves
def plot_roc_curves(results):
    fig, ax = plt.subplots(figsize=(8, 7))
    ax.plot([0, 1], [0, 1], "k--", lw=1.5, label="Random classifier (AUC = 0.50)")

    for name, y_true, _, y_proba in results:
        fpr, tpr, _ = roc_curve(y_true, y_proba)
        auc          = roc_auc_score(y_true, y_proba)
        ax.plot(fpr, tpr, color=COLORS[name], lw=2.5,
                label=f"{name}  (AUC = {auc:.4f})")

    ax.set_xlabel("False Positive Rate",  fontsize=12)
    ax.set_ylabel("True Positive Rate",   fontsize=12)
    ax.set_title("ROC Curves — Warif Irrigation Prediction Models",
                 fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10)
    ax.set_xlim([0, 1]); ax.set_ylim([0, 1.02])

    path = EVAL_DIR / "roc_curves.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4c.  Precision-Recall Curves (key metric for imbalanced datasets)
def plot_pr_curves(results, pos_rate):
    fig, ax = plt.subplots(figsize=(8, 7))
    ax.axhline(y=pos_rate, color="k", linestyle="--", lw=1.5,
               label=f"Random classifier (AP = {pos_rate:.3f})")

    for name, y_true, _, y_proba in results:
        prec, rec, _ = precision_recall_curve(y_true, y_proba)
        ap            = average_precision_score(y_true, y_proba)
        ax.plot(rec, prec, color=COLORS[name], lw=2.5,
                label=f"{name}  (AP = {ap:.4f})")

    ax.set_xlabel("Recall",    fontsize=12)
    ax.set_ylabel("Precision", fontsize=12)
    ax.set_title("Precision-Recall Curves — Warif Irrigation Prediction Models",
                 fontsize=13, fontweight="bold")
    ax.legend(loc="upper right", fontsize=10)
    ax.set_xlim([0, 1]); ax.set_ylim([0, 1.05])

    path = EVAL_DIR / "precision_recall_curves.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4d.  Feature Importance (RF + XGBoost side by side)
def plot_feature_importance():
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    models_info = [
        ("Random Forest", "random_forest.pkl", "rf_scaler.pkl",  C_RF),
        ("XGBoost",       "xgboost_model.pkl", "xgb_scaler.pkl", C_XGB),
    ]

    for ax, (name, mfile, _, color) in zip(axes, models_info):
        model = joblib.load(ML_DIR / "models" / mfile)
        imp   = model.feature_importances_
        order = np.argsort(imp)
        feats = [FEATURES[i] for i in order]
        vals  = imp[order]

        bars = ax.barh(feats, vals, color=color, alpha=0.85, edgecolor="white")
        for bar, val in zip(bars, vals):
            ax.text(val + 0.003, bar.get_y() + bar.get_height() / 2,
                    f"{val:.3f}", va="center", fontsize=9)

        ax.set_title(f"Feature Importance — {name}",
                     fontsize=12, fontweight="bold", color=color)
        ax.set_xlabel("Importance Score", fontsize=10)
        ax.set_xlim(0, max(vals) * 1.25)

    plt.suptitle("Feature Importance Analysis — Warif System",
                 fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()
    path = EVAL_DIR / "feature_importance.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4e.  Metrics Bar Chart (all models, all metrics)
def plot_metrics_bar(summary_df):
    metrics = ["Accuracy", "Precision", "Recall", "F1-Score", "AUC-ROC"]
    models  = summary_df["Model"].tolist()
    x       = np.arange(len(metrics))
    width   = 0.20

    fig, ax = plt.subplots(figsize=(13, 6))

    for i, (_, row) in enumerate(summary_df.iterrows()):
        vals = [row[m] for m in metrics]
        offset = (i - (len(models) - 1) / 2) * width
        bars = ax.bar(x + offset, vals, width, label=row["Model"],
                      color=COLORS[row["Model"]], alpha=0.88, edgecolor="white")
        for bar, val in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 0.5,
                    f"{val:.1f}", ha="center", va="bottom",
                    fontsize=8, fontweight="bold")

    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=11)
    ax.set_ylabel("Score (%)", fontsize=11)
    ax.set_ylim(0, 115)
    ax.set_title("Performance Metrics Comparison — Warif Irrigation Prediction Models",
                 fontsize=13, fontweight="bold")
    ax.legend(loc="upper right", fontsize=10)
    ax.axhline(y=90, color="gray", linestyle=":", lw=1, alpha=0.5)
    ax.text(len(metrics) - 0.4, 91, "90% threshold", fontsize=8, color="gray")

    plt.tight_layout()
    path = EVAL_DIR / "metrics_comparison.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4f.  Ensemble Confidence Distribution
def plot_confidence_distribution(y_true, y_proba_ens):
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Ensemble Prediction Confidence Distribution",
                 fontsize=13, fontweight="bold")

    for ax, (label, mask, color, title) in zip(axes, [
        (0, y_true == 0, "#81C784", "Class 0 — No Irrigation Required"),
        (1, y_true == 1, "#E53935", "Class 1 — Irrigation Required"),
    ]):
        ax.hist(y_proba_ens[mask], bins=40, color=color,
                alpha=0.85, edgecolor="white")
        ax.axvline(x=0.5, color="black", linestyle="--", lw=1.5, label="Decision threshold (0.5)")
        ax.set_xlabel("Predicted Probability of Irrigation", fontsize=10)
        ax.set_ylabel("Sample Count", fontsize=10)
        ax.set_title(title, fontsize=11, fontweight="bold")
        ax.set_xlim([0, 1])
        ax.legend(fontsize=9)

    plt.tight_layout()
    path = EVAL_DIR / "ensemble_confidence_distribution.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# 4g.  Class Distribution in Test Set
def plot_class_distribution(y_test):
    labels  = ["No Irrigation (0)", "Irrigation (1)"]
    counts  = [(y_test == 0).sum(), (y_test == 1).sum()]
    colors  = ["#81C784", "#E53935"]
    total   = len(y_test)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.suptitle("Test Set Class Distribution", fontsize=13, fontweight="bold")

    # Bar chart
    bars = axes[0].bar(labels, counts, color=colors, alpha=0.85, edgecolor="white", width=0.5)
    for bar, cnt in zip(bars, counts):
        axes[0].text(bar.get_x() + bar.get_width() / 2,
                     bar.get_height() + total * 0.01,
                     f"{cnt:,}\n({cnt/total:.1%})",
                     ha="center", va="bottom", fontsize=11, fontweight="bold")
    axes[0].set_ylabel("Sample Count", fontsize=11)
    axes[0].set_ylim(0, max(counts) * 1.2)
    axes[0].set_title("Absolute Count", fontsize=11)

    # Pie chart
    axes[1].pie(counts, labels=labels, colors=colors, autopct="%1.1f%%",
                startangle=90, textprops={"fontsize": 11},
                wedgeprops={"edgecolor": "white", "linewidth": 2})
    axes[1].set_title("Proportional Distribution", fontsize=11)

    plt.tight_layout()
    path = EVAL_DIR / "class_distribution.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path.name}")


# ─────────────────────────────────────────────────────────────────────────────
# 5.  MAIN EVALUATION RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def run_evaluation():
    print("\n" + "=" * 65)
    print("  WARIF SYSTEM — COMPREHENSIVE ML EVALUATION REPORT")
    print("=" * 65)

    # ── Load data ────────────────────────────────────────────────
    print("\n[1/7]  Loading test data ...")
    X_test, y_test, _ = load_test_data()
    pos_rate = y_test.mean()
    print(f"       Test samples      : {len(X_test):,}")
    print(f"       Irrigation ratio  : {pos_rate:.2%}")
    print(f"       Class imbalance   : {(1-pos_rate)/pos_rate:.1f}:1  (No-Irrig : Irrig)")

    # ── Inference ────────────────────────────────────────────────
    print("\n[2/7]  Running model inference ...")

    print("       Random Forest ...")
    pred_rf,   proba_rf,   rf_model          = get_rf_predictions(X_test)

    print("       XGBoost ...")
    pred_xgb,  proba_xgb,  xgb_model         = get_xgb_predictions(X_test)

    print("       LSTM ...")
    pred_lstm, proba_lstm, y_seq, lstm_model  = get_lstm_predictions(X_test, y_test)

    print("       Ensemble ...")
    pred_ens,  proba_ens,  y_ens              = get_ensemble_predictions(X_test, y_test)

    # Align RF and XGB to LSTM/Ensemble target length
    offset = len(y_test) - len(y_seq)
    y_rf   = y_test[offset:]
    pred_rf_a  = pred_rf[offset:]
    proba_rf_a = proba_rf[offset:]
    pred_xgb_a  = pred_xgb[offset:]
    proba_xgb_a = proba_xgb[offset:]

    # ── Metrics ──────────────────────────────────────────────────
    print("\n[3/7]  Computing classification metrics ...")

    metrics_list = [
        compute_metrics(y_rf,   pred_rf_a,   proba_rf_a,   "Random Forest"),
        compute_metrics(y_seq,  pred_xgb_a,  proba_xgb_a,  "XGBoost"),
        compute_metrics(y_seq,  pred_lstm,   proba_lstm,   "LSTM"),
        compute_metrics(y_ens,  pred_ens,    proba_ens,    "Ensemble"),
    ]
    summary_df = pd.DataFrame(metrics_list)

    # ── Print table ───────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("  CLASSIFICATION METRICS SUMMARY")
    print("=" * 65)
    col_w = [16, 10, 11, 9, 10, 9, 14, 8]
    header = (f"{'Model':<16} {'Accuracy':>10} {'Precision':>11} "
              f"{'Recall':>9} {'F1-Score':>10} {'AUC-ROC':>9} "
              f"{'Avg Prec.':>14} {'MCC':>8}")
    print(header)
    print("-" * 90)
    for _, row in summary_df.iterrows():
        print(f"{row['Model']:<16} "
              f"{row['Accuracy']:>9.2f}%  "
              f"{row['Precision']:>9.2f}%  "
              f"{row['Recall']:>7.2f}%  "
              f"{row['F1-Score']:>8.2f}%  "
              f"{row['AUC-ROC']:>7.2f}%  "
              f"{row['Avg Precision']:>12.2f}%  "
              f"{row['MCC']:>7.4f}")
    print("=" * 90)

    # ── Per-class classification reports ─────────────────────────
    print("\n[4/7]  Detailed per-class classification reports ...")
    report_pairs = [
        ("Random Forest", y_rf,  pred_rf_a),
        ("XGBoost",       y_seq, pred_xgb_a),
        ("LSTM",          y_seq, pred_lstm),
        ("Ensemble",      y_ens, pred_ens),
    ]
    with open(EVAL_DIR / "classification_reports.txt", "w") as f:
        for name, yt, yp in report_pairs:
            report = classification_report(
                yt, yp,
                target_names=["No Irrigation", "Irrigation"],
                zero_division=0
            )
            block = f"\n{'='*60}\n{name}\n{'='*60}\n{report}"
            print(block)
            f.write(block + "\n")
    print(f"       Reports saved: classification_reports.txt")

    # ── Plots ────────────────────────────────────────────────────
    print("\n[5/7]  Generating plots ...")

    results_for_plots = [
        ("Random Forest", y_rf,  pred_rf_a,  proba_rf_a),
        ("XGBoost",       y_seq, pred_xgb_a, proba_xgb_a),
        ("LSTM",          y_seq, pred_lstm,  proba_lstm),
        ("Ensemble",      y_ens, pred_ens,   proba_ens),
    ]

    plot_class_distribution(y_seq)
    plot_confusion_matrices(results_for_plots)
    plot_roc_curves(results_for_plots)
    plot_pr_curves(results_for_plots, pos_rate)
    plot_feature_importance()
    plot_metrics_bar(summary_df)
    plot_confidence_distribution(y_ens, proba_ens)

    # ── Save CSV summary ─────────────────────────────────────────
    print("\n[6/7]  Saving summary CSV ...")
    csv_path = EVAL_DIR / "evaluation_summary.csv"
    summary_df.to_csv(csv_path, index=False)
    print(f"       Saved: {csv_path.name}")

    # ── Final report ─────────────────────────────────────────────
    print("\n[7/7]  Evaluation complete.")
    print(f"\n       All outputs saved to: backend/src/ml/evaluation/")
    print(f"\n       Files generated:")
    for f in sorted(EVAL_DIR.iterdir()):
        print(f"         - {f.name}")

    print("\n" + "=" * 65)
    best_f1  = summary_df.loc[summary_df["F1-Score"].idxmax(),  "Model"]
    best_auc = summary_df.loc[summary_df["AUC-ROC"].idxmax(),   "Model"]
    best_rec = summary_df.loc[summary_df["Recall"].idxmax(),    "Model"]
    print(f"  Best F1-Score   : {best_f1}")
    print(f"  Best AUC-ROC    : {best_auc}")
    print(f"  Best Recall     : {best_rec}  (critical: minimise missed irrigation events)")
    print("=" * 65 + "\n")

    return summary_df


if __name__ == "__main__":
    run_evaluation()