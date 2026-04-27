"""
Warif ML Pipeline -- الخطوة 3: قاعدة البيانات والـ Continual Learning
======================================================================
ما الذي يحدث هنا؟
    1. نبني قاعدة بيانات SQLite تحفظ كل قراءة sensor
    2. نحفظ كل تنبؤ مع النتيجة الفعلية
    3. نراقب دقة النماذج باستمرار
    4. لما الدقة تنخفض عن حد معين -- نعيد التدريب تلقائياً
    5. نحفظ النموذج الجديد مع رقم إصدار (v1, v2, v3...)

ليش SQLite؟
    خفيفة، لا تحتاج server منفصل، تعمل مباشرة كملف .db
    مناسبة للـ prototype -- لما يكبر النظام نهاجر لـ PostgreSQL أو TimescaleDB

هذا هو قلب مبدأ Continual Learning في Warif:
    بيانات حقيقية تتراكم --> دقة النموذج تُقاس --> إعادة تدريب عند الحاجة
"""

import os
import sqlite3
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

import warnings
warnings.filterwarnings("ignore")


FEATURE_COLS = [
    'soil_moisture', 'soil_temp', 'soil_ph', 'soil_ec',
    'air_temp', 'humidity', 'co2_ppm', 'vpd_kpa',
    'growth_stage_encoded', 'days_since_transplant',
]

# الحد الأدنى للدقة -- لما تنخفض عنه نعيد التدريب
ACCURACY_THRESHOLD = 0.85

# الحد الأدنى لعدد السجلات الجديدة قبل إعادة التدريب
MIN_NEW_RECORDS = 1


# ══════════════════════════════════════════════════════════════
# قاعدة البيانات
# ══════════════════════════════════════════════════════════════

class WarifDatabase:
    """
    يدير قاعدة بيانات Warif.

    الجداول:
        sensor_readings  : كل قراءة واردة من الـ sensors
        predictions      : كل تنبؤ أجراه النموذج + النتيجة الفعلية
        model_versions   : سجل كل إصدار نموذج مع دقته
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._create_tables()
        print(f"قاعدة البيانات جاهزة: {db_path}")

    def _create_tables(self):
        """ينشئ الجداول إذا لم تكن موجودة"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # جدول قراءات الـ sensors
        c.execute("""
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp            TEXT NOT NULL,
                farm_id              TEXT DEFAULT 'greenhouse-01',
                soil_moisture        REAL,
                soil_temp            REAL,
                soil_ph              REAL,
                soil_ec              REAL,
                air_temp             REAL,
                humidity             REAL,
                co2_ppm              REAL,
                vpd_kpa              REAL,
                growth_stage_encoded INTEGER,
                days_since_transplant INTEGER,
                irrigation_needed    INTEGER,   -- القرار الفعلي (0 أو 1)
                source               TEXT DEFAULT 'synthetic'
                -- لما تتوفر sensors حقيقية: source = 'real'
            )
        """)

        # جدول التنبؤات
        # نحفظ هنا ما توقعه النموذج وما حدث فعلاً
        # هذا يسمح لنا بقياس الدقة مع مرور الوقت
        c.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp        TEXT NOT NULL,
                reading_id       INTEGER,
                model_version    TEXT,
                rf_prediction    INTEGER,
                xgb_prediction   INTEGER,
                lstm_prediction  INTEGER,
                ensemble_pred    INTEGER,   -- القرار النهائي للـ Ensemble
                actual_outcome   INTEGER,   -- ما حدث فعلاً (يُحدَّث لاحقاً)
                is_correct       INTEGER,   -- 1 = صح، 0 = خطأ
                FOREIGN KEY (reading_id) REFERENCES sensor_readings(id)
            )
        """)

        # جدول إصدارات النماذج
        # كل مرة نعيد التدريب نسجل هنا الدقة الجديدة
        c.execute("""
            CREATE TABLE IF NOT EXISTS model_versions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                version          TEXT NOT NULL,
                trained_at       TEXT NOT NULL,
                n_training_rows  INTEGER,
                rf_accuracy      REAL,
                xgb_accuracy     REAL,
                lstm_accuracy    REAL,
                ensemble_accuracy REAL,
                data_source      TEXT,   -- 'synthetic' أو 'mixed' أو 'real'
                notes            TEXT
            )
        """)

        conn.commit()
        conn.close()

    def save_reading(self, reading: dict) -> int:
        """يحفظ قراءة sensor جديدة ويعيد الـ ID"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute("""
            INSERT INTO sensor_readings
            (timestamp, farm_id, soil_moisture, soil_temp, soil_ph,
             soil_ec, air_temp, humidity, co2_ppm, vpd_kpa,
             growth_stage_encoded, days_since_transplant,
             irrigation_needed, source)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            reading.get('timestamp', datetime.now().isoformat()),
            reading.get('farm_id', 'greenhouse-01'),
            reading['soil_moisture'],
            reading['soil_temp'],
            reading['soil_ph'],
            reading['soil_ec'],
            reading['air_temp'],
            reading['humidity'],
            reading['co2_ppm'],
            reading['vpd_kpa'],
            reading['growth_stage_encoded'],
            reading['days_since_transplant'],
            reading.get('irrigation_needed', None),
            reading.get('source', 'synthetic')
        ))

        reading_id = c.lastrowid
        conn.commit()
        conn.close()
        return reading_id

    def save_prediction(self, prediction: dict):
        """يحفظ تنبؤ النموذج"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute("""
            INSERT INTO predictions
            (timestamp, reading_id, model_version,
             rf_prediction, xgb_prediction, lstm_prediction,
             ensemble_pred, actual_outcome, is_correct)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            datetime.now().isoformat(),
            prediction.get('reading_id'),
            prediction.get('model_version', 'v1.0'),
            prediction.get('rf_pred'),
            prediction.get('xgb_pred'),
            prediction.get('lstm_pred'),
            prediction.get('ensemble_pred'),
            prediction.get('actual_outcome'),
            prediction.get('is_correct')
        ))

        conn.commit()
        conn.close()

    def save_model_version(self, version_info: dict):
        """يسجل إصدار نموذج جديد بعد إعادة التدريب"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute("""
            INSERT INTO model_versions
            (version, trained_at, n_training_rows,
             rf_accuracy, xgb_accuracy, lstm_accuracy,
             ensemble_accuracy, data_source, notes)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            version_info['version'],
            datetime.now().isoformat(),
            version_info.get('n_rows', 0),
            version_info.get('rf_acc', 0),
            version_info.get('xgb_acc', 0),
            version_info.get('lstm_acc', 0),
            version_info.get('ensemble_acc', 0),
            version_info.get('data_source', 'synthetic'),
            version_info.get('notes', '')
        ))

        conn.commit()
        conn.close()

    def get_recent_accuracy(self, last_n: int = 100) -> float:
        """
        يحسب دقة النموذج على آخر N تنبؤ.

        ليش هذا مهم؟
            لو الدقة بدأت تنخفض = النموذج لم يعد يناسب البيانات الجديدة
            هذا هو إشارة إعادة التدريب في Continual Learning
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute("""
            SELECT is_correct FROM predictions
            WHERE actual_outcome IS NOT NULL
            ORDER BY id DESC
            LIMIT ?
        """, (last_n,))

        rows = c.fetchall()
        conn.close()

        if not rows:
            return 1.0   # لا يوجد بيانات كافية بعد

        correct = sum(r[0] for r in rows if r[0] is not None)
        return correct / len(rows)

    def get_unlabeled_count(self) -> int:
        """يعيد عدد السجلات الجديدة التي لم تُستخدم في التدريب بعد"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            SELECT COUNT(*) FROM sensor_readings
            WHERE irrigation_needed IS NOT NULL
              AND source = 'real'
        """)
        count = c.fetchone()[0]
        conn.close()
        return count

    def get_all_labeled_data(self) -> pd.DataFrame:
        """يجلب كل البيانات المعلّمة للتدريب"""
        conn = sqlite3.connect(self.db_path)
        df = pd.read_sql("""
            SELECT soil_moisture, soil_temp, soil_ph, soil_ec,
                   air_temp, humidity, co2_ppm, vpd_kpa,
                   growth_stage_encoded, days_since_transplant,
                   irrigation_needed
            FROM sensor_readings
            WHERE irrigation_needed IS NOT NULL
        """, conn)
        conn.close()
        return df

    def get_stats(self) -> dict:
        """ملخص إحصائيات قاعدة البيانات"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM sensor_readings")
        n_readings = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM predictions")
        n_predictions = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM model_versions")
        n_versions = c.fetchone()[0]

        c.execute("""
            SELECT version, ensemble_accuracy, trained_at
            FROM model_versions ORDER BY id DESC LIMIT 1
        """)
        latest = c.fetchone()

        conn.close()

        return {
            'n_readings'  : n_readings,
            'n_predictions': n_predictions,
            'n_versions'  : n_versions,
            'latest_version': latest[0] if latest else 'لا يوجد',
            'latest_acc'  : latest[1] if latest else 0,
        }


# ══════════════════════════════════════════════════════════════
# Ensemble -- يجمع قرارات الثلاثة نماذج
# ══════════════════════════════════════════════════════════════

class WarifEnsemble:
    """
    يحمّل النماذج المحفوظة ويجمع قراراتها.

    استراتيجية الـ Weighted Voting (من Warif scope):
        RF     وزن 0.35
        XGBoost وزن 0.40  (الأعلى دقة)
        LSTM   وزن 0.25

    الأوزان تتعدّل تلقائياً بعد كل إعادة تدريب
    بناءً على أداء كل نموذج على بيانات الاختبار
    """

    def __init__(self, models_dir: str):
        self.models_dir  = models_dir
        self.version     = "v1.0"
        self.weights     = {'rf': 0.35, 'xgb': 0.40, 'lstm': 0.25}
        self._load_models()

    def _load_models(self):
        """يحمّل النماذج من الملفات المحفوظة"""
        try:
            self.rf     = joblib.load(
                os.path.join(self.models_dir, "rf_model.pkl"))
            self.xgb    = joblib.load(
                os.path.join(self.models_dir, "xgb_model.pkl"))
            self.scaler = joblib.load(
                os.path.join(self.models_dir, "scaler.pkl"))

            # LSTM اختياري -- قد لا يكون موجوداً في كل بيئة
            lstm_path = os.path.join(self.models_dir, "lstm_model.keras")
            if os.path.exists(lstm_path):
                try:
                    import tensorflow as tf
                    self.lstm = tf.keras.models.load_model(lstm_path)
                    self.has_lstm = True
                    print("[ML] LSTM loaded successfully")
                except Exception as e:
                    print(f"[ML] LSTM skipped: {e}")
                    self.lstm = None
                    self.has_lstm = False
                    self.weights = {'rf': 0.45, 'xgb': 0.55, 'lstm': 0.0}
            else:
                self.lstm     = None
                self.has_lstm = False
                self.weights  = {'rf': 0.45, 'xgb': 0.55, 'lstm': 0.0}

            print(f"النماذج محملة -- الإصدار: {self.version}")

        except FileNotFoundError as e:
            raise FileNotFoundError(
                f"النماذج غير موجودة. شغّل train_models.py أولاً.\n{e}"
            )

    def predict(self, features: dict) -> dict:
        """
        يأخذ قراءة sensor واحدة ويعيد قرار الري.

        المدخل: dict فيه قيم الـ sensors
        المخرج: dict فيه تنبؤ كل نموذج + القرار النهائي
        """
        # تحويل القراءة لـ array
        X = np.array([[features[col] for col in FEATURE_COLS]])
        X_sc = self.scaler.transform(X)

        # تنبؤ كل نموذج
        rf_pred  = int(self.rf.predict(X_sc)[0])
        xgb_pred = int(self.xgb.predict(X_sc)[0])

        if self.has_lstm:
            X_3d      = X_sc.reshape(1, 1, X_sc.shape[1])
            lstm_pred = int(
                (self.lstm.predict(X_3d, verbose=0)[0][0] > 0.5)
            )
        else:
            lstm_pred = rf_pred   # fallback

        # Weighted voting
        score = (
            self.weights['rf']   * rf_pred  +
            self.weights['xgb']  * xgb_pred +
            self.weights['lstm'] * lstm_pred
        )
        ensemble_pred = 1 if score >= 0.5 else 0

        return {
            'rf_pred'      : rf_pred,
            'xgb_pred'     : xgb_pred,
            'lstm_pred'    : lstm_pred,
            'ensemble_pred': ensemble_pred,
            'confidence'   : round(score, 3),
            'model_version': self.version,
            'decision'     : 'يحتاج ري' if ensemble_pred == 1 else 'لا يحتاج ري'
        }

    def update_weights(self, rf_acc, xgb_acc, lstm_acc):
        """
        يعدّل أوزان الـ Ensemble بناءً على الدقة الجديدة.

        النموذج الأدق يحصل على وزن أكبر -- تلقائياً.
        """
        total = rf_acc + xgb_acc + lstm_acc
        if total > 0:
            self.weights = {
                'rf'  : round(rf_acc   / total, 3),
                'xgb' : round(xgb_acc  / total, 3),
                'lstm': round(lstm_acc / total, 3),
            }
            print(f"   أوزان جديدة: RF={self.weights['rf']} "
                  f"XGB={self.weights['xgb']} "
                  f"LSTM={self.weights['lstm']}")


# ══════════════════════════════════════════════════════════════
# Continual Learning -- قلب النظام
# ══════════════════════════════════════════════════════════════

class ContinualLearner:
    """
    يراقب أداء النماذج ويعيد تدريبها عند الحاجة.

    دورة العمل:
        1. قراءة sensor جديدة تصل
        2. النموذج يتنبأ
        3. نحفظ التنبؤ في قاعدة البيانات
        4. لما يتأكد القرار الفعلي (تم الري أم لا) نحدّث السجل
        5. كل فترة نحسب الدقة على آخر 100 قراءة
        6. لو الدقة انخفضت عن 85% -- نعيد التدريب
    """

    def __init__(self, db: WarifDatabase, ensemble: WarifEnsemble,
                 base_dir: str, dataset_path: str):
        self.db           = db
        self.ensemble     = ensemble
        self.base_dir     = base_dir
        self.dataset_path = dataset_path
        self.version_num  = 1
        
        import threading
        self._retrain_lock = threading.Lock()

    def process_reading(self, reading: dict) -> dict:
        """
        يعالج قراءة sensor واحدة:
        1. يحفظها في قاعدة البيانات
        2. يأخذ تنبؤ من الـ Ensemble
        3. يحفظ التنبؤ

        المخرج: القرار النهائي + تفاصيل التنبؤ
        """
        # حفظ القراءة
        reading_id = self.db.save_reading(reading)

        # أخذ التنبؤ
        result = self.ensemble.predict(reading)

        # حفظ التنبؤ
        actual = reading.get('irrigation_needed')
        is_correct = None
        if actual is not None:
            is_correct = int(result['ensemble_pred'] == actual)

        self.db.save_prediction({
            'reading_id'    : reading_id,
            'model_version' : result['model_version'],
            'rf_pred'       : result['rf_pred'],
            'xgb_pred'      : result['xgb_pred'],
            'lstm_pred'     : result['lstm_pred'],
            'ensemble_pred' : result['ensemble_pred'],
            'actual_outcome': actual,
            'is_correct'    : is_correct,
        })

        # ----- تطبيق مبدأ التوأم الرقمي للتعلم المستمر -----
        # التعلم المستمر فور توفر نتيجة فعلية من المزرعة
        if actual is not None:
            import threading
            threading.Thread(target=self.check_and_retrain, daemon=True).start()

        return result

    def check_and_retrain(self) -> bool:
        """
        يتحقق هل يجب إعادة التدريب.

        شروط إعادة التدريب (أي شرط منهم):
            1. الدقة على آخر 100 تنبؤ انخفضت عن 85%
            2. تراكم 50+ سجل حقيقي جديد لم يُستخدم في التدريب

        يعيد True لو تمت إعادة التدريب
        """
        if not self._retrain_lock.acquire(blocking=False):
            print("   إعادة التدريب قيد التنفيذ حالياً، تم تخطي الطلب.")
            return False

        try:
            recent_acc   = self.db.get_recent_accuracy(last_n=100)
            new_records  = self.db.get_unlabeled_count()

            print(f"\nمراقبة الأداء:")
            print(f"   الدقة على آخر 100 تنبؤ: {recent_acc*100:.1f}%")
            print(f"   سجلات حقيقية جديدة: {new_records}")

            should_retrain = (
                recent_acc < ACCURACY_THRESHOLD or
                new_records >= MIN_NEW_RECORDS
            )

            if should_retrain:
                print("\nتطبيق مبدأ التوأم الرقمي: بدء التدريب المستمر على البيانات الجديدة...")
                self._retrain()
                return True
            else:
                print("   الاداء مستقر -- لا حاجة لإعادة التدريب الآن")
                return False
        finally:
            self._retrain_lock.release()

    def _retrain(self):
        """
        يعيد تدريب النماذج على البيانات المدمجة:
            - البيانات الأصلية (Synthetic)
            - البيانات الحقيقية الجديدة من المزرعة

        هذا هو Continual Learning -- نبني على ما تعلمناه سابقاً
        بدل ما نبدأ من صفر
        """
        from sklearn.ensemble import RandomForestClassifier
        from xgboost import XGBClassifier

        # 1. تحميل بيانات التدريب الكاملة (synthetic + real)
        df_original = pd.read_csv(self.dataset_path)
        df_real     = self.db.get_all_labeled_data()

        if len(df_real) > 0:
            # دمج البيانات -- Real Data تأخذ أولوية أعلى
            # نكررها مرتين لزيادة وزنها في التدريب
            df_combined = pd.concat(
                [df_original, df_real, df_real],
                ignore_index=True
            )
            data_source = 'mixed'
            print(f"   بيانات مدمجة: {len(df_original)} synthetic "
                  f"+ {len(df_real)} real (x2)")
        else:
            df_combined = df_original
            data_source = 'synthetic'
            print(f"   بيانات: {len(df_original)} synthetic فقط")

        X = df_combined[FEATURE_COLS].values
        y = df_combined['irrigation_needed'].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 2. إعادة حساب الـ scaler
        scaler = StandardScaler()
        X_train_sc = scaler.fit_transform(X_train)
        X_test_sc  = scaler.transform(X_test)

        # 3. إعادة تدريب RF و XGBoost
        rf = RandomForestClassifier(
            n_estimators=200, max_depth=15,
            min_samples_split=5, random_state=42, n_jobs=-1
        )
        rf.fit(X_train_sc, y_train)
        rf_acc = accuracy_score(y_test, rf.predict(X_test_sc))

        xgb = XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, eval_metric='logloss', verbosity=0
        )
        xgb.fit(X_train_sc, y_train)
        xgb_acc = accuracy_score(y_test, xgb.predict(X_test_sc))

        # LSTM -- Warm Start (يكمل من الأوزان السابقة)
        lstm_acc = 0.0
        if self.ensemble.has_lstm:
            X_train_3d = X_train_sc.reshape(
                X_train_sc.shape[0], 1, X_train_sc.shape[1])
            X_test_3d  = X_test_sc.reshape(
                X_test_sc.shape[0],  1, X_test_sc.shape[1])

            from tensorflow.keras.callbacks import EarlyStopping
            early_stop = EarlyStopping(
                monitor='val_loss', patience=3,
                restore_best_weights=True
            )
            # يكمل التدريب من الأوزان الحالية (Warm Start)
            self.ensemble.lstm.fit(
                X_train_3d, y_train,
                epochs=20, batch_size=32,
                validation_split=0.1,
                callbacks=[early_stop], verbose=0
            )
            lstm_pred = (
                self.ensemble.lstm.predict(X_test_3d, verbose=0) > 0.5
            ).astype(int).flatten()
            lstm_acc = accuracy_score(y_test, lstm_pred)

        # 4. تحديث الإصدار
        self.version_num += 1
        new_version = f"v{self.version_num}.0"

        # 5. حفظ النماذج الجديدة
        models_dir = os.path.join(self.base_dir, "saved_models")

        # احتفظ بالإصدار القديم كـ backup
        old_version = f"v{self.version_num - 1}.0"
        for fname in ['rf_model.pkl', 'xgb_model.pkl', 'scaler.pkl']:
            old_path = os.path.join(models_dir, fname)
            bak_path = os.path.join(
                models_dir, fname.replace('.', f'_{old_version}.')
            )
            if os.path.exists(old_path):
                import shutil
                shutil.copy(old_path, bak_path)

        joblib.dump(rf,     os.path.join(models_dir, "rf_model.pkl"))
        joblib.dump(xgb,    os.path.join(models_dir, "xgb_model.pkl"))
        joblib.dump(scaler, os.path.join(models_dir, "scaler.pkl"))

        if self.ensemble.has_lstm:
            self.ensemble.lstm.save(
                os.path.join(models_dir, "lstm_model.keras")
            )

        # 6. تحديث الـ Ensemble
        self.ensemble.rf     = rf
        self.ensemble.xgb    = xgb
        self.ensemble.scaler = scaler
        self.ensemble.version = new_version
        self.ensemble.update_weights(rf_acc, xgb_acc,
                                     lstm_acc if lstm_acc > 0 else rf_acc)

        # 7. تسجيل الإصدار الجديد في قاعدة البيانات
        ensemble_acc = accuracy_score(
            y_test,
            [self.ensemble.predict(
                dict(zip(FEATURE_COLS, X_test_sc[i]))
            )['ensemble_pred'] for i in range(min(100, len(X_test_sc)))]
        )

        self.db.save_model_version({
            'version'      : new_version,
            'n_rows'       : len(df_combined),
            'rf_acc'       : rf_acc,
            'xgb_acc'      : xgb_acc,
            'lstm_acc'     : lstm_acc,
            'ensemble_acc' : ensemble_acc,
            'data_source'  : data_source,
            'notes'        : f'Continual learning retrain -- '
                             f'{len(df_real)} real records added',
        })

        print(f"\n   اكتملت إعادة التدريب -- الإصدار الجديد: {new_version}")
        print(f"   RF: {rf_acc*100:.1f}%  "
              f"XGB: {xgb_acc*100:.1f}%  "
              f"Ensemble: {ensemble_acc*100:.1f}%")
        print(f"   النموذج القديم محفوظ كـ backup")


# ══════════════════════════════════════════════════════════════
# تشغيل تجريبي -- يحاكي وصول بيانات من المزرعة
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":

    base_dir     = os.path.dirname(os.path.abspath(__file__))
    models_dir   = os.path.join(base_dir, "saved_models")
    dataset_path = os.path.join(base_dir, "warif_dataset.csv")
    db_path      = os.path.join(base_dir, "warif_farm.db")

    print("=" * 55)
    print("Warif -- قاعدة البيانات والـ Continual Learning")
    print("=" * 55)

    # 1. تهيئة قاعدة البيانات والنماذج
    db       = WarifDatabase(db_path)
    ensemble = WarifEnsemble(models_dir)
    learner  = ContinualLearner(db, ensemble, base_dir, dataset_path)

    # 2. محاكاة وصول قراءات من المزرعة
    print("\n--- محاكاة وصول 5 قراءات من الـ sensors ---")

    sample_readings = [
        {   # قراءة 1: رطوبة منخفضة + حرارة عالية = يحتاج ري
            'soil_moisture': 45.0, 'soil_temp': 26.0, 'soil_ph': 6.4,
            'soil_ec': 1.8, 'air_temp': 34.0, 'humidity': 65.0,
            'co2_ppm': 650.0, 'vpd_kpa': 1.3,
            'growth_stage_encoded': 3, 'days_since_transplant': 38,
            'irrigation_needed': 1, 'source': 'synthetic',
        },
        {   # قراءة 2: رطوبة مثالية = لا يحتاج ري
            'soil_moisture': 72.0, 'soil_temp': 24.5, 'soil_ph': 6.4,
            'soil_ec': 1.8, 'air_temp': 26.3, 'humidity': 78.0,
            'co2_ppm': 650.0, 'vpd_kpa': 1.1,
            'growth_stage_encoded': 3, 'days_since_transplant': 38,
            'irrigation_needed': 0, 'source': 'synthetic',
        },
        {   # قراءة 3: رطوبة هواء عالية = لا تروي
            'soil_moisture': 68.0, 'soil_temp': 23.0, 'soil_ph': 6.5,
            'soil_ec': 2.0, 'air_temp': 24.0, 'humidity': 93.0,
            'co2_ppm': 700.0, 'vpd_kpa': 0.6,
            'growth_stage_encoded': 2, 'days_since_transplant': 25,
            'irrigation_needed': 0, 'source': 'synthetic',
        },
        {   # قراءة 4: طور إزهار + رطوبة منخفضة = خطر
            'soil_moisture': 58.0, 'soil_temp': 25.0, 'soil_ph': 6.3,
            'soil_ec': 1.6, 'air_temp': 27.0, 'humidity': 74.0,
            'co2_ppm': 800.0, 'vpd_kpa': 1.0,
            'growth_stage_encoded': 2, 'days_since_transplant': 22,
            'irrigation_needed': 1, 'source': 'synthetic',
        },
        {   # قراءة 5: EC عالي = تأخير الري
            'soil_moisture': 63.0, 'soil_temp': 24.0, 'soil_ph': 6.6,
            'soil_ec': 3.8, 'air_temp': 28.0, 'humidity': 76.0,
            'co2_ppm': 750.0, 'vpd_kpa': 1.2,
            'growth_stage_encoded': 3, 'days_since_transplant': 42,
            'irrigation_needed': 0, 'source': 'synthetic',
        },
    ]

    correct = 0
    for i, reading in enumerate(sample_readings, 1):
        result = learner.process_reading(reading)
        actual = reading['irrigation_needed']
        match  = result['ensemble_pred'] == actual
        if match:
            correct += 1

        print(f"\n   القراءة {i}:")
        print(f"      soil_moisture={reading['soil_moisture']}%  "
              f"air_temp={reading['air_temp']}C  "
              f"humidity={reading['humidity']}%")
        print(f"      القرار: {result['decision']}  "
              f"(ثقة: {result['confidence']})")
        print(f"      الفعلي: {'يحتاج ري' if actual == 1 else 'لا يحتاج'}  "
              f"-- {'صح' if match else 'خطا'}")

    print(f"\n   دقة على هذه القراءات: {correct}/5 "
          f"({correct/5*100:.0f}%)")

    # 3. فحص هل يجب إعادة التدريب
    print("\n" + "-" * 55)
    learner.check_and_retrain()

    # 4. إحصائيات قاعدة البيانات
    print("\n" + "-" * 55)
    stats = db.get_stats()
    print("احصائيات قاعدة البيانات:")
    print(f"   قراءات sensors محفوظة : {stats['n_readings']}")
    print(f"   تنبؤات محفوظة          : {stats['n_predictions']}")
    print(f"   إصدارات نماذج          : {stats['n_versions']}")
    print(f"   آخر إصدار              : {stats['latest_version']}")

    print("\n" + "=" * 55)
    print("الخطوة 3 اكتملت -- Pipeline جاهز")
    print("لما تتصل الـ sensors الحقيقية:")
    print("   غيري source='synthetic' الى source='real'")
    print("   والنظام يكمل من نفسه")
    print("=" * 55)