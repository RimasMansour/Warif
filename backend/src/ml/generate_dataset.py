"""
Warif ML Pipeline — الخطوة 1: توليد Dataset
=============================================
ليش هذا الملف؟
    النماذج (RF, LSTM, XGBoost) تحتاج أرقام تتعلم منها.
    نحن نولّد هذه الأرقام من:
      - sensor_schema.json  ← الحدود المثالية لكل sensor
      - القواعد الزراعية   ← متى يحتاج الخيار ري؟

لما تتوفر بيانات sensors حقيقية:
    استبدلي generate_dataset() بقراءة ملف CSV/JSON من المزرعة.
    باقي الكود يبقى كما هو.
"""

import pandas as pd
import numpy as np
import os

np.random.seed(42)


def generate_warif_dataset(n_samples: int = 2000) -> pd.DataFrame:
    """
    تولّد dataset واقعية مبنية على:
    - sensor_schema.json: optimal_range لكل sensor
    - knowledge base: قواعد الري من دليل الخيار

    المدخلات:
        n_samples: عدد الصفوف — 2000 كافية للتدريب الأولي

    المخرجات:
        DataFrame فيه features + label (irrigation_needed)
    """

    records = []

    for _ in range(n_samples):

        # ── Soil sensors ──────────────────────────────────────────
        # optimal_range من sensor_schema.json: [60, 80]
        # نولّد قيم تغطي نطاق واسع (30-95) لتدريب واقعي
        soil_moisture = np.random.uniform(30, 95)

        # optimal_range: [20, 30]
        soil_temp = np.random.uniform(14, 38)

        # optimal_range: [6.0, 6.8]
        soil_ph = np.random.uniform(5.0, 8.0)

        # optimal_range: [1.5, 2.5] — EC مرتفع = ملوحة
        soil_ec = np.random.uniform(0.5, 4.5)

        # ── Air sensors ───────────────────────────────────────────
        # optimal_range_day: [22, 28]
        air_temp = np.random.uniform(15, 42)

        # optimal_range: [70, 85] — فوق 90 = خطر فطريات
        humidity = np.random.uniform(40, 97)

        # optimal_range: [800, 1200]
        co2_ppm = np.random.uniform(300, 1500)

        # optimal_range: [0.8, 1.5]
        vpd_kpa = np.random.uniform(0.2, 2.5)

        # ── Plant context ─────────────────────────────────────────
        # growth_stage يؤثر على كمية الماء المطلوبة
        growth_stage = np.random.choice(
            ['seedling', 'vegetative', 'flowering', 'fruiting'],
            p=[0.15, 0.30, 0.20, 0.35]   # fruiting الأكثر حاجة للماء
        )

        days_since_transplant = np.random.randint(1, 70)

        # ── حساب label: هل يحتاج ري؟ ─────────────────────────────
        # مبني على القواعد من:
        #   - irrigation_water_management: اسقِ عند < 60% field capacity
        #   - cucumber_growing_guide: الخيار 95% ماء
        #   - sensor_schema.json: optimal_range soil.moisture = [60, 80]

        irrigation_needed = 0

        # القاعدة الأساسية: رطوبة أقل من 60% → يحتاج ري
        if soil_moisture < 60:
            irrigation_needed = 1

        # حرارة عالية + رطوبة متوسطة → يحتاج ري أسرع
        # (من knowledge base: في الصيف تزيد الحاجة لـ 75mm/أسبوع)
        if soil_moisture < 70 and air_temp > 30:
            irrigation_needed = 1

        # طور الإثمار: أعلى طلب على الماء
        # (من knowledge base: fruiting stage = highest water demand)
        if growth_stage == 'fruiting' and soil_moisture < 65:
            irrigation_needed = 1

        # طور الإزهار: لا تسمح بالجفاف أبداً
        # (من knowledge base: water stress during flowering = flower drop)
        if growth_stage == 'flowering' and soil_moisture < 65:
            irrigation_needed = 1

        # رطوبة هواء عالية جداً → أخّر الري (خطر فطريات)
        # (من greenhouse_management: above 90% = fungal disease risk)
        if humidity > 90 and soil_moisture > 65:
            irrigation_needed = 0

        # تشبع مائي → لا تروي
        # (من irrigation_guide: above 85% = overwatering risk)
        if soil_moisture > 85:
            irrigation_needed = 0

        # EC عالي جداً → تأخير الري لتجنب زيادة الملوحة
        # (من water_quality: EC > 3.0 = salt stress)
        if soil_ec > 3.5 and soil_moisture > 60:
            irrigation_needed = 0

        records.append({
            # Soil features
            'soil_moisture':          round(soil_moisture, 2),
            'soil_temp':              round(soil_temp, 2),
            'soil_ph':                round(soil_ph, 2),
            'soil_ec':                round(soil_ec, 2),
            # Air features
            'air_temp':               round(air_temp, 2),
            'humidity':               round(humidity, 2),
            'co2_ppm':                round(co2_ppm, 1),
            'vpd_kpa':                round(vpd_kpa, 2),
            # Plant context
            'growth_stage':           growth_stage,
            'days_since_transplant':  days_since_transplant,
            # Label
            'irrigation_needed':      irrigation_needed
        })

    df = pd.DataFrame(records)

    # تحويل growth_stage من نص إلى رقم (النماذج تحتاج أرقام)
    stage_map = {
        'seedling': 0,
        'vegetative': 1,
        'flowering': 2,
        'fruiting': 3
    }
    df['growth_stage_encoded'] = df['growth_stage'].map(stage_map)

    return df


def save_dataset(df: pd.DataFrame, path: str = "warif_dataset.csv"):
    """يحفظ الـ dataset ويطبع إحصائيات مفيدة"""
    df.to_csv(path, index=False)

    print("=" * 50)
    print("Dataset تم توليدها بنجاح")
    print(f"   المسار: {path}")
    print(f"   عدد الصفوف: {len(df):,}")
    print(f"   عدد الأعمدة: {len(df.columns)}")
    print()
    print("توزيع الـ Label:")
    counts = df['irrigation_needed'].value_counts()
    total  = len(df)
    print(f"   يحتاج ري  (1): {counts.get(1,0):,} ({counts.get(1,0)/total*100:.1f}%)")
    print(f"   لا يحتاج  (0): {counts.get(0,0):,} ({counts.get(0,0)/total*100:.1f}%)")
    print()
    print("احصائيات الـ Features الرئيسية:")
    for col in ['soil_moisture', 'air_temp', 'humidity', 'soil_ec']:
        print(f"   {col:20s}: "
              f"min={df[col].min():.1f}  "
              f"max={df[col].max():.1f}  "
              f"mean={df[col].mean():.1f}")
    print("=" * 50)


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))

    print("Warif -- توليد Dataset...")
    df = generate_warif_dataset(n_samples=2000)
    save_dataset(df, path=os.path.join(base_dir, "warif_dataset.csv"))

    df.head(20).to_csv(
        os.path.join(base_dir, "warif_sample.csv"), index=False
    )
    print(f"الملفات محفوظة في: {base_dir}")