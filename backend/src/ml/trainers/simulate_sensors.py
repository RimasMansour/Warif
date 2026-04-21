"""
simulate_sensors.py
===================
Realistic greenhouse sensor simulation for the Warif System.

Context:
    - Environment  : Saudi Arabian closed greenhouse (Beit Mahmi)
    - Crop         : Vegetables (tomato / cucumber)
    - Temperature  : 25–45°C  (hot Saudi summer conditions)
    - Soil moisture: 40–70%   (moderate irrigation regime)

Three scientifically grounded scenarios are simulated:

    Scenario 1 — Normal Operation
        Stable environmental conditions within optimal agronomic ranges.
        Expected system behaviour: mixed irrigation decisions, low anomaly rate.

    Scenario 2 — Drought Stress Progression
        Soil moisture declines gradually over 48 hours simulating irrigation
        failure or extended dry period. Temperature rises simultaneously.
        Expected system behaviour: increasing irrigation recommendations,
        anomaly detection triggered when moisture crosses critical threshold.

    Scenario 3 — Sensor Anomaly Event
        A sudden, physically implausible spike is injected mid-sequence
        to simulate sensor malfunction or communication fault.
        Expected system behaviour: anomaly detector flags the event,
        prediction pipeline maintains safe fallback behaviour.

Output:
    backend/src/ml/evaluation/simulation/
        scenario_1_normal.csv
        scenario_2_drought.csv
        scenario_3_anomaly.csv
        simulation_results.csv          ← model predictions for all scenarios
        plots/scenario_1_normal.png
        plots/scenario_2_drought.png
        plots/scenario_3_anomaly.png
        plots/simulation_summary.png

Usage:
    python -m backend.src.ml.trainers.simulate_sensors

Scientific basis:
    Environmental parameter ranges are calibrated to:
    - Saudi greenhouse tomato/cucumber cultivation norms
    - Wageningen greenhouse dataset statistical distributions (training source)
    - FAO crop water requirement guidelines for arid-region protected agriculture
"""

import sys
import warnings
import os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).resolve().parent.parent.parent.parent.parent
ML_DIR   = ROOT / "backend" / "src" / "ml"
SIM_DIR  = ML_DIR / "evaluation" / "simulation"
PLOT_DIR = SIM_DIR / "plots"
SIM_DIR.mkdir(parents=True, exist_ok=True)
PLOT_DIR.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))

import joblib

FEATURES = ["air_temperature", "air_humidity", "co2",
            "soil_moisture", "soil_temperature", "cum_irr"]
SEQ_LEN  = 24

# ── Saudi greenhouse parameter ranges (calibrated) ───────────────────────────
# Based on: hot arid greenhouse environment, tomato/cucumber cultivation
SAUDI_PARAMS = {
    #                    mean    std   min    max
    "air_temperature" : (32.0,  4.5,  25.0,  45.0),   # °C  — hot Saudi summer
    "air_humidity"    : (62.0,  8.0,  35.0,  85.0),   # %
    "co2"             : (820.0, 60.0, 650.0, 1100.0),  # ppm — typical greenhouse
    "soil_moisture"   : (55.0,  8.0,  40.0,  70.0),   # %   — moderate regime
    "soil_temperature": (28.0,  3.5,  22.0,  38.0),   # °C  — always < air temp
    "cum_irr"         : (1.5,   0.6,  0.2,   4.0),    # L   — cumulative
}

# Agronomic thresholds for tomato/cucumber (Saudi conditions)
THRESHOLDS = {
    "soil_moisture_critical" : 35.0,   # % — below this: irrigation urgently needed
    "soil_moisture_optimal"  : 55.0,   # % — target range
    "air_temp_stress"        : 40.0,   # °C — heat stress begins
    "air_humidity_low"       : 40.0,   # % — wilting risk
}

COLORS = {
    "air_temperature" : "#E53935",
    "air_humidity"    : "#1E88E5",
    "soil_moisture"   : "#43A047",
    "soil_temperature": "#FB8C00",
    "co2"             : "#8E24AA",
    "cum_irr"         : "#00ACC1",
}

rng = np.random.default_rng(seed=42)   # reproducible


# ─────────────────────────────────────────────────────────────────────────────
# SIMULATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def _clip(value, feature):
    _, _, lo, hi = SAUDI_PARAMS[feature]
    return float(np.clip(value, lo, hi))


def _smooth_noise(n, std, seed_offset=0):
    """Generates temporally correlated noise (AR-1 process) — more realistic
    than pure white noise for sensor readings."""
    rng_local = np.random.default_rng(seed=42 + seed_offset)
    noise = np.zeros(n)
    noise[0] = rng_local.normal(0, std)
    alpha = 0.75   # autocorrelation coefficient
    for i in range(1, n):
        noise[i] = alpha * noise[i-1] + rng_local.normal(0, std * (1 - alpha**2)**0.5)
    return noise


# ── Scenario 1: Normal Operation ─────────────────────────────────────────────

def generate_normal(n_hours=72):
    """
    Stable greenhouse operation over 72 hours.
    Temperature follows a diurnal cycle (cooler at night, peak at midday).
    Soil moisture fluctuates around optimal level with periodic small drops
    after each irrigation event.
    """
    t = np.arange(n_hours)

    # Diurnal temperature cycle: peak at hour 14 (2 PM solar time)
    diurnal = 6.0 * np.sin(2 * np.pi * (t - 8) / 24)
    air_temp = 31.0 + diurnal + _smooth_noise(n_hours, 1.2, seed_offset=1)
    air_temp = np.clip(air_temp, 25.0, 44.0)

    # Humidity inversely correlated with temperature
    air_hum = 65.0 - 0.8 * (air_temp - 31.0) + _smooth_noise(n_hours, 3.0, seed_offset=2)
    air_hum = np.clip(air_hum, 38.0, 82.0)

    # CO2: slightly elevated at night (no photosynthesis), drops midday
    co2 = 820.0 - 40.0 * np.sin(2 * np.pi * (t - 8) / 24) + _smooth_noise(n_hours, 20.0, seed_offset=3)
    co2 = np.clip(co2, 680.0, 1050.0)

    # Soil moisture: slow evapotranspiration decline, periodic irrigation restores it
    soil_moist = np.zeros(n_hours)
    soil_moist[0] = 60.0
    for i in range(1, n_hours):
        et_loss = 0.3 + 0.01 * (air_temp[i] - 30)   # evapotranspiration
        soil_moist[i] = soil_moist[i-1] - et_loss + rng.normal(0, 0.3)
        if soil_moist[i] < 48.0:                      # irrigation trigger
            soil_moist[i] += rng.uniform(8.0, 12.0)
        soil_moist[i] = np.clip(soil_moist[i], 40.0, 68.0)

    soil_temp = 0.65 * air_temp + 0.35 * 26.0 + _smooth_noise(n_hours, 1.0, seed_offset=4)
    soil_temp = np.clip(soil_temp, 22.0, 36.0)

    cum_irr = np.cumsum(
        np.where(np.diff(soil_moist, prepend=soil_moist[0]) > 5, rng.uniform(0.8, 1.5, n_hours), 0)
    )

    return pd.DataFrame({
        "hour"           : t,
        "air_temperature": air_temp,
        "air_humidity"   : air_hum,
        "co2"            : co2,
        "soil_moisture"  : soil_moist,
        "soil_temperature": soil_temp,
        "cum_irr"        : cum_irr,
        "scenario"       : "Normal Operation",
    })


# ── Scenario 2: Drought Stress Progression ───────────────────────────────────

def generate_drought(n_hours=72):
    """
    Irrigation system fails at hour 12. Soil moisture declines progressively
    over 48 hours. Temperature rises due to reduced evaporative cooling.
    System should increasingly recommend irrigation as moisture drops.
    Critical threshold (35%) is crossed around hour 48.
    """
    t = np.arange(n_hours)

    # Temperature rises as soil dries (less evaporative cooling)
    temp_rise = np.where(t > 12, np.minimum((t - 12) * 0.15, 6.0), 0.0)
    diurnal   = 5.0 * np.sin(2 * np.pi * (t - 8) / 24)
    air_temp  = 30.0 + diurnal + temp_rise + _smooth_noise(n_hours, 1.0, seed_offset=5)
    air_temp  = np.clip(air_temp, 25.0, 45.0)

    # Humidity drops as soil dries
    air_hum = 65.0 - 0.9 * (air_temp - 30.0) - np.where(t > 12, (t - 12) * 0.2, 0.0)
    air_hum += _smooth_noise(n_hours, 2.5, seed_offset=6)
    air_hum = np.clip(air_hum, 28.0, 80.0)

    co2 = 830.0 + _smooth_noise(n_hours, 25.0, seed_offset=7)
    co2 = np.clip(co2, 700.0, 1080.0)

    # Soil moisture: normal until hour 12, then steady decline (no irrigation)
    soil_moist = np.zeros(n_hours)
    soil_moist[0] = 62.0
    for i in range(1, n_hours):
        if i <= 12:
            et = 0.30 + rng.normal(0, 0.1)
            if soil_moist[i-1] < 50.0:
                soil_moist[i] = soil_moist[i-1] - et + rng.uniform(8, 12)
            else:
                soil_moist[i] = soil_moist[i-1] - et
        else:
            # Irrigation failure: accelerated drying
            et = 0.55 + 0.008 * (i - 12) + rng.normal(0, 0.15)
            soil_moist[i] = soil_moist[i-1] - et
        soil_moist[i] = np.clip(soil_moist[i], 20.0, 70.0)

    soil_temp = 0.65 * air_temp + 0.35 * 27.0 + _smooth_noise(n_hours, 1.2, seed_offset=8)
    soil_temp = np.clip(soil_temp, 23.0, 38.0)

    cum_irr = np.zeros(n_hours)   # no irrigation after failure

    return pd.DataFrame({
        "hour"            : t,
        "air_temperature" : air_temp,
        "air_humidity"    : air_hum,
        "co2"             : co2,
        "soil_moisture"   : soil_moist,
        "soil_temperature": soil_temp,
        "cum_irr"         : cum_irr,
        "scenario"        : "Drought Stress",
    })


# ── Scenario 3: Sensor Anomaly Event ─────────────────────────────────────────

def generate_anomaly(n_hours=72):
    """
    Normal operation with two injected anomalies:
        Hour 28: soil_moisture sensor spike to 95% (physically impossible
                 given air conditions — likely sensor fault or short circuit)
        Hour 45: air_temperature sudden drop to 5°C (impossible in Saudi
                 greenhouse in summer — sensor disconnection or ice pack event)
    Anomaly detector should flag both events.
    """
    # Start from normal baseline
    df = generate_normal(n_hours).copy()
    df["scenario"] = "Sensor Anomaly"

    # Inject anomaly 1: impossible soil moisture spike at hour 28
    df.loc[28, "soil_moisture"] = 97.5    # impossible given 45°C air temp

    # Inject anomaly 2: impossible temperature drop at hour 45
    df.loc[45, "air_temperature"] = 4.8   # impossible in Saudi greenhouse
    df.loc[45, "air_humidity"]    = 98.0  # accompanies sensor fault

    # Inject anomaly 3: CO2 sensor flatline (stuck reading) hours 58–62
    df.loc[58:62, "co2"] = 0.0            # dead sensor

    df["anomaly_injected"] = 0
    df.loc[[28, 45, 58, 59, 60, 61, 62], "anomaly_injected"] = 1

    return df


# ─────────────────────────────────────────────────────────────────────────────
# MODEL INFERENCE ON SIMULATED DATA
# ─────────────────────────────────────────────────────────────────────────────

def load_models():
    rf_model    = joblib.load(ML_DIR / "models" / "random_forest.pkl")
    rf_scaler   = joblib.load(ML_DIR / "models" / "rf_scaler.pkl")
    xgb_model   = joblib.load(ML_DIR / "models" / "xgboost_model.pkl")
    xgb_scaler  = joblib.load(ML_DIR / "models" / "xgb_scaler.pkl")
    anom_model  = joblib.load(ML_DIR / "models" / "anomaly_svm.pkl")
    anom_scaler = joblib.load(ML_DIR / "models" / "rf_scaler.pkl")   # shared scaler
    return rf_model, rf_scaler, xgb_model, xgb_scaler, anom_model, anom_scaler


def run_inference(df, rf_model, rf_scaler, xgb_model, xgb_scaler,
                  anom_model, anom_scaler):
    """Run RF, XGBoost, and anomaly detection on each simulated timestep."""
    X = df[FEATURES].values.astype(np.float32)

    # RF prediction
    X_rf  = rf_scaler.transform(X)
    rf_proba = rf_model.predict_proba(X_rf)[:, 1]
    rf_pred  = (rf_proba >= 0.5).astype(int)

    # XGBoost prediction
    X_xgb   = xgb_scaler.transform(X)
    xgb_proba = xgb_model.predict_proba(X_xgb)[:, 1]
    xgb_pred  = (xgb_proba >= 0.5).astype(int)

    # Weighted ensemble (RF=0.35, XGB=0.25, LSTM omitted — needs sequences)
    # For simulation timestep inference, use RF+XGB ensemble only
    ens_proba = 0.58 * rf_proba + 0.42 * xgb_proba
    ens_pred  = (ens_proba >= 0.5).astype(int)

    # Anomaly detection
    X_anom     = anom_scaler.transform(X)
    anom_pred  = anom_model.predict(X_anom)   # -1 = anomaly, 1 = normal
    anom_flag  = (anom_pred == -1).astype(int)

    result = df.copy()
    result["rf_irrigation_pred"]   = rf_pred
    result["rf_confidence"]        = np.round(rf_proba, 4)
    result["xgb_irrigation_pred"]  = xgb_pred
    result["xgb_confidence"]       = np.round(xgb_proba, 4)
    result["ensemble_pred"]        = ens_pred
    result["ensemble_confidence"]  = np.round(ens_proba, 4)
    result["anomaly_detected"]     = anom_flag

    return result


# ─────────────────────────────────────────────────────────────────────────────
# PLOTS
# ─────────────────────────────────────────────────────────────────────────────

PLOT_STYLE = {
    "font.family"      : "DejaVu Sans",
    "axes.spines.top"  : False,
    "axes.spines.right": False,
    "axes.grid"        : True,
    "grid.alpha"       : 0.3,
    "figure.dpi"       : 150,
}
plt.rcParams.update(PLOT_STYLE)


def plot_scenario(df, title, filename, show_anomaly=False):
    """4-panel plot: sensor readings + model predictions."""
    fig = plt.figure(figsize=(16, 12))
    fig.suptitle(f"Warif Simulation — {title}", fontsize=14,
                 fontweight="bold", y=1.01)
    gs = gridspec.GridSpec(4, 1, hspace=0.45)

    hours = df["hour"].values

    # Panel 1: Temperature & Humidity
    ax1 = fig.add_subplot(gs[0])
    ax1b = ax1.twinx()
    l1, = ax1.plot(hours, df["air_temperature"], color=COLORS["air_temperature"],
                   lw=2, label="Air Temp (°C)")
    l2, = ax1.plot(hours, df["soil_temperature"], color=COLORS["soil_temperature"],
                   lw=1.5, linestyle="--", label="Soil Temp (°C)")
    l3, = ax1b.plot(hours, df["air_humidity"], color=COLORS["air_humidity"],
                    lw=2, label="Air Humidity (%)")
    ax1.axhline(THRESHOLDS["air_temp_stress"], color="red", lw=1,
                linestyle=":", alpha=0.6, label=f"Heat stress ({THRESHOLDS['air_temp_stress']}°C)")
    ax1.set_ylabel("Temperature (°C)", fontsize=9)
    ax1b.set_ylabel("Humidity (%)", fontsize=9, color=COLORS["air_humidity"])
    ax1.set_title("Panel 1 — Temperature & Humidity", fontsize=10, fontweight="bold")
    lines = [l1, l2, l3]
    ax1.legend(lines, [l.get_label() for l in lines], loc="upper right", fontsize=8)

    # Panel 2: Soil Moisture
    ax2 = fig.add_subplot(gs[1])
    ax2.plot(hours, df["soil_moisture"], color=COLORS["soil_moisture"],
             lw=2.5, label="Soil Moisture (%)")
    ax2.axhline(THRESHOLDS["soil_moisture_critical"], color="red", lw=1.5,
                linestyle="--", label=f"Critical threshold ({THRESHOLDS['soil_moisture_critical']}%)")
    ax2.axhline(THRESHOLDS["soil_moisture_optimal"], color="green", lw=1,
                linestyle=":", alpha=0.7, label=f"Optimal level ({THRESHOLDS['soil_moisture_optimal']}%)")
    ax2.fill_between(hours, df["soil_moisture"],
                     THRESHOLDS["soil_moisture_critical"],
                     where=(df["soil_moisture"] < THRESHOLDS["soil_moisture_critical"]),
                     color="red", alpha=0.15, label="Drought stress zone")
    ax2.set_ylabel("Soil Moisture (%)", fontsize=9)
    ax2.set_title("Panel 2 — Soil Moisture", fontsize=10, fontweight="bold")
    ax2.legend(loc="upper right", fontsize=8)
    ax2.set_ylim(15, 80)

    # Panel 3: Model Irrigation Predictions
    ax3 = fig.add_subplot(gs[2])
    ax3.fill_between(hours, df["rf_confidence"], alpha=0.35,
                     color="#2E7D32", label="RF confidence")
    ax3.fill_between(hours, df["xgb_confidence"], alpha=0.35,
                     color="#1565C0", label="XGB confidence")
    C_ENS = "#E65100"
    ax3.plot(hours, df["ensemble_confidence"], color=C_ENS,             lw=2.5, label="Ensemble confidence")
    ax3.axhline(0.5, color="black", lw=1.2, linestyle="--",
                label="Decision threshold (0.5)")
    ax3.fill_between(hours, df["ensemble_confidence"], 0.5,
                     where=(df["ensemble_confidence"] >= 0.5),
                     color="#E65100", alpha=0.15, label="Irrigation recommended")
    ax3.set_ylabel("Irrigation Probability", fontsize=9)
    ax3.set_ylim(0, 1.05)
    ax3.set_title("Panel 3 — Irrigation Prediction (Ensemble + Models)", fontsize=10,
                  fontweight="bold")
    ax3.legend(loc="upper right", fontsize=8)

    # Panel 4: Anomaly Detection
    ax4 = fig.add_subplot(gs[3])
    ax4.fill_between(hours, df["anomaly_detected"], color="#B71C1C",
                     alpha=0.7, step="post", label="Anomaly detected")
    if show_anomaly and "anomaly_injected" in df.columns:
        ax4.fill_between(hours, df["anomaly_injected"], color="#FF8F00",
                         alpha=0.4, step="post", label="Injected anomaly (ground truth)")
    ax4.set_ylabel("Anomaly Flag", fontsize=9)
    ax4.set_yticks([0, 1])
    ax4.set_yticklabels(["Normal", "Anomaly"])
    ax4.set_xlabel("Simulation Hour", fontsize=10)
    ax4.set_title("Panel 4 — Anomaly Detection", fontsize=10, fontweight="bold")
    ax4.legend(loc="upper right", fontsize=8)

    # Shared x-axis label
    for ax in [ax1, ax2, ax3]:
        ax.set_xticklabels([])

    plt.tight_layout()
    path = PLOT_DIR / filename
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: plots/{filename}")


def plot_simulation_summary(all_results):
    """Summary comparison: irrigation recommendation rate across scenarios."""
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.suptitle("Warif Simulation — Irrigation Recommendation Rate per Scenario",
                 fontsize=13, fontweight="bold")

    scenario_colors = {
        "Normal Operation": "#2E7D32",
        "Drought Stress"  : "#E53935",
        "Sensor Anomaly"  : "#E65100",
    }

    for ax, (scenario, df) in zip(axes, all_results.items()):
        irr_rate  = df["ensemble_pred"].mean() * 100
        anom_rate = df["anomaly_detected"].mean() * 100

        metrics  = ["Irrigation\nRecommended", "Anomalies\nDetected"]
        values   = [irr_rate, anom_rate]
        bar_cols = [scenario_colors[scenario], "#B71C1C"]

        bars = ax.bar(metrics, values, color=bar_cols, alpha=0.85,
                      edgecolor="white", width=0.5)
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_height() + 1.5,
                    f"{val:.1f}%", ha="center", va="bottom",
                    fontsize=12, fontweight="bold")

        ax.set_ylim(0, 100)
        ax.set_title(scenario, fontsize=11, fontweight="bold",
                     color=scenario_colors[scenario])
        ax.set_ylabel("% of Timesteps", fontsize=10)
        ax.axhline(50, color="gray", lw=1, linestyle=":", alpha=0.5)

    plt.tight_layout()
    path = PLOT_DIR / "simulation_summary.png"
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"  Saved: plots/simulation_summary.png")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run_simulation():
    print("\n" + "=" * 65)
    print("  WARIF SYSTEM — GREENHOUSE SENSOR SIMULATION")
    print("  Saudi Beit Mahmi | Tomato/Cucumber | 72-hour window")
    print("=" * 65)

    # ── Generate scenarios ────────────────────────────────────────
    print("\n[1/4]  Generating simulation scenarios ...")
    sc1 = generate_normal(n_hours=72)
    sc2 = generate_drought(n_hours=72)
    sc3 = generate_anomaly(n_hours=72)

    sc1.to_csv(SIM_DIR / "scenario_1_normal.csv",  index=False)
    sc2.to_csv(SIM_DIR / "scenario_2_drought.csv", index=False)
    sc3.to_csv(SIM_DIR / "scenario_3_anomaly.csv", index=False)
    print("       CSVs saved: scenario_1_normal.csv, scenario_2_drought.csv, "
          "scenario_3_anomaly.csv")

    # ── Load models ───────────────────────────────────────────────
    print("\n[2/4]  Loading trained models ...")
    rf_model, rf_scaler, xgb_model, xgb_scaler, anom_model, anom_scaler = load_models()
    print("       Random Forest, XGBoost, Anomaly Detector loaded.")

    # ── Run inference ─────────────────────────────────────────────
    print("\n[3/4]  Running inference on simulated data ...")
    r1 = run_inference(sc1, rf_model, rf_scaler, xgb_model, xgb_scaler,
                       anom_model, anom_scaler)
    r2 = run_inference(sc2, rf_model, rf_scaler, xgb_model, xgb_scaler,
                       anom_model, anom_scaler)
    r3 = run_inference(sc3, rf_model, rf_scaler, xgb_model, xgb_scaler,
                       anom_model, anom_scaler)

    # Print per-scenario summary
    for name, df in [("Normal Operation", r1),
                     ("Drought Stress",   r2),
                     ("Sensor Anomaly",   r3)]:
        irr   = df["ensemble_pred"].mean() * 100
        anom  = df["anomaly_detected"].mean() * 100
        peak  = df["ensemble_confidence"].max() * 100
        print(f"\n  [{name}]")
        print(f"    Irrigation recommended : {irr:.1f}% of timesteps")
        print(f"    Anomalies detected     : {anom:.1f}% of timesteps")
        print(f"    Peak ensemble conf.    : {peak:.1f}%")

    # Save combined results
    all_df = pd.concat([r1, r2, r3], ignore_index=True)
    all_df.to_csv(SIM_DIR / "simulation_results.csv", index=False)

    # ── Plots ─────────────────────────────────────────────────────
    print("\n[4/4]  Generating simulation plots ...")
    plot_scenario(r1, "Normal Operation (72h)",
                  "scenario_1_normal.png", show_anomaly=False)
    plot_scenario(r2, "Drought Stress Progression (72h)",
                  "scenario_2_drought.png", show_anomaly=False)
    plot_scenario(r3, "Sensor Anomaly Event (72h)",
                  "scenario_3_anomaly.png", show_anomaly=True)
    plot_simulation_summary({
        "Normal Operation": r1,
        "Drought Stress"  : r2,
        "Sensor Anomaly"  : r3,
    })

    print("\n" + "=" * 65)
    print("  SIMULATION COMPLETE")
    print(f"  Output directory: backend/src/ml/evaluation/simulation/")
    print("=" * 65)

    # ── Validation check ──────────────────────────────────────────
    print("\n  EXPECTED BEHAVIOUR VALIDATION")
    print("  " + "-" * 45)

    drought_irr = r2["ensemble_pred"].mean() * 100
    normal_irr  = r1["ensemble_pred"].mean() * 100
    anom_detect = r3["anomaly_detected"].sum()
    injected    = r3["anomaly_injected"].sum() if "anomaly_injected" in r3.columns else "N/A"

    check1 = "PASS" if drought_irr > normal_irr else "FAIL"
    check2 = "PASS" if anom_detect > 0 else "FAIL"

    print(f"  Drought irrig. rate > Normal rate  : "
          f"{drought_irr:.1f}% > {normal_irr:.1f}%  [{check1}]")
    print(f"  Anomaly detector triggered         : "
          f"{anom_detect} flags  (injected: {injected})  [{check2}]")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_simulation()