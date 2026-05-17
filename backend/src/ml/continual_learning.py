"""
Warif ML Pipeline -- Step 3: Database and Continual Learning Engine
======================================================================
Overview:
    1. Manages a PostgreSQL database backend tracking sensor telemetry.
    2. Logs each prediction alongside the actual field/physical outcome.
    3. Monitors model inference accuracy continuously.
    4. Triggers automatic model retraining when accuracy drops below the threshold.
    5. Persists the retrained model versions systematically (e.g., v1.0, v2.0).

Core Design Philosophy:
    Accumulating physical field data enables active closed-loop validation,
    forming the core of the Digital Twin continual learning system.
"""

import os
import psycopg2
import psycopg2.extras
from src.core.config import settings
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

# Accuracy threshold: triggers retraining if validation accuracy falls below this value
ACCURACY_THRESHOLD = 0.85

# Minimum count of new labeled field records required to initiate retraining
MIN_NEW_RECORDS = 1


# ══════════════════════════════════════════════════════════════
# DATABASE OPERATIONS
# ══════════════════════════════════════════════════════════════

class WarifDatabase:
    """
    Manages the Warif PostgreSQL storage engine for ML telemetry.

    Schema Components:
        ml_sensor_readings: Historical telemetry logged from active IoT sensors.
        ml_predictions: Logs ML inference outputs correlated with physical outcomes.
        ml_model_versions: Archives training metadata, accuracy scores, and weights.
    """

    def __init__(self, db_path: str = None):
        self._create_tables()
        print("[DB] PostgreSQL schemas validated and ready.")

    def _get_conn(self):
        return psycopg2.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            dbname=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )

    def _create_tables(self):
        """Initializes necessary PostgreSQL tables if not present"""
        conn = self._get_conn()
        c = conn.cursor()

        # Telemetry storage schema
        c.execute("""
            CREATE TABLE IF NOT EXISTS ml_sensor_readings (
                id                   SERIAL PRIMARY KEY,
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
                irrigation_needed    INTEGER,   -- Actual ground truth label (0 or 1)
                source               TEXT DEFAULT 'synthetic'
                -- 'real' for verified telemetry, 'synthetic' for simulated data
            )
        """)

        # Predictions logging schema
        # Correlating predictions and outcomes allows accuracy calculation over time
        c.execute("""
            CREATE TABLE IF NOT EXISTS ml_predictions (
                id               SERIAL PRIMARY KEY,
                timestamp        TEXT NOT NULL,
                reading_id       INTEGER,
                model_version    TEXT,
                rf_prediction    INTEGER,
                xgb_prediction   INTEGER,
                lstm_prediction  INTEGER,
                ensemble_pred    INTEGER,   -- Final prediction from Ensemble
                actual_outcome   INTEGER,   -- Ground truth label observed post-action
                is_correct       INTEGER,   -- Boolean flag: 1 = correct, 0 = incorrect
                FOREIGN KEY (reading_id) REFERENCES ml_sensor_readings(id)
            )
        """)

        # Model versions tracking schema
        # Persists performance metrics across retrained instances
        c.execute("""
            CREATE TABLE IF NOT EXISTS ml_model_versions (
                id               SERIAL PRIMARY KEY,
                version          TEXT NOT NULL,
                trained_at       TEXT NOT NULL,
                n_training_rows  INTEGER,
                rf_accuracy      REAL,
                xgb_accuracy     REAL,
                lstm_accuracy    REAL,
                ensemble_accuracy REAL,
                data_source      TEXT,   -- Indicates dataset origin: 'synthetic', 'mixed', or 'real'
                notes            TEXT
            )
        """)

        conn.commit()
        conn.close()

    def save_reading(self, reading: dict) -> int:
        """Persists a new sensor telemetry reading and returns the primary key ID"""
        conn = self._get_conn()
        c = conn.cursor()

        c.execute("""
            INSERT INTO ml_sensor_readings
            (timestamp, farm_id, soil_moisture, soil_temp, soil_ph,
             soil_ec, air_temp, humidity, co2_ppm, vpd_kpa,
             growth_stage_encoded, days_since_transplant,
             irrigation_needed, source)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
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

        reading_id = c.fetchone()[0]
        conn.commit()
        conn.close()
        return reading_id

    def save_prediction(self, prediction: dict):
        """Persists model prediction details for analytical tracking"""
        conn = self._get_conn()
        c = conn.cursor()

        c.execute("""
            INSERT INTO ml_predictions
            (timestamp, reading_id, model_version,
             rf_prediction, xgb_prediction, lstm_prediction,
             ensemble_pred, actual_outcome, is_correct)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
        """Logs retrained model metadata to version history"""
        conn = self._get_conn()
        c = conn.cursor()

        c.execute("""
            INSERT INTO ml_model_versions
            (version, trained_at, n_training_rows,
             rf_accuracy, xgb_accuracy, lstm_accuracy,
             ensemble_accuracy, data_source, notes)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
        Computes model accuracy over the last N logged predictions.

        Critical functionality:
            Serves as the feedback trigger. Performance degradation signals concept drift
            or shifts in microclimate conditions, triggering automated retraining.
        """
        conn = self._get_conn()
        c = conn.cursor()

        c.execute("""
            SELECT is_correct FROM ml_predictions
            WHERE actual_outcome IS NOT NULL
            ORDER BY id DESC
            LIMIT %s
        """, (last_n,))

        rows = c.fetchall()
        conn.close()

        if not rows:
            return 1.0   # Insufficient historical data to evaluate

        correct = sum(r[0] for r in rows if r[0] is not None)
        return correct / len(rows)

    def get_unlabeled_count(self) -> int:
        """Returns count of new unlabeled real-world samples collected"""
        conn = self._get_conn()
        c = conn.cursor()
        c.execute("""
            SELECT COUNT(*) FROM ml_sensor_readings
            WHERE irrigation_needed IS NOT NULL
              AND source = 'real'
        """)
        count = c.fetchone()[0]
        conn.close()
        return count

    def get_all_labeled_data(self) -> pd.DataFrame:
        """Retrieves all labeled records available for supervised training"""
        conn = self._get_conn()
        df = pd.read_sql("""
            SELECT soil_moisture, soil_temp, soil_ph, soil_ec,
                   air_temp, humidity, co2_ppm, vpd_kpa,
                   growth_stage_encoded, days_since_transplant,
                   irrigation_needed
            FROM ml_sensor_readings
            WHERE irrigation_needed IS NOT NULL
        """, conn)
        conn.close()
        return df

    def get_stats(self) -> dict:
        """Returns operational database statistics and metadata"""
        conn = self._get_conn()
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM ml_sensor_readings")
        n_readings = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM ml_predictions")
        n_predictions = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM ml_model_versions")
        n_versions = c.fetchone()[0]

        c.execute("""
            SELECT version, ensemble_accuracy, trained_at
            FROM ml_model_versions ORDER BY id DESC LIMIT 1
        """)
        latest = c.fetchone()

        conn.close()

        return {
            'n_readings'  : n_readings,
            'n_predictions': n_predictions,
            'n_versions'  : n_versions,
            'latest_version': latest[0] if latest else 'None',
            'latest_acc'  : latest[1] if latest else 0,
        }


# ══════════════════════════════════════════════════════════════
# ENSEMBLE DECISION ORCHESTRATION
# ══════════════════════════════════════════════════════════════

class WarifEnsemble:
    """
    Loads persisted base estimators and aggregates predictions using weighted soft voting.

    Default Ensemble Configuration:
        Random Forest: Weight = 0.35
        XGBoost:       Weight = 0.40 (High-performance gradient boosting)
        LSTM:          Weight = 0.25 (Temporal sequence modeling)

    The weights are dynamically updated post-retraining based on individual test set accuracy.
    """

    def __init__(self, models_dir: str):
        self.models_dir  = models_dir
        self.version     = "v1.0"
        self.weights     = {'rf': 0.35, 'xgb': 0.40, 'lstm': 0.25}
        self._load_models()

    def _load_models(self):
        """Loads trained model artifacts from the designated directory"""
        try:
            self.rf     = joblib.load(
                os.path.join(self.models_dir, "rf_model.pkl"))
            self.xgb    = joblib.load(
                os.path.join(self.models_dir, "xgb_model.pkl"))
            self.scaler = joblib.load(
                os.path.join(self.models_dir, "scaler.pkl"))

            # Optional LSTM loader fallback (depends on Tensorflow installation/availability)
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

            print(f"[ML] Estimators loaded successfully. Active Ensemble Version: {self.version}")

        except FileNotFoundError as e:
            raise FileNotFoundError(
                f"Persisted model files not found. Execute train_models.py first.\n{e}"
            )

    def predict(self, features: dict) -> dict:
        """
        Infers irrigation decisions based on incoming microclimate feature dict.

        Args:
            features: Dictionary containing sensor telemetry.

        Returns:
            Dictionary containing individual predictions, overall vote, and confidence metrics.
        """
        # Convert reading to numpy array
        X = np.array([[features[col] for col in FEATURE_COLS]])
        X_sc = self.scaler.transform(X)

        # Generate model predictions
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
            'decision'     : 'irrigation_required' if ensemble_pred == 1 else 'no_irrigation_required'
        }

    def update_weights(self, rf_acc, xgb_acc, lstm_acc):
        """
        Dynamically adjusts voting weights based on validation accuracy metrics.

        Models with superior validation accuracy receive proportionally higher weights.
        """
        total = rf_acc + xgb_acc + lstm_acc
        if total > 0:
            self.weights = {
                'rf'  : round(rf_acc   / total, 3),
                'xgb' : round(xgb_acc  / total, 3),
                'lstm': round(lstm_acc / total, 3),
            }
            print(f"   Dynamic weights updated: RF={self.weights['rf']} "
                  f"XGB={self.weights['xgb']} "
                  f"LSTM={self.weights['lstm']}")


# ══════════════════════════════════════════════════════════════
# CONTINUAL LEARNING PIPELINE
# ══════════════════════════════════════════════════════════════

class ContinualLearner:
    """
    Monitors model performance metrics and triggers retraining pipelines when necessary.

    Lifecycle:
        1. Parse new microclimate sensor readings.
        2. Execute real-time inference using the active Ensemble.
        3. Save telemetry and prediction records to PostgreSQL.
        4. Log physical ground truth outcomes post-action.
        5. Monitor accuracy over a sliding window (default: last 100 predictions).
        6. Trigger retraining if accuracy drops below threshold or new data criteria are met.
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
        Processes an incoming telemetry point:
        1. Saves readings to the PostgreSQL database.
        2. Invokes real-time prediction using the Ensemble.
        3. Stores the prediction record for active tracking.

        Returns:
            Dictionary containing prediction details and final irrigation decision.
        """
        # Persist telemetry point
        reading_id = self.db.save_reading(reading)

        # Invoke inference
        result = self.ensemble.predict(reading)

        # Persist prediction
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

        # ----- Digital Twin Continual Learning Loop -----
        # Trigger retraining validation when actual outcome is logged
        if actual is not None:
            import threading
            threading.Thread(target=self.check_and_retrain, daemon=True).start()

        return result

    def check_and_retrain(self) -> bool:
        """
        Validates retraining conditions.

        Triggers retraining if:
            1. Accuracy on the sliding window (last 100 predictions) falls below ACCURACY_THRESHOLD.
            2. Minimum new labeled real-world samples criteria are satisfied.

        Returns:
            Boolean indicating whether retraining occurred.
        """
        if not self._retrain_lock.acquire(blocking=False):
            print("   Retraining already in progress. Execution request skipped.")
            return False

        try:
            recent_acc   = self.db.get_recent_accuracy(last_n=100)
            new_records  = self.db.get_unlabeled_count()

            print(f"\nPerformance Monitor:")
            print(f"   Accuracy over last 100 predictions: {recent_acc*100:.1f}%")
            print(f"   New labeled field records: {new_records}")

            should_retrain = (
                recent_acc < ACCURACY_THRESHOLD or
                new_records >= MIN_NEW_RECORDS
            )

            if should_retrain:
                print("\n[Digital Twin Engine] Initiating continuous ML model retraining on updated dataset...")
                self._retrain()
                return True
            else:
                print("   Performance metrics stable. Retraining skipped.")
                return False
        finally:
            self._retrain_lock.release()

    def _retrain(self):
        """
        Executes retraining of estimators using a combined dataset:
            - Historical synthetic baseline data.
            - Newly-accumulated verified field telemetry.

        Implements progressive continual learning by warm-starting estimators
        and avoiding cold-start parameter initialization.
        """
        from sklearn.ensemble import RandomForestClassifier
        from xgboost import XGBClassifier

        # 1. Retrieve full combined training dataset
        df_original = pd.read_csv(self.dataset_path)
        df_real     = self.db.get_all_labeled_data()

        if len(df_real) > 0:
            # Merge datasets: real-world data is given higher weight
            # Duplicated to increase impact during gradient steps
            df_combined = pd.concat(
                [df_original, df_real, df_real],
                ignore_index=True
            )
            data_source = 'mixed'
            print(f"   Aggregated Dataset: {len(df_original)} synthetic "
                  f"+ {len(df_real)} real (oversampled x2)")
        else:
            df_combined = df_original
            data_source = 'synthetic'
            print(f"   Aggregated Dataset: {len(df_original)} synthetic baseline samples only")

        X = df_combined[FEATURE_COLS].values
        y = df_combined['irrigation_needed'].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # 2. Recompute scaling transformations
        scaler = StandardScaler()
        X_train_sc = scaler.fit_transform(X_train)
        X_test_sc  = scaler.transform(X_test)

        # 3. Retrain Random Forest and XGBoost estimators
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

        # LSTM Warm Start (continues training on existing weights)
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
            # Increment training epochs on existing weights
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

        # 4. Increment versioning schema
        self.version_num += 1
        new_version = f"v{self.version_num}.0"

        # 5. Persist updated base estimators
        models_dir = os.path.join(self.base_dir, "saved_models")

        # Archive old estimators as backup copies
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

        # 6. Update references in the active Ensemble
        self.ensemble.rf     = rf
        self.ensemble.xgb    = xgb
        self.ensemble.scaler = scaler
        self.ensemble.version = new_version
        self.ensemble.update_weights(rf_acc, xgb_acc,
                                     lstm_acc if lstm_acc > 0 else rf_acc)

        # 7. Log new estimator version into PostgreSQL history
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

        print(f"\n   Model Retraining Complete -- Version: {new_version}")
        print(f"   Random Forest Accuracy: {rf_acc*100:.1f}%  "
              f"XGBoost Accuracy: {xgb_acc*100:.1f}%  "
              f"Ensemble Accuracy: {ensemble_acc*100:.1f}%")
        print(f"   Legacy estimators backed up successfully.")


# ══════════════════════════════════════════════════════════════════════════════
# FEEDBACK SYSTEM INTEGRATION & CLOSED-LOOP VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

class FeedbackMonitor:
    """
    Integrates user feedback into the active continual learning loop.

    Applies the Digital Twin concept:
    - Tracks real-world deployment accuracy from explicit user actions.
    - Automates data labeling from feedback loops.
    - Promotes progressive model optimization.
    """

    def __init__(self, db: WarifDatabase, ensemble: WarifEnsemble, learner: ContinualLearner):
        self.db = db
        self.ensemble = ensemble
        self.learner = learner
        self.feedback_history = {}

    def record_user_feedback(self, recommendation_id: int, farm_id: int, is_helpful: bool):
        """
        Records user utility evaluation for a given system recommendation.
        """
        key = f"farm_{farm_id}_rec_{recommendation_id}"
        self.feedback_history[key] = {
            'is_helpful': is_helpful,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'farm_id': farm_id,
            'recommendation_id': recommendation_id
        }
        status = 'Helpful' if is_helpful else 'Unhelpful'
        print(f"   [Feedback] Recommendation {recommendation_id} rated as: {status}")

    def calculate_accuracy(self, farm_id: int = None) -> dict:
        """
        Calculates recommendation accuracy derived from user feedback logs.
        """
        relevant = [fb for key, fb in self.feedback_history.items()
                   if farm_id is None or fb['farm_id'] == farm_id]

        if not relevant:
            return {'total': 0, 'helpful': 0, 'accuracy': 0}

        total = len(relevant)
        helpful = sum(1 for fb in relevant if fb['is_helpful'])
        accuracy = (helpful / total * 100) if total > 0 else 0

        return {
            'total_feedback': total,
            'helpful_count': helpful,
            'accuracy_percentage': round(accuracy, 2),
            'last_updated': datetime.now(timezone.utc).isoformat()
        }

    def check_quality(self, threshold: float = 85.0) -> bool:
        """
        Validates whether overall recommendation accuracy satisfies the operational threshold.
        """
        stats = self.calculate_accuracy()
        accuracy = stats.get('accuracy_percentage', 100)

        if accuracy < threshold and stats['total_feedback'] > 0:
            print(f"\n[WARNING] Recommendation accuracy dropped to {accuracy:.1f}% (operational threshold: {threshold}%)")
            return False

        print(f"[STATUS] Recommendation quality within bounds: {accuracy:.1f}%")
        return True


# ══════════════════════════════════════════════════════════════
# PIPELINE DEMO & SYSTEM SIMULATION
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":

    base_dir     = os.path.dirname(os.path.abspath(__file__))
    models_dir   = os.path.join(base_dir, "saved_models")
    dataset_path = os.path.join(base_dir, "warif_dataset.csv")
    db_path      = os.path.join(base_dir, "warif_farm.db")

    print("=" * 55)
    print("Warif ML Pipeline: Closed-Loop Continual Learning Engine")
    print("=" * 55)

    # 1. Initialize DB storage and ensemble estimators
    db       = WarifDatabase(db_path)
    ensemble = WarifEnsemble(models_dir)
    learner  = ContinualLearner(db, ensemble, base_dir, dataset_path)

    # 2. Telemetry Feed Simulation (5 Samples)
    print("\n--- Telemetry Feed Simulation (5 Samples) ---")

    sample_readings = [
        {   # Sample 1: Low soil moisture, high temperature (irrigation required)
            'soil_moisture': 45.0, 'soil_temp': 26.0, 'soil_ph': 6.4,
            'soil_ec': 1.8, 'air_temp': 34.0, 'humidity': 65.0,
            'co2_ppm': 650.0, 'vpd_kpa': 1.3,
            'growth_stage_encoded': 3, 'days_since_transplant': 38,
            'irrigation_needed': 1, 'source': 'synthetic',
        },
        {   # Sample 2: Optimal soil moisture (no irrigation required)
            'soil_moisture': 72.0, 'soil_temp': 24.5, 'soil_ph': 6.4,
            'soil_ec': 1.8, 'air_temp': 26.3, 'humidity': 78.0,
            'co2_ppm': 650.0, 'vpd_kpa': 1.1,
            'growth_stage_encoded': 3, 'days_since_transplant': 38,
            'irrigation_needed': 0, 'source': 'synthetic',
        },
        {   # Sample 3: High relative humidity (no irrigation required)
            'soil_moisture': 68.0, 'soil_temp': 23.0, 'soil_ph': 6.5,
            'soil_ec': 2.0, 'air_temp': 24.0, 'humidity': 93.0,
            'co2_ppm': 700.0, 'vpd_kpa': 0.6,
            'growth_stage_encoded': 2, 'days_since_transplant': 25,
            'irrigation_needed': 0, 'source': 'synthetic',
        },
        {   # Sample 4: Flowering phase with low soil moisture (critical irrigation required)
            'soil_moisture': 58.0, 'soil_temp': 25.0, 'soil_ph': 6.3,
            'soil_ec': 1.6, 'air_temp': 27.0, 'humidity': 74.0,
            'co2_ppm': 800.0, 'vpd_kpa': 1.0,
            'growth_stage_encoded': 2, 'days_since_transplant': 22,
            'irrigation_needed': 1, 'source': 'synthetic',
        },
        {   # Sample 5: High Soil EC (delay irrigation)
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

        print(f"\n   Reading {i}:")
        print(f"      soil_moisture={reading['soil_moisture']}%  "
              f"air_temp={reading['air_temp']}C  "
              f"humidity={reading['humidity']}%")
        print(f"      Ensemble Decision: {result['decision']}  "
              f"(Confidence Score: {result['confidence']})")
        print(f"      Ground Truth Outcome: {'irrigation_required' if actual == 1 else 'no_irrigation_required'}  "
              f"-- Result: {'CORRECT' if match else 'INCORRECT'}")

    print(f"\n   Inference Accuracy on sample batch: {correct}/5 ({correct/5*100:.0f}%)")

    # 3. Evaluate Retraining Trigger
    print("\n" + "-" * 55)
    learner.check_and_retrain()

    # 4. Log Operational Database Metrics
    print("\n" + "-" * 55)
    stats = db.get_stats()
    print("Database Operational Status Summary:")
    print(f"   Saved telemetry reading records: {stats['n_readings']}")
    print(f"   Logged prediction records      : {stats['n_predictions']}")
    print(f"   Trained estimator versions     : {stats['n_versions']}")
    print(f"   Active estimator version       : {stats['latest_version']}")

    print("\n" + "=" * 55)
    print("Step 3 Complete -- Pipeline Ready for Deployment")
    print("When transitioning to production IoT devices:")
    print("   Change source='synthetic' to source='real'")
    print("   The closed-loop learning engine will execute automatically.")
    print("=" * 55)