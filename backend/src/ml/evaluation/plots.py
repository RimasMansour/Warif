# backend/src/ml/evaluation/plots.py
"""
Warif ML Visualization Pipeline -- Academic Plot Generator
===========================================================
Authors: Senior ML Engineer & Data Scientist (Warif Team)

Overview:
    This script generates high-resolution, publication-ready plots for 
    the Warif Digital Twin thesis report. It follows a customized "Smart Green 
    Agriculture" branding identity (Deep Greens, Leaf Greens, Slate Gray text).
    
Required Plots:
    1. confusion_matrices.png: Normalized confusion matrices in a 2x2 grid.
    2. roc_curves.png: Combined ROC curves with AUC annotations.
    3. metrics_comparison.png: Grouped bar chart comparing Accuracy, Precision, Recall, and F1.
    4. water_savings_analysis.png: Cumulative water savings curve over the test timeline.
    5. feature_importances.png: Side-by-side feature importance for RF and XGBoost.
"""

import os
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, roc_curve, roc_auc_score, accuracy_score, precision_score, recall_score, f1_score

# 1. Branding Config
BRAND_PRIMARY = "#1B5E20"    # Deep Green
BRAND_SECONDARY = "#4CAF50"  # Leaf Green
BRAND_ACCENT = "#81C784"     # Light Eco Green
BRAND_MUTED = "#E8F5E9"      # Soft Green background tint
TEXT_COLOR = "#263238"       # Dark Slate Gray

# Set global Matplotlib/Seaborn configurations
sns.set_theme(style="whitegrid")
plt.rcParams.update({
    'text.color': TEXT_COLOR,
    'axes.labelcolor': TEXT_COLOR,
    'xtick.color': TEXT_COLOR,
    'ytick.color': TEXT_COLOR,
    'axes.titlecolor': TEXT_COLOR,
    'font.family': 'sans-serif',
    'figure.titlesize': 14,
    'axes.labelsize': 11,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.dpi': 150
})

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

def load_data_and_models(eval_dir):
    """Load evaluation predictions CSV and trained models."""
    csv_path = os.path.join(eval_dir, "predictions_eval.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Predictions CSV not found at {csv_path}. Run evaluate.py first.")
    
    df = pd.read_csv(csv_path)

    # Load models for feature importance
    ml_dir = os.path.dirname(eval_dir)
    models_dir = os.path.join(ml_dir, "models")
    
    rf = joblib.load(os.path.join(models_dir, "rf_model.pkl"))
    xgb = joblib.load(os.path.join(models_dir, "xgb_model.pkl"))
    
    return df, rf, xgb

def plot_confusion_matrices(df, plots_dir):
    """Generate 2x2 grid of normalized confusion matrices."""
    models = {
        'Random Forest': ('rf_pred', 0, 0),
        'XGBoost': ('xgb_pred', 0, 1),
        'LSTM Recurrent': ('lstm_pred', 1, 0),
        'Weighted Ensemble': ('ensemble_pred', 1, 1)
    }

    fig, axes = plt.subplots(2, 2, figsize=(10, 8))
    fig.suptitle("Normalized Confusion Matrices (Classification Decision)", y=0.98, color=TEXT_COLOR, weight='bold')

    cmap = sns.light_palette(BRAND_PRIMARY, as_cmap=True)

    for name, (col, r, c) in models.items():
        ax = axes[r, c]
        cm = confusion_matrix(df['y_true'], df[col], normalize='true')
        
        sns.heatmap(
            cm, annot=True, fmt=".2%", cmap=cmap, cbar=False, ax=ax,
            xticklabels=['No Irrigation', 'Irrigation Required'],
            yticklabels=['No Irrigation', 'Irrigation Required'],
            annot_kws={"size": 11, "weight": "bold", "color": TEXT_COLOR}
        )
        ax.set_title(name, fontsize=12, pad=10, weight='semibold')
        ax.set_xlabel("Predicted Label", fontsize=10)
        ax.set_ylabel("True Label", fontsize=10)

    plt.tight_layout()
    output_path = os.path.join(plots_dir, "confusion_matrices.png")
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    print(f"[ML Plot] Confusion Matrices Grid saved to: {output_path}")

def plot_roc_curves(df, plots_dir):
    """Generate combined ROC curves with AUC annotations."""
    models = {
        'Random Forest': ('rf_prob', BRAND_ACCENT, '--'),
        'XGBoost': ('xgb_prob', BRAND_SECONDARY, '-.'),
        'LSTM Recurrent': ('lstm_prob', '#80CBC4', ':'),
        'Weighted Ensemble': ('ensemble_prob', BRAND_PRIMARY, '-')
    }

    plt.figure(figsize=(8, 6))
    
    # Plot diagonal reference line
    plt.plot([0, 1], [0, 1], color="#90A4AE", linestyle="--", alpha=0.7, label="Random Guess (AUC = 0.50)")

    for name, (col, color, style) in models.items():
        fpr, tpr, _ = roc_curve(df['y_true'], df[col])
        auc_score = roc_auc_score(df['y_true'], df[col])
        linewidth = 2.5 if name == 'Weighted Ensemble' else 1.5
        
        plt.plot(
            fpr, tpr, color=color, linestyle=style, linewidth=linewidth,
            label=f"{name} (AUC = {auc_score:.4f})"
        )

    plt.title("Receiver Operating Characteristic (ROC) Curves", fontsize=13, weight='bold', pad=15)
    plt.xlabel("False Positive Rate", fontsize=11)
    plt.ylabel("True Positive Rate", fontsize=11)
    plt.xlim([-0.02, 1.02])
    plt.ylim([-0.02, 1.02])
    plt.legend(loc="lower right", frameon=True, facecolor="white", edgecolor=BRAND_MUTED)
    
    plt.tight_layout()
    output_path = os.path.join(plots_dir, "roc_curves.png")
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    print(f"[ML Plot] ROC Curves Comparison saved to: {output_path}")

def plot_metrics_comparison(df, plots_dir):
    """Generate grouped bar chart comparing performance across 4 models."""
    models = {
        'Random Forest': 'rf_pred',
        'XGBoost': 'xgb_pred',
        'LSTM Recurrent': 'lstm_pred',
        'Weighted Ensemble': 'ensemble_pred'
    }

    metrics_list = []
    
    for name, col in models.items():
        y_pred = df[col]
        y_true = df['y_true']
        metrics_list.append({
            'Model': name,
            'Accuracy': accuracy_score(y_true, y_pred),
            'Precision': precision_score(y_true, y_pred),
            'Recall': recall_score(y_true, y_pred),
            'F1-Score': f1_score(y_true, y_pred)
        })

    metrics_df = pd.DataFrame(metrics_list)
    
    # Melt dataframe for easy plotting with seaborn
    melted_df = pd.melt(metrics_df, id_vars=['Model'], var_name='Metric', value_name='Score')

    plt.figure(figsize=(9, 6))
    
    # Define custom color palette
    colors = [BRAND_ACCENT, BRAND_SECONDARY, "#00897B", BRAND_PRIMARY]
    
    ax = sns.barplot(
        data=melted_df, x='Metric', y='Score', hue='Model',
        palette=colors, edgecolor="#CFD8DC"
    )

    plt.title("Comparative Performance Metrics Across Models", fontsize=13, weight='bold', pad=15)
    plt.xlabel("Performance Metric", fontsize=11)
    plt.ylabel("Metric Score", fontsize=11)
    plt.ylim([0.8, 1.02])  # Zoom in on high performance range for clarity
    
    # Add values on top of bars
    for p in ax.patches:
        height = p.get_height()
        if height > 0:
            ax.annotate(
                f"{height:.2%}",
                (p.get_x() + p.get_width() / 2., height + 0.005),
                ha='center', va='bottom', fontsize=8, color=TEXT_COLOR, weight='semibold'
            )

    plt.legend(loc="lower left", frameon=True, facecolor="white", edgecolor=BRAND_MUTED)
    plt.tight_layout()
    output_path = os.path.join(plots_dir, "metrics_comparison.png")
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    print(f"[ML Plot] Model Metrics Comparison saved to: {output_path}")

def plot_water_savings(df, plots_dir):
    """Generate line plot showing cumulative water consumption saving."""
    cum_baseline = np.cumsum(df['baseline_water'])
    cum_optimized = np.cumsum(df['optimized_water'])

    plt.figure(figsize=(9, 5.5))
    
    plt.plot(cum_baseline, label="Baseline Naive Scheduling (Fixed Timer 5L)", color="#E57373", linestyle="--", linewidth=1.8)
    plt.plot(cum_optimized, label="Warif Optimized Scheduling (ML-Driven Volume)", color=BRAND_PRIMARY, linewidth=2.5)
    
    # Fill the gap to visually emphasize savings
    plt.fill_between(
        range(len(cum_baseline)), cum_baseline, cum_optimized,
        color=BRAND_SECONDARY, alpha=0.15, label="Cumulative Water Saved"
    )

    # Highlight final volumes
    final_base = cum_baseline.iloc[-1]
    final_opt = cum_optimized.iloc[-1]
    savings_l = final_base - final_opt
    savings_pct = (savings_l / final_base) * 100 if final_base > 0 else 0

    # Annotate final numbers on chart
    plt.scatter([len(cum_baseline)-1], [final_base], color="#D32F2F", zorder=5)
    plt.scatter([len(cum_optimized)-1], [final_opt], color=BRAND_PRIMARY, zorder=5)
    
    plt.annotate(f"Baseline: {final_base:.1f} L", (len(cum_baseline)-1, final_base), textcoords="offset points", xytext=(-80,10), ha='center', weight='bold', color="#C62828")
    plt.annotate(f"Warif: {final_opt:.1f} L", (len(cum_optimized)-1, final_opt), textcoords="offset points", xytext=(-70,-20), ha='center', weight='bold', color=BRAND_PRIMARY)

    plt.title(f"Cumulative Water Optimization Analysis\nTotal Water Saved: {savings_l:.1f} Liters ({savings_pct:.1f}%)", fontsize=12, weight='bold', pad=15)
    plt.xlabel("Timeline Steps (Test Set Samples)", fontsize=11)
    plt.ylabel("Cumulative Water Consumption (Liters)", fontsize=11)
    plt.legend(loc="upper left", frameon=True, facecolor="white", edgecolor=BRAND_MUTED)

    plt.tight_layout()
    output_path = os.path.join(plots_dir, "water_savings_analysis.png")
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    print(f"[ML Plot] Cumulative Water Savings saved to: {output_path}")

def plot_feature_importances(rf, xgb, plots_dir):
    """Generate side-by-side feature importance bar charts for RF and XGBoost."""
    # Process RF importances
    rf_importances = pd.DataFrame({
        'Feature': FEATURE_COLS,
        'Importance': rf.feature_importances_
    }).sort_values(by='Importance', ascending=True)

    # Process XGB importances
    xgb_importances = pd.DataFrame({
        'Feature': FEATURE_COLS,
        'Importance': xgb.feature_importances_
    }).sort_values(by='Importance', ascending=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 6))

    # Plot Random Forest Importances
    sns.barplot(data=rf_importances, x='Importance', y='Feature', ax=ax1, color=BRAND_SECONDARY, edgecolor="#CFD8DC")
    ax1.set_title("Feature Importance - Random Forest", fontsize=11, weight='semibold', pad=10)
    ax1.set_xlabel("Relative Importance", fontsize=10)
    ax1.set_ylabel("Environmental Sensor Feature", fontsize=10)

    # Plot XGBoost Importances
    sns.barplot(data=xgb_importances, x='Importance', y='Feature', ax=ax2, color=BRAND_PRIMARY, edgecolor="#CFD8DC")
    ax2.set_title("Feature Importance - XGBoost", fontsize=11, weight='semibold', pad=10)
    ax2.set_xlabel("F-Score Importance", fontsize=10)
    ax2.set_ylabel("") # Avoid repeating feature labels on right plot
    ax2.set_yticklabels([]) # Clear ticks

    plt.suptitle("Feature Importance Comparison (Decision Drivers)", y=0.98, color=TEXT_COLOR, weight='bold')
    plt.tight_layout()
    output_path = os.path.join(plots_dir, "feature_importances.png")
    plt.savefig(output_path, bbox_inches='tight')
    plt.close()
    print(f"[ML Plot] Feature Importances saved to: {output_path}")

if __name__ == "__main__":
    print("=" * 60)
    print("Warif ML Plot Generator -- Initiating Branding Visualization")
    print("=" * 60)

    eval_dir = os.path.dirname(os.path.abspath(__file__))
    plots_dir = os.path.join(eval_dir, "plots")

    # Load predictions and models
    df, rf, xgb = load_data_and_models(eval_dir)

    # Plot 1: Confusion Matrices
    plot_confusion_matrices(df, plots_dir)

    # Plot 2: ROC Curves
    plot_roc_curves(df, plots_dir)

    # Plot 3: Metrics Comparison
    plot_metrics_comparison(df, plots_dir)

    # Plot 4: Water Savings
    plot_water_savings(df, plots_dir)

    # Plot 5: Feature Importances
    plot_feature_importances(rf, xgb, plots_dir)

    print("\n[ML Plot] All 5 high-resolution evaluation plots generated successfully.")
    print("=" * 60)
