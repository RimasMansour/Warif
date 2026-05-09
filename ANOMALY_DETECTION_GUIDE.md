# 🔍 دليل نظام كشف الشذوذ والأعطال
**Anomaly Detection & Sensor Malfunction Alert System**

---

## **📌 نظرة عامة**

نظام شامل يكتشف أي سلوك غريب أو غير منطقي في قراءات الحساسات ويولد تنبيهات تلقائية:

```
القراءة الحديثة من الحساس
        ↓
  [AnomalyDetector]
        ├─ 1. فحص الحدود (Out of Bounds)
        ├─ 2. فحص القفزات (Rate of Change)
        ├─ 3. فحص الحساس العالق (Stuck Sensor)
        ├─ 4. فحص كسر النمط (Pattern Break)
        └─ 5. فحص تجاوز الحدود (Threshold Violation)
        ↓
    إذا شاذة؟
        ↓
  [AnomalyAlertSystem]
        ↓
   توليد Alert تلقائي
```

---

## **🔬 أنواع الشذوذ المكتشفة**

### **1️⃣ Out of Bounds (قيم غير واقعية)**

**التعريف**: قيمة خارج النطاق الفيزيائي المعقول

**الأمثلة**:
- حساس درجة حرارة يعطي `-100°C` (مستحيل فيزيائياً)
- حساس رطوبة يعطي `150%` (الحد الأقصى 100%)
- حساس إضاءة يعطي قيمة سالبة

**الحدود المعرفة**:
```python
sensor_bounds = {
    'air_temperature': (0, 60),        # 0°C إلى 60°C
    'air_humidity': (0, 100),          # 0% إلى 100%
    'soil_moisture': (0, 100),         # 0% إلى 100%
    'soil_temperature': (-5, 50),      # -5°C إلى 50°C
    'light_intensity': (0, 120000),    # 0 إلى 120000 lux
}
```

**النتيجة**: Alert بـ severity = `CRITICAL`, confidence = `99%`

---

### **2️⃣ Unrealistic Jump (قفزات غير منطقية)**

**التعريف**: تغير سريع جداً بين قراءة وأخرى

**الأمثلة**:
- حساس درجة حرارة يقفز من `25°C` إلى `40°C` في 10 ثواني
- حساس رطوبة يقفز من `30%` إلى `0%` فجأة
- حساس تربة يتغير من `40%` إلى `0%` فوراً

**الحدود المعرفة** (الحد الأقصى للتغيير في 10 ثواني):
```python
max_rate_of_change = {
    'air_temperature': 1.0,    # 1°C كحد أقصى
    'air_humidity': 5.0,       # 5% كحد أقصى
    'soil_moisture': 2.0,      # 2% كحد أقصى
    'soil_temperature': 0.5,   # 0.5°C كحد أقصى
}
```

**مثال واقعي**:
- قراءة 1: `soil_moisture = 45%`
- قراءة 2: `soil_moisture = 52%` (تغيير 7%)
- النتيجة: ⚠️ تحذير (exceeds 2%)

**النتيجة**: 
- إذا التغيير > 2× الحد = severity = `CRITICAL`
- إذا التغيير < 2× الحد = severity = `HIGH`

---

### **3️⃣ Sensor Stuck (حساس معطل - عالق)**

**التعريف**: نفس القيمة (أو قيم متشابهة جداً) لفترة طويلة

**الأمثلة**:
- حساس درجة الحرارة عالق على `25.00°C` لـ 10 قراءات متتالية
- حساس الرطوبة عالق على `65%` لساعة كاملة
- حساس التربة لم تتغير قيمته

**الآلية**:
- تتبع آخر 10 قراءات
- احسب عدد القيم الفريدة (الاختلاف أكثر من 0.01)
- إذا عدد القيم الفريدة = 1 (كلها متطابقة) → شذوذ

**النتيجة**: Alert بـ severity = `HIGH`, anomaly_type = `sensor_stuck`

---

### **4️⃣ Pattern Break (كسر النمط - انحراف إحصائي)**

**التعريف**: قيمة تنحرف بشكل كبير عن النمط المتوقع (Z-Score)

**الأمثلة**:
- المتوسط الطبيعي للحرارة = `25°C`، الانحراف المعياري = `2°C`
- قراءة جديدة = `35°C` (انحراف 5 انحرافات معيارية)
- النتيجة: شذوذ إحصائي

**الآلية**:
```
Z-Score = |القيمة الحالية - المتوسط| / الانحراف المعياري

إذا Z-Score > 3: شذوذ (قيمة 99.7% من البيانات العادية في ±3σ)
إذا Z-Score > 4: شذوذ حرج (قيمة نادرة جداً)
```

**مثال حسابي**:
- آخر 20 قراءة: `[24, 25, 26, 25, 24, 25, 26, 24, 25, 26, ...]`
- المتوسط = `25°C`
- الانحراف = `0.7°C`
- قراءة جديدة = `32°C`
- Z-Score = `(32 - 25) / 0.7 = 10` → شذوذ حرج

**النتيجة**: severity = `CRITICAL`, confidence = 99%

---

### **5️⃣ Threshold Violation (تجاوز الحدود الحرجة)**

**التعريف**: تجاوز الحد الحرج أو التحذير للمحصول

**الأمثلة**:
- درجة الحرارة < `15°C` (تحت الحد الأدنى للطماطم)
- درجة الحرارة > `38°C` (فوق الحد الأقصى)
- رطوبة التربة < `20%` (جفاف حرج)

**الحدود المثالية** (مثال للطماطم):
```python
optimal_ranges = {
    'air_temperature': (15, 38),     # 15°C إلى 38°C
    'air_humidity': (20, 95),        # 20% إلى 95%
    'soil_moisture': (20, 85),       # 20% إلى 85%
    'soil_temperature': (18, 28),    # 18°C إلى 28°C
}
```

**النتيجة**: severity = `CRITICAL` أو `HIGH` حسب التجاوز

---

## **🔄 Flow الكامل (من الحساس إلى Alert)**

```
1️⃣ SENSOR READING
   Device sends: { device_id: "sensor_temp_1", sensor_type: "air_temperature", value: 42 }

2️⃣ BACKEND: sensors.py - ingest_sensor_reading()
   ├─ Save SensorReading to DB
   │
   ├─ Call: ConnectivityMonitor.update_device_seen()
   │  (تحديث last_seen)
   │
   └─ Call: AnomalyAlertSystem.check_sensor_reading_anomalies()
      │
      ├─ AnomalyDetector.detect_anomalies(
      │    sensor_type="air_temperature",
      │    value=42
      │  )
      │
      ├─ Runs checks:
      │  ├─ Is 42 in (0, 60)? YES → Pass
      │  ├─ Jump from 38°C to 42°C? (4°C in 10s, max=1°C) → FAIL ⚠️
      │  ├─ Stuck sensor? Last 10 values: [38,38,38,38,38,38,38,38,38,42] → No
      │  └─ Pattern break? Z-score = 2.5 (normal range is <3)
      │
      └─ Result: AnomalyReport {
           is_anomalous: true,
           severity: "high",
           anomaly_type: "unrealistic_jump",
           confidence: 0.85,
           probable_cause: "قفزة من 38°C إلى 42°C",
           recommended_action: "تحقق من الحساس"
         }

3️⃣ ANOMALY ALERT SYSTEM
   ├─ Check if alert already exists? No
   └─ CREATE Alert:
      {
        farm_id: 20,
        device_id: "sensor_temp_1",
        sensor_type: "air_temperature",
        severity: "HIGH",
        status: "open",
        message: "⚠️ قفزة غير واقعية في القراءات
                 الجهاز: sensor_temp_1
                 القيمة الحالية: 42.00°C
                 التحليل: قفزة من 38 إلى 42
                 الإجراء: تحقق من الحساس",
        actual_value: 42
      }

4️⃣ DATABASE
   INSERT INTO alerts (...) VALUES (...)

5️⃣ FRONTEND (Dashboard)
   ├─ AlertCard appears with severity="HIGH"
   ├─ Red background, red icon
   └─ Message shown to farmer
       "⚠️ قفزة غير واقعية في القراءات"
```

---

## **📊 مثال من الواقع**

### **السيناريو**: حساس الرطوبة معطل

**الأحداث**:
```
الساعة 10:00 - تقرأ حساس الرطوبة: 60% ✅
الساعة 10:01 - تقرأ حساس الرطوبة: 60% ✅ (بدون تغيير - طبيعي)
الساعة 10:02 - تقرأ حساس الرطوبة: 60% ✅
...
الساعة 10:10 - تقرأ حساس الرطوبة: 60% ⚠️ (10 قراءات متتالية بنفس القيمة)
```

**الكشف**:
```python
# في detect_anomalies():
recent_values = [60, 60, 60, 60, 60, 60, 60, 60, 60, 60]
unique_values = len(set([round(v, 2) for v in recent_values]))
# unique_values = 1

if unique_values <= 1:
    # ✅ ANOMALY DETECTED: sensor_stuck
    # Severity: HIGH
    # Confidence: 95%
```

**النتيجة**: 
```
🔴 Alert Generated:
   Type: Sensor Stuck
   Message: "الحساس عالق على القيمة 60% لعدة قراءات متتالية"
   Recommended: "أعد تشغيل الحساس أو استبدله"
```

---

## **🛠️ التكامل في النظام**

### **الملفات الرئيسية**

| الملف | الدور |
|------|-------|
| `anomaly_detector.py` | محرك كشف الشذوذ (المنطق الأساسي) |
| `anomaly_alert_system.py` | نظام التنبيهات (توليد Alerts) |
| `sensors.py` | نقطة الدخول (تفعيل الفحص) |
| `models.py` | Alert table لتخزين التنبيهات |

### **نقاط التكامل**

```python
# في sensors.py - عند استقبال قراءة جديدة:

# 1️⃣ حفظ القراءة
db.add(SensorReading(...))

# 2️⃣ تحديث الاتصال
await ConnectivityMonitor.update_device_seen(device_id)

# 3️⃣ فحص الشذوذ ← NEW
anomaly_system = get_anomaly_alert_system()
anomaly_alert = await anomaly_system.check_sensor_reading_anomalies(
    device_id, farm_id, sensor_type, value, db
)
if anomaly_alert:
    print(f"Alert generated: {anomaly_alert.message}")
```

---

## **✅ ميزات النظام**

✅ **منع التنبيهات المكررة**: عدم توليد نفس التنبيه مرتين للجهاز نفسه  
✅ **رسائل مفصلة**: شرح واضح للمشكلة والإجراء المقترح  
✅ **ثقة عالية**: confidence % لكل تنبيه  
✅ **متوازي مع الاتصال**: يعمل مع ConnectivityMonitor  
✅ **قابل للتوسع**: يمكن إضافة فحوصات جديدة بسهولة  

---

## **🚀 الخطوات التالية المقترحة**

1. **إضافة ML Models** (SVM/KNN):
   - استخدام anomaly_svm.py / anomaly_knn.py للفحوصات المتقدمة
   - تصنيف الشذوذ بدقة أعلى

2. **Tuning الحدود**:
   - ضبط max_rate_of_change حسب بيانات واقعية
   - ضبط sensor_bounds حسب خصائص الأجهزة الفعلية

3. **Dashboard Integration**:
   - عرض رسوم بيانية لـ anomalies الكاشفة
   - Anomaly trends تاريخي

4. **Feedback Loop**:
   - تحسين دقة الكشف من خلال feedback المستخدم
   - False positive reduction

---

**آخر تحديث**: 2026-05-09 23:15 UTC  
**حالة**: ✅ منتج وجاهز للاستخدام
