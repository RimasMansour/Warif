"""
simulate_sensors.py  — Warif System (نسخة محدّثة)
===================================================
نفس السيناريوهات الأصلية الثلاثة، معدّلة لتعمل مع النماذج الجديدة:

    السيناريو 1 — تشغيل طبيعي (Normal Operation)
        ظروف بيئية مستقرة ضمن النطاقات الزراعية المثلى.
        المتوقع: قرارات ري مختلطة، معدل anomaly منخفض.

    السيناريو 2 — إجهاد جفاف (Drought Stress)
        رطوبة التربة تنخفض تدريجياً على مدى 48 ساعة.
        المتوقع: توصيات ري متزايدة كلما انخفضت الرطوبة.

    السيناريو 3 — خلل في الـ sensors (Sensor Anomaly)
        قراءات غير منطقية مُحقنة في منتصف التسلسل.
        المتوقع: النموذج يتعامل بحذر مع القراءات الشاذة.

التغييرات عن النسخة الأصلية:
    - load_models() تشير لـ saved_models/ بدل models/
    - أسماء الـ features محدّثة لتطابق تدريب النماذج الجديدة
    - anomaly detection مبني على قواعد بدل SVM (غير موجود في النماذج الجديدة)
    - المسارات تعمل من داخل مجلد ml مباشرة
"""

import sys
import os
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from pathlib import Path

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import joblib

# ── المسارات ──────────────────────────────────────────────────────────────────
# يعمل من داخل مجلد ml مباشرة
ML_DIR   = Path(__file__).resolve().parent
SIM_DIR  = ML_DIR / "evaluation" / "simulation"
PLOT_DIR = SIM_DIR / "plots"
SIM_DIR.mkdir(parents=True, exist_ok=True)
PLOT_DIR.mkdir(parents=True, exist_ok=True)

# ── الـ features اللي دُرِّبت عليها النماذج الجديدة ──────────────────────────
# يجب أن تطابق تماماً ما في train_models.py
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

# ── نطاقات بيئة البيت المحمي السعودي ─────────────────────────────────────────
# مُعايَرة على: بيوت محمية سعودية، خيار وطماطم، صيف حار
SAUDI_PARAMS = {
    #                    mean    std    min    max
    "air_temp"       : (32.0,   4.5,  25.0,  45.0),
    "humidity"       : (62.0,   8.0,  35.0,  85.0),
    "co2_ppm"        : (820.0, 60.0, 650.0, 1100.0),
    "soil_moisture"  : (55.0,   8.0,  40.0,  70.0),
    "soil_temp"      : (28.0,   3.5,  22.0,  38.0),
    "soil_ph"        : (6.4,    0.2,   6.0,   6.8),
    "soil_ec"        : (1.8,    0.3,   1.5,   2.5),
    "vpd_kpa"        : (1.1,    0.2,   0.8,   1.5),
}

# حدود زراعية للقرار
THRESHOLDS = {
    "soil_moisture_critical": 35.0,
    "soil_moisture_optimal" : 55.0,
    "air_temp_stress"       : 40.0,
    "humidity_high"         : 90.0,
}

COLORS = {
    "air_temp"     : "#E53935",
    "humidity"     : "#1E88E5",
    "soil_moisture": "#43A047",
    "soil_temp"    : "#FB8C00",
    "co2_ppm"      : "#8E24AA",
}

rng = np.random.default_rng(seed=42)


# ── أداة ضجيج زمني واقعي ──────────────────────────────────────────────────────

def _smooth_noise(n, std, seed_offset=0):
    """ضجيج AR-1 مترابط زمنياً — أكثر واقعية من الضجيج الأبيض"""
    rng_local = np.random.default_rng(seed=42 + seed_offset)
    noise = np.zeros(n)
    noise[0] = rng_local.normal(0, std)
    alpha = 0.75
    for i in range(1, n):
        noise[i] = (alpha * noise[i-1] +
                    rng_local.normal(0, std * (1 - alpha**2)**0.5))
    return noise


# ══════════════════════════════════════════════════════════════
# السيناريوهات
# ══════════════════════════════════════════════════════════════

def generate_normal(n_hours=72):
    """
    السيناريو 1: تشغيل طبيعي مستقر على مدى 72 ساعة.
    الحرارة تتبع دورة يومية، رطوبة التربة تتذبذب حول المستوى الأمثل
    مع أحداث ري دورية.
    """
    t = np.arange(n_hours)

    # دورة حرارية يومية: ذروة الساعة 14
    diurnal  = 6.0 * np.sin(2 * np.pi * (t - 8) / 24)
    air_temp = 31.0 + diurnal + _smooth_noise(n_hours, 1.2, seed_offset=1)
    air_temp = np.clip(air_temp, 25.0, 44.0)

    # رطوبة الهواء: علاقة عكسية مع الحرارة
    humidity = 65.0 - 0.8 * (air_temp - 31.0) + _smooth_noise(n_hours, 3.0, seed_offset=2)
    humidity = np.clip(humidity, 38.0, 82.0)

    co2_ppm  = 820.0 - 40.0 * np.sin(2 * np.pi * (t - 8) / 24) + _smooth_noise(n_hours, 20.0, seed_offset=3)
    co2_ppm  = np.clip(co2_ppm, 680.0, 1050.0)

    # رطوبة التربة: تنخفض تدريجياً وترتفع عند الري
    soil_moisture = np.zeros(n_hours)
    soil_moisture[0] = 74.0
    for i in range(1, n_hours):
        et_loss = 0.25 + 0.008 * (air_temp[i] - 30)
        soil_moisture[i] = soil_moisture[i-1] - et_loss + rng.normal(0, 0.2)
        if soil_moisture[i] < 64.0:
            soil_moisture[i] += rng.uniform(6.0, 10.0)
        soil_moisture[i] = np.clip(soil_moisture[i], 62.0, 80.0)

    soil_temp = 0.65 * air_temp + 0.35 * 26.0 + _smooth_noise(n_hours, 1.0, seed_offset=4)
    soil_temp = np.clip(soil_temp, 22.0, 36.0)

    # قيم ثابتة نسبياً في التشغيل الطبيعي
    soil_ph = 6.4 + _smooth_noise(n_hours, 0.05, seed_offset=5)
    soil_ph = np.clip(soil_ph, 6.0, 6.8)

    soil_ec = 1.8 + _smooth_noise(n_hours, 0.1, seed_offset=6)
    soil_ec = np.clip(soil_ec, 1.5, 2.5)

    vpd_kpa = 1.0 + 0.3 * np.sin(2 * np.pi * (t - 8) / 24) + _smooth_noise(n_hours, 0.1, seed_offset=7)
    vpd_kpa = np.clip(vpd_kpa, 0.8, 1.5)

    # طور النمو: fruiting=3 لمعظم الوقت
    growth_stage_encoded  = np.full(n_hours, 3)
    days_since_transplant = np.clip(30 + t // 24, 30, 70).astype(int)

    return pd.DataFrame({
        "hour"                : t,
        "soil_moisture"       : soil_moisture,
        "soil_temp"           : soil_temp,
        "soil_ph"             : soil_ph,
        "soil_ec"             : soil_ec,
        "air_temp"            : air_temp,
        "humidity"            : humidity,
        "co2_ppm"             : co2_ppm,
        "vpd_kpa"             : vpd_kpa,
        "growth_stage_encoded": growth_stage_encoded,
        "days_since_transplant": days_since_transplant,
        "scenario"            : "Normal Operation",
    })


def generate_drought(n_hours=72):
    """
    السيناريو 2: فشل نظام الري عند الساعة 12.
    رطوبة التربة تنخفض تدريجياً، الحرارة ترتفع بسبب انخفاض التبريد التبخيري.
    العتبة الحرجة (35%) تُتجاوز حول الساعة 48.
    المتوقع: النموذج يوصي بالري بشكل متزايد.
    """
    t = np.arange(n_hours)

    # الحرارة ترتفع مع جفاف التربة
    temp_rise = np.where(t > 12, np.minimum((t - 12) * 0.15, 6.0), 0.0)
    diurnal   = 5.0 * np.sin(2 * np.pi * (t - 8) / 24)
    air_temp  = 30.0 + diurnal + temp_rise + _smooth_noise(n_hours, 1.0, seed_offset=5)
    air_temp  = np.clip(air_temp, 25.0, 45.0)

    humidity  = 65.0 - 0.9 * (air_temp - 30.0) - np.where(t > 12, (t - 12) * 0.2, 0.0)
    humidity  += _smooth_noise(n_hours, 2.5, seed_offset=6)
    humidity  = np.clip(humidity, 28.0, 80.0)

    co2_ppm   = 830.0 + _smooth_noise(n_hours, 25.0, seed_offset=7)
    co2_ppm   = np.clip(co2_ppm, 700.0, 1080.0)

    # رطوبة التربة: طبيعية حتى الساعة 12، ثم انخفاض مستمر
    soil_moisture = np.zeros(n_hours)
    soil_moisture[0] = 62.0
    for i in range(1, n_hours):
        if i <= 12:
            et = 0.30 + rng.normal(0, 0.1)
            if soil_moisture[i-1] < 50.0:
                soil_moisture[i] = soil_moisture[i-1] - et + rng.uniform(8, 12)
            else:
                soil_moisture[i] = soil_moisture[i-1] - et
        else:
            # فشل الري: جفاف متسارع
            et = 0.55 + 0.008 * (i - 12) + rng.normal(0, 0.15)
            soil_moisture[i] = soil_moisture[i-1] - et
        soil_moisture[i] = np.clip(soil_moisture[i], 18.0, 70.0)

    soil_temp = 0.65 * air_temp + 0.35 * 27.0 + _smooth_noise(n_hours, 1.2, seed_offset=8)
    soil_temp = np.clip(soil_temp, 23.0, 38.0)

    # EC يرتفع مع الجفاف (تركّز الأملاح)
    soil_ec   = 1.8 + np.where(t > 12, (t - 12) * 0.02, 0.0) + _smooth_noise(n_hours, 0.1, seed_offset=9)
    soil_ec   = np.clip(soil_ec, 1.5, 4.0)

    soil_ph   = 6.4 + _smooth_noise(n_hours, 0.05, seed_offset=10)
    soil_ph   = np.clip(soil_ph, 6.0, 6.8)

    vpd_kpa   = 1.2 + np.where(t > 12, (t - 12) * 0.01, 0.0) + _smooth_noise(n_hours, 0.1, seed_offset=11)
    vpd_kpa   = np.clip(vpd_kpa, 0.8, 2.5)

    growth_stage_encoded  = np.full(n_hours, 3)
    days_since_transplant = np.clip(30 + t // 24, 30, 70).astype(int)

    return pd.DataFrame({
        "hour"                : t,
        "soil_moisture"       : soil_moisture,
        "soil_temp"           : soil_temp,
        "soil_ph"             : soil_ph,
        "soil_ec"             : soil_ec,
        "air_temp"            : air_temp,
        "humidity"            : humidity,
        "co2_ppm"             : co2_ppm,
        "vpd_kpa"             : vpd_kpa,
        "growth_stage_encoded": growth_stage_encoded,
        "days_since_transplant": days_since_transplant,
        "scenario"            : "Drought Stress",
    })


def generate_anomaly(n_hours=72):
    """
    السيناريو 3: تشغيل طبيعي مع 3 قراءات شاذة مُحقنة:
        الساعة 28: رطوبة تربة 97.5% — مستحيلة في 45 درجة
        الساعة 45: حرارة هواء 4.8°C  — مستحيلة في بيت محمي سعودي
        الساعات 58-62: CO2 = 0       — sensor متوقف
    المتوقع: النموذج يتعامل بحذر مع هذه القراءات.
    """
    df = generate_normal(n_hours).copy()
    df["scenario"] = "Sensor Anomaly"

    # حقن الشذوذات
    df.loc[28, "soil_moisture"] = 97.5
    df.loc[45, "air_temp"]      = 4.8
    df.loc[45, "humidity"]      = 98.0
    df.loc[58:62, "co2_ppm"]    = 0.0

    df["anomaly_injected"] = 0
    df.loc[[28, 45, 58, 59, 60, 61, 62], "anomaly_injected"] = 1

    return df


# ══════════════════════════════════════════════════════════════
# تحميل النماذج وتشغيل التنبؤ
# ══════════════════════════════════════════════════════════════

def load_models():
    """
    يحمّل النماذج الجديدة من saved_models/
    (النسخة الأصلية كانت تحمّل من models/ القديم)
    """
    models_dir = ML_DIR / "saved_models"

    rf     = joblib.load(models_dir / "rf_model.pkl")
    xgb    = joblib.load(models_dir / "xgb_model.pkl")
    scaler = joblib.load(models_dir / "scaler.pkl")

    # LSTM اختياري
    lstm_path = models_dir / "lstm_model.keras"
    lstm = None
    if lstm_path.exists():
        import tensorflow as tf
        lstm = tf.keras.models.load_model(str(lstm_path))

    print(f"   النماذج محملة من: {models_dir}")
    print(f"   LSTM: {'متوفر' if lstm else 'غير متوفر'}")
    return rf, xgb, scaler, lstm


def _rule_based_anomaly(row: pd.Series) -> int:
    """
    كشف الشذوذات بالقواعد بدل SVM.

    ليش؟ النماذج الجديدة لا تحتوي anomaly_svm.pkl
    القواعد مستخرجة من sensor_schema.json و knowledge base:
        - رطوبة تربة > 90% مع حرارة > 30° : مستحيلة فيزيائياً
        - حرارة هواء < 10°C : مستحيلة في بيت محمي سعودي
        - CO2 = 0 : sensor متوقف
        - EC > 4.0 : ملوحة خطيرة
    """
    if row["soil_moisture"] > 90 and row["air_temp"] > 30:
        return 1
    if row["air_temp"] < 10:
        return 1
    if row["co2_ppm"] < 50:
        return 1
    if row["soil_ec"] > 4.0:
        return 1
    return 0


def run_inference(df, rf, xgb, scaler, lstm=None):
    """
    يشغّل RF + XGBoost + LSTM (إن وُجد) على كل صف في الـ DataFrame.
    يُحسب الـ Ensemble بأوزان مرجّحة.
    """
    X    = df[FEATURE_COLS].values.astype(np.float32)
    X_sc = scaler.transform(X)

    # RF
    rf_proba  = rf.predict_proba(X_sc)[:, 1]
    rf_pred   = (rf_proba >= 0.5).astype(int)

    # XGBoost
    xgb_proba = xgb.predict_proba(X_sc)[:, 1]
    xgb_pred  = (xgb_proba >= 0.5).astype(int)

    # LSTM (إن وُجد)
    if lstm is not None:
        X_3d       = X_sc.reshape(X_sc.shape[0], 1, X_sc.shape[1])
        lstm_proba = lstm.predict(X_3d, verbose=0).flatten()
        lstm_pred  = (lstm_proba >= 0.5).astype(int)
        # أوزان مرجّحة من Warif scope: RF=0.35, XGB=0.40, LSTM=0.25
        ens_proba  = 0.35 * rf_proba + 0.40 * xgb_proba + 0.25 * lstm_proba
    else:
        lstm_proba = np.zeros(len(X))
        lstm_pred  = np.zeros(len(X), dtype=int)
        # بدون LSTM: RF=0.45, XGB=0.55
        ens_proba  = 0.45 * rf_proba + 0.55 * xgb_proba

    ens_pred   = (ens_proba >= 0.5).astype(int)

    # كشف الشذوذات بالقواعد
    anom_flag  = df.apply(_rule_based_anomaly, axis=1).values

    result = df.copy()
    result["rf_pred"]             = rf_pred
    result["rf_confidence"]       = np.round(rf_proba, 4)
    result["xgb_pred"]            = xgb_pred
    result["xgb_confidence"]      = np.round(xgb_proba, 4)
    result["lstm_pred"]           = lstm_pred
    result["ensemble_pred"]       = ens_pred
    result["ensemble_confidence"] = np.round(ens_proba, 4)
    result["anomaly_detected"]    = anom_flag

    return result


# ══════════════════════════════════════════════════════════════
# الرسوم البيانية
# ══════════════════════════════════════════════════════════════

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
    """4 لوحات: قراءات الـ sensors + تنبؤات النموذج"""
    fig = plt.figure(figsize=(16, 12))
    fig.suptitle(f"Warif Simulation -- {title}",
                 fontsize=14, fontweight="bold", y=1.01)
    gs    = gridspec.GridSpec(4, 1, hspace=0.45)
    hours = df["hour"].values

    # اللوحة 1: الحرارة والرطوبة
    ax1  = fig.add_subplot(gs[0])
    ax1b = ax1.twinx()
    l1,  = ax1.plot(hours,  df["air_temp"],  color=COLORS["air_temp"],
                    lw=2, label="Air Temp (C)")
    l2,  = ax1.plot(hours,  df["soil_temp"], color=COLORS["soil_temp"],
                    lw=1.5, linestyle="--", label="Soil Temp (C)")
    l3,  = ax1b.plot(hours, df["humidity"],  color=COLORS["humidity"],
                     lw=2, label="Humidity (%)")
    ax1.axhline(THRESHOLDS["air_temp_stress"], color="red", lw=1,
                linestyle=":", alpha=0.6,
                label=f"Heat stress ({THRESHOLDS['air_temp_stress']}C)")
    ax1.set_ylabel("Temperature (C)", fontsize=9)
    ax1b.set_ylabel("Humidity (%)", fontsize=9, color=COLORS["humidity"])
    ax1.set_title("Panel 1 -- Temperature & Humidity",
                  fontsize=10, fontweight="bold")
    ax1.legend([l1, l2, l3], [l.get_label() for l in [l1, l2, l3]],
               loc="upper right", fontsize=8)

    # اللوحة 2: رطوبة التربة
    ax2 = fig.add_subplot(gs[1])
    ax2.plot(hours, df["soil_moisture"], color=COLORS["soil_moisture"],
             lw=2.5, label="Soil Moisture (%)")
    ax2.axhline(THRESHOLDS["soil_moisture_critical"], color="red", lw=1.5,
                linestyle="--",
                label=f"Critical ({THRESHOLDS['soil_moisture_critical']}%)")
    ax2.axhline(THRESHOLDS["soil_moisture_optimal"], color="green", lw=1,
                linestyle=":", alpha=0.7,
                label=f"Optimal ({THRESHOLDS['soil_moisture_optimal']}%)")
    ax2.fill_between(
        hours, df["soil_moisture"], THRESHOLDS["soil_moisture_critical"],
        where=(df["soil_moisture"] < THRESHOLDS["soil_moisture_critical"]),
        color="red", alpha=0.15, label="Drought stress zone"
    )
    ax2.set_ylabel("Soil Moisture (%)", fontsize=9)
    ax2.set_title("Panel 2 -- Soil Moisture",
                  fontsize=10, fontweight="bold")
    ax2.legend(loc="upper right", fontsize=8)
    ax2.set_ylim(15, 80)

    # اللوحة 3: تنبؤات الري
    ax3 = fig.add_subplot(gs[2])
    ax3.fill_between(hours, df["rf_confidence"],
                     alpha=0.35, color="#2E7D32", label="RF confidence")
    ax3.fill_between(hours, df["xgb_confidence"],
                     alpha=0.35, color="#1565C0", label="XGB confidence")
    ax3.plot(hours, df["ensemble_confidence"],
             color="#E65100", lw=2.5, label="Ensemble confidence")
    ax3.axhline(0.5, color="black", lw=1.2, linestyle="--",
                label="Decision threshold (0.5)")
    ax3.fill_between(
        hours, df["ensemble_confidence"], 0.5,
        where=(df["ensemble_confidence"] >= 0.5),
        color="#E65100", alpha=0.15, label="Irrigation recommended"
    )
    ax3.set_ylabel("Irrigation Probability", fontsize=9)
    ax3.set_ylim(0, 1.05)
    ax3.set_title("Panel 3 -- Irrigation Prediction",
                  fontsize=10, fontweight="bold")
    ax3.legend(loc="upper right", fontsize=8)

    # اللوحة 4: كشف الشذوذات
    ax4 = fig.add_subplot(gs[3])
    ax4.fill_between(hours, df["anomaly_detected"],
                     color="#B71C1C", alpha=0.7, step="post",
                     label="Anomaly detected")
    if show_anomaly and "anomaly_injected" in df.columns:
        ax4.fill_between(hours, df["anomaly_injected"],
                         color="#FF8F00", alpha=0.4, step="post",
                         label="Injected anomaly (ground truth)")
    ax4.set_ylabel("Anomaly Flag", fontsize=9)
    ax4.set_yticks([0, 1])
    ax4.set_yticklabels(["Normal", "Anomaly"])
    ax4.set_xlabel("Simulation Hour", fontsize=10)
    ax4.set_title("Panel 4 -- Anomaly Detection",
                  fontsize=10, fontweight="bold")
    ax4.legend(loc="upper right", fontsize=8)

    for ax in [ax1, ax2, ax3]:
        ax.set_xticklabels([])

    plt.tight_layout()
    path = PLOT_DIR / filename
    plt.savefig(path, bbox_inches="tight")
    plt.close()
    print(f"   محفوظ: plots/{filename}")


def plot_simulation_summary(all_results):
    """ملخص مقارن لمعدل توصية الري عبر السيناريوهات الثلاثة"""
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.suptitle("Warif -- Irrigation Recommendation Rate per Scenario",
                 fontsize=13, fontweight="bold")

    scenario_colors = {
        "Normal Operation": "#2E7D32",
        "Drought Stress"  : "#E53935",
        "Sensor Anomaly"  : "#E65100",
    }

    for ax, (scenario, df) in zip(axes, all_results.items()):
        irr_rate  = df["ensemble_pred"].mean() * 100
        anom_rate = df["anomaly_detected"].mean() * 100
        values    = [irr_rate, anom_rate]
        metrics   = ["Irrigation\nRecommended", "Anomalies\nDetected"]
        bar_cols  = [scenario_colors[scenario], "#B71C1C"]

        bars = ax.bar(metrics, values, color=bar_cols,
                      alpha=0.85, edgecolor="white", width=0.5)
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
    print("   محفوظ: plots/simulation_summary.png")


# ══════════════════════════════════════════════════════════════
# التشغيل الرئيسي
# ══════════════════════════════════════════════════════════════

def run_simulation():
    print("\n" + "=" * 60)
    print("  WARIF SYSTEM -- GREENHOUSE SENSOR SIMULATION")
    print("  Saudi Beit Mahmi | Cucumber | 72-hour window")
    print("=" * 60)

    # 1. توليد السيناريوهات
    print("\n[1/4]  توليد السيناريوهات...")
    sc1 = generate_normal(n_hours=72)
    sc2 = generate_drought(n_hours=72)
    sc3 = generate_anomaly(n_hours=72)

    sc1.to_csv(SIM_DIR / "scenario_1_normal.csv",  index=False)
    sc2.to_csv(SIM_DIR / "scenario_2_drought.csv", index=False)
    sc3.to_csv(SIM_DIR / "scenario_3_anomaly.csv", index=False)
    print("   CSVs محفوظة في evaluation/simulation/")

    # 2. تحميل النماذج
    print("\n[2/4]  تحميل النماذج...")
    rf, xgb, scaler, lstm = load_models()

    # 3. تشغيل التنبؤ
    print("\n[3/4]  تشغيل التنبؤ على السيناريوهات...")
    r1 = run_inference(sc1, rf, xgb, scaler, lstm)
    r2 = run_inference(sc2, rf, xgb, scaler, lstm)
    r3 = run_inference(sc3, rf, xgb, scaler, lstm)

    for name, df in [("Normal Operation", r1),
                     ("Drought Stress",   r2),
                     ("Sensor Anomaly",   r3)]:
        irr  = df["ensemble_pred"].mean() * 100
        anom = df["anomaly_detected"].mean() * 100
        peak = df["ensemble_confidence"].max() * 100
        print(f"\n   [{name}]")
        print(f"      توصيات الري    : {irr:.1f}% من الساعات")
        print(f"      شذوذات مكتشفة  : {anom:.1f}% من الساعات")
        print(f"      أعلى ثقة       : {peak:.1f}%")

    # حفظ النتائج
    all_df = pd.concat([r1, r2, r3], ignore_index=True)
    all_df.to_csv(SIM_DIR / "simulation_results.csv", index=False)

    # 4. الرسوم البيانية
    print("\n[4/4]  توليد الرسوم البيانية...")
    plot_scenario(r1, "Normal Operation (72h)",
                  "scenario_1_normal.png")
    plot_scenario(r2, "Drought Stress Progression (72h)",
                  "scenario_2_drought.png")
    plot_scenario(r3, "Sensor Anomaly Event (72h)",
                  "scenario_3_anomaly.png", show_anomaly=True)
    plot_simulation_summary({
        "Normal Operation": r1,
        "Drought Stress"  : r2,
        "Sensor Anomaly"  : r3,
    })

    # 5. التحقق من السلوك المتوقع
    print("\n" + "=" * 60)
    print("  EXPECTED BEHAVIOUR VALIDATION")
    print("  " + "-" * 40)

    drought_irr = r2["ensemble_pred"].mean() * 100
    normal_irr  = r1["ensemble_pred"].mean() * 100
    anom_detect = r3["anomaly_detected"].sum()
    injected    = r3["anomaly_injected"].sum()

    check1 = "PASS" if drought_irr > normal_irr else "FAIL"
    check2 = "PASS" if anom_detect > 0          else "FAIL"

    print(f"  Drought irrig. > Normal irrig. : "
          f"{drought_irr:.1f}% > {normal_irr:.1f}%  [{check1}]")
    print(f"  Anomaly detector triggered     : "
          f"{anom_detect} flags  (injected: {injected})  [{check2}]")

    print("\n" + "=" * 60)
    print("  SIMULATION COMPLETE")
    print(f"  النتائج في: ml/evaluation/simulation/")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_simulation()