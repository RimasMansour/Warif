"""
Warif ML Pipeline -- الخطوة 2: تدريب النماذج
==============================================
ما الذي يحدث هنا؟
    1. نقرأ warif_dataset.csv اللي ولّدناها في الخطوة 1
    2. ندرّب 3 نماذج: Random Forest, XGBoost, LSTM
    3. نقيّم كل نموذج ونطبع النتائج
    4. نحفظ كل نموذج كملف منفصل

ليش 3 نماذج وليس واحد؟
    كل نموذج له نقطة قوة مختلفة:
    - RF     : قوي مع البيانات الجدولية، سهل التفسير
    - XGBoost: دقة عالية مع التفاعلات المعقدة بين الـ features
    - LSTM   : يفهم الأنماط الزمنية (كيف تتغير القراءات مع الوقت)
    الـ Ensemble يجمع الثلاثة للحصول على أفضل قرار.

لما تتوفر بيانات حقيقية:
    غيري السطر: df = pd.read_csv(...)
    وأشيري لملف الـ sensors الحقيقي -- باقي الكود يبقى كما هو.
"""

import os
import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble         import RandomForestClassifier
from sklearn.model_selection  import train_test_split, cross_val_score
from sklearn.preprocessing    import StandardScaler
from sklearn.metrics          import (accuracy_score, classification_report,
                                      confusion_matrix)
from xgboost import XGBClassifier

import tensorflow as tf
from tensorflow.keras.models  import Sequential
from tensorflow.keras.layers  import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

import warnings
warnings.filterwarnings("ignore")


# ── الأعمدة التي يستخدمها النموذج ─────────────────────────────────────────
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
LABEL_COL = 'irrigation_needed'


def load_data(path: str):
    """
    يقرأ الـ dataset ويقسمها لـ train/test.

    ليش 80/20؟
        80% للتدريب -- النموذج يتعلم منها
        20% للاختبار -- نقيّم عليها بدون ما النموذج شافها قبل
        هذا يعطينا تقييم حقيقي لأداء النموذج
    """
    df = pd.read_csv(path)

    X = df[FEATURE_COLS].values
    y = df[LABEL_COL].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,    # لضمان نفس التقسيم في كل تشغيل
        stratify=y          # يحافظ على نفس نسبة 0/1 في train و test
    )

    print(f"Train: {len(X_train)} صف  |  Test: {len(X_test)} صف")
    return X_train, X_test, y_train, y_test


def scale_features(X_train, X_test):
    """
    يوحّد مقياس الـ features (StandardScaler).

    ليش مهم؟
        soil_moisture تتراوح 30-95
        co2_ppm       تتراوح 300-1500
        بدون scaling النموذج قد يعطي co2 وزناً أكبر فقط لأن أرقامه أكبر
        بعد scaling كل feature بنفس الوزن الابتدائي

    ملاحظة: نحسب الـ scaler على train فقط ثم نطبقه على test
            حتى لا يتسرب أي معلومة من test للتدريب
    """
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)
    return X_train_sc, X_test_sc, scaler


def train_random_forest(X_train, y_train):
    """
    Random Forest -- النموذج الأساسي في Warif.

    n_estimators=200: 200 شجرة قرار، كل واحدة تعطي رأيها
                      الأغلبية تفوز -- هذا يقلل الأخطاء
    max_depth=15:     نحدد عمق الأشجار لمنع Overfitting
                      (حفظ البيانات بدل التعلم منها)
    """
    print("\n[1/3] تدريب Random Forest...")

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1           # يستخدم كل أنوية المعالج للسرعة
    )
    rf.fit(X_train, y_train)

    # أهم features حسب RF -- مفيد لفهم ما يؤثر على قرار الري
    importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS)
    top3 = importances.nlargest(3)
    print("   أهم 3 features:")
    for feat, val in top3.items():
        print(f"      {feat}: {val:.3f}")

    return rf


def train_xgboost(X_train, y_train):
    """
    XGBoost -- النموذج الأعلى دقة في Warif.

    يبني أشجار بشكل تتابعي -- كل شجرة تصحح أخطاء السابقة
    n_estimators=300: 300 جولة تصحيح
    learning_rate=0.05: خطوات صغيرة = تعلم أبطأ لكن أدق
    """
    print("\n[2/3] تدريب XGBoost...")

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,          # يستخدم 80% من البيانات في كل جولة
        colsample_bytree=0.8,   # يستخدم 80% من الـ features في كل شجرة
        random_state=42,
        eval_metric='logloss',
        verbosity=0
    )
    xgb.fit(X_train, y_train)

    return xgb


def train_lstm(X_train, y_train, X_test, y_test):
    """
    LSTM -- النموذج الزمني في Warif.

    ليش LSTM للـ sensors؟
        بيانات الـ sensors لها طابع زمني -- قراءة الساعة 8 مرتبطة
        بقراءة الساعة 9. LSTM يفهم هذا الترابط.

    الـ reshape:
        LSTM تتوقع شكل (samples, timesteps, features)
        نعامل كل صف كـ sequence من خطوة زمنية واحدة حالياً
        لما تتوفر بيانات حقيقية نزيد timesteps لـ 24 (ساعات)
    """
    print("\n[3/3] تدريب LSTM...")

    # reshape: (samples, 1, features)
    X_train_3d = X_train.reshape(X_train.shape[0], 1, X_train.shape[1])
    X_test_3d  = X_test.reshape(X_test.shape[0],  1, X_test.shape[1])

    model = Sequential([
        LSTM(64, input_shape=(1, X_train.shape[1]),
             return_sequences=True),
        Dropout(0.2),           # يطفئ 20% من النيورونات عشوائياً
        LSTM(32),               # طبقة LSTM ثانية
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1,  activation='sigmoid')  # مخرج 0 أو 1
    ])

    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    # EarlyStopping: يوقف التدريب لما الـ validation لا يتحسن
    # هذا يمنع Overfitting ويوفر الوقت
    early_stop = EarlyStopping(
        monitor='val_loss',
        patience=5,
        restore_best_weights=True
    )

    model.fit(
        X_train_3d, y_train,
        epochs=50,
        batch_size=32,
        validation_split=0.1,
        callbacks=[early_stop],
        verbose=0
    )

    return model, X_test_3d


def evaluate_model(name, model, X_test, y_test, is_lstm=False):
    """
    يقيّم النموذج ويطبع النتائج بشكل واضح.

    المقاييس المستخدمة (من Warif scope):
        Accuracy : نسبة التوقعات الصحيحة الكلية
        Precision: من كل مرة قال "يحتاج ري"، كم مرة كان صح؟
        Recall   : من كل مرة كان يحتاج ري فعلاً، كم مرة اكتشفناه؟
        F1       : التوازن بين Precision و Recall
    """
    if is_lstm:
        X_input = X_test.reshape(X_test.shape[0], 1, X_test.shape[1]) \
                  if len(X_test.shape) == 2 else X_test
        y_pred = (model.predict(X_input, verbose=0) > 0.5).astype(int).flatten()
    else:
        y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)

    print(f"\n   --- {name} ---")
    print(f"   Accuracy : {acc:.4f}  ({acc*100:.1f}%)")
    print(classification_report(
        y_test, y_pred,
        target_names=['لا ري', 'يحتاج ري'],
        digits=3
    ))

    return acc, y_pred


def save_models(rf, xgb, lstm_model, scaler, base_dir):
    """
    يحفظ كل نموذج كملف منفصل.

    ليش نحفظها؟
        حتى لا نعيد التدريب في كل مرة.
        النموذج المحفوظ يُحمَّل مباشرة عند الاستخدام.
        عند إعادة التدريب (Continual Learning) نحفظ نسخة جديدة
        ونحتفظ بالقديمة كـ backup -- هذا هو model versioning.
    """
    models_dir = os.path.join(base_dir, "saved_models")
    os.makedirs(models_dir, exist_ok=True)

    joblib.dump(rf,     os.path.join(models_dir, "rf_model.pkl"))
    joblib.dump(xgb,    os.path.join(models_dir, "xgb_model.pkl"))
    joblib.dump(scaler, os.path.join(models_dir, "scaler.pkl"))
    lstm_model.save(    os.path.join(models_dir, "lstm_model.keras"))

    print(f"\nالنماذج محفوظة في: {models_dir}")
    print("   rf_model.pkl")
    print("   xgb_model.pkl")
    print("   lstm_model.keras")
    print("   scaler.pkl")


if __name__ == "__main__":
    base_dir   = os.path.dirname(os.path.abspath(__file__))
    data_path  = os.path.join(base_dir, "warif_dataset.csv")

    print("=" * 50)
    print("Warif -- تدريب النماذج")
    print("=" * 50)

    # 1. تحميل البيانات
    X_train, X_test, y_train, y_test = load_data(data_path)

    # 2. توحيد المقياس
    X_train_sc, X_test_sc, scaler = scale_features(X_train, X_test)

    # 3. تدريب النماذج
    rf         = train_random_forest(X_train_sc, y_train)
    xgb        = train_xgboost(X_train_sc, y_train)
    lstm, X3d  = train_lstm(X_train_sc, y_train, X_test_sc, y_test)

    # 4. التقييم
    print("\n" + "=" * 50)
    print("نتائج التقييم على بيانات الاختبار")
    print("=" * 50)

    acc_rf,  _ = evaluate_model("Random Forest", rf,   X_test_sc, y_test)
    acc_xgb, _ = evaluate_model("XGBoost",       xgb,  X_test_sc, y_test)
    acc_lstm,_ = evaluate_model("LSTM",           lstm, X_test_sc, y_test,
                                is_lstm=True)

    # 5. ملخص مقارن
    print("\n" + "=" * 50)
    print("ملخص المقارنة")
    print("=" * 50)
    results = {
        "Random Forest": acc_rf,
        "XGBoost"      : acc_xgb,
        "LSTM"         : acc_lstm,
    }
    for name, acc in sorted(results.items(), key=lambda x: x[1], reverse=True):
        bar = "#" * int(acc * 30)
        print(f"   {name:15s}: {acc*100:5.1f}%  {bar}")

    best = max(results, key=results.get)
    print(f"\n   الافضل: {best} ({results[best]*100:.1f}%)")
    print("   ملاحظة: الـ Ensemble يجمع الثلاثة للحصول على قرار اقوى")

    # 6. حفظ النماذج
    save_models(rf, xgb, lstm, scaler, base_dir)

    print("\nالخطوة 2 اكتملت -- جاهز للخطوة 3 (Database + Continual Learning)")