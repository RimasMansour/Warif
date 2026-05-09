# 🏗️ دليل التكامل الشامل لنظام Warif
**Warif System Integration & Logic Verification Guide**

---

## **📌 نظرة عامة على الأنظمة المتكاملة**

```
┌──────────────────────────────────────────────────────────────────────┐
│                        WARIF ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ FRONTEND (React)                                            │    │
│  │ ─────────────────────────────────────────────────────────  │    │
│  │ • DashboardShared: RecommendationCard + AlertCard          │    │
│  │ • useWarifData hooks: API calls + local state mgmt         │    │
│  │ • Manual/Auto Mode Toggle: globalAutoMode state            │    │
│  └────────────────────┬────────────────────────────────────────┘    │
│                       │ HTTP REST API                                 │
│  ┌────────────────────▼────────────────────────────────────────┐    │
│  │ BACKEND (FastAPI)                                           │    │
│  │ ─────────────────────────────────────────────────────────  │    │
│  │ • Routers: /recommendations, /alerts, /irrigation,         │    │
│  │            /commands, /sensors                             │    │
│  │ • Services: DecisionEngine, RiskEngine,                    │    │
│  │            ConnectivityMonitor (NEW)                       │    │
│  │ • Startup Tasks: Continuous monitoring (feedback + conn)   │    │
│  └────────────────────┬────────────────────────────────────────┘    │
│                       │ SQL Transactions                              │
│  ┌────────────────────▼────────────────────────────────────────┐    │
│  │ DATABASE (PostgreSQL)                                       │    │
│  │ ─────────────────────────────────────────────────────────  │    │
│  │ • recommendations: helpful, feedback_at                     │    │
│  │ • alerts: helpful, severity, status                        │    │
│  │ • devices: last_seen, is_online, connection_lost_at (NEW)  │    │
│  │ • irrigation_events, irrigation_commands                   │    │
│  │ • device_commands: all executed commands                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## **🔄 FLOW 1: رحلة الفيدباك الكاملة (Feedback Flow)**

### **السيناريو**: المستخدم يضغط 👍 على توصية

```javascript
// 1️⃣ FRONTEND: DashboardShared.jsx → RecommendationCard
<button onClick={() => onFeedback(rec.id, 'up')}>
  👍 مفيدة
</button>

// 2️⃣ PARENT (DashboardHome.jsx): handleFeedback
const handleFeedback = async (id, type) => {
  // تحديث UI فوراً
  setFeedback(prev => ({ ...prev, [id]: type }));
  setShowThanksIds(prev => [...prev, id]);
  
  // إرسال للـ backend
  const helpful = type === 'up';  // true for 👍, false for 👎
  await submitRecommendationFeedback(farmId, id, helpful);
  //      ↓
  //      POST /api/v1/recommendations/{farmId}/feedback/{id}
  //      Body: { "helpful": true }
};

// 3️⃣ BACKEND: recommendations.py endpoint
@router.post("/{farm_id}/feedback/{recommendation_id}")
async def submit_recommendation_feedback(
    farm_id: int,
    recommendation_id: int,
    feedback: FeedbackRequest,  # { helpful: bool }
    db: AsyncSession
):
    # ✅ حفظ الفيدباك
    rec = await db.fetch(Recommendation)
    rec.helpful = feedback.helpful  # TRUE/FALSE
    rec.feedback_at = datetime.now(timezone.utc)
    await db.commit()
    
    # ✅ دمج مع نموذج التعلم
    bridge = FeedbackLearningBridge(db)
    accuracy = await bridge.calculate_feedback_accuracy(farm_id)
    # نتيجة: النموذج يُحسّن نفسه من الفيدباك التراكمي

// 4️⃣ DATABASE UPDATE
UPDATE recommendations
SET helpful = TRUE,
    feedback_at = '2026-05-09 22:55:00+00'
WHERE id = {recommendation_id}
  AND farm_id = {farm_id};

// ✅ النتيجة:
// - قاعدة البيانات تسجل التقييم
// - FeedbackLearningBridge يحسب دقة النموذج
// - النموذج يتحسن تدريجياً من تراكم الفيدباك
```

---

## **⚡ FLOW 2: رحلة التنفيذ (Execution Flow) - Manual Mode**

### **السيناريو**: المستخدم يضغط "تنفيذ" على توصية ري

```javascript
// 1️⃣ FRONTEND: RecommendationCard → onExecute
<button onClick={handleExecute}>نفذ الري</button>

const handleExecute = async () => {
  setIsLoading(true);
  try {
    await onExecute?.('irrigation', farmId);
    //      ↓
    //      executeRecommendation('irrigation', farmId)
    //      ↓
    //      triggerManualIrrigation('start', farmId, 15)
    //      ↓
    //      POST /api/v1/irrigation/manual
    
    setExecutionSuccess(true);
    setTimeout(() => setExecutionSuccess(false), 3000);
  } catch (err) {
    console.error('Execution failed:', err);
  }
};

// 2️⃣ BACKEND: irrigation.py
@router.post("/manual")
async def start_manual_irrigation(
    device_id: str,  # "irrigation_farm_123"
    duration_min: int,  # 15
    db: AsyncSession
):
    # ✅ 1. جلب الجهاز والمزرعة
    actuator = await db.fetch(Actuator, device_id)
    farm_id = actuator.device.farm_id
    
    # ✅ 2. إنشاء أمر
    command = IrrigationCommand(
        actuator_id=actuator.id,
        mode='manual',
        duration_min=15,
        created_at=now()
    )
    db.add(command)
    await db.flush()
    
    # ✅ 3. إنشاء حدث
    event = IrrigationEvent(
        actuator_id=actuator.id,
        event_type='start',
        triggered_by='manual',
        start_time=now()
    )
    db.add(event)
    await db.flush()
    
    # ✅ 4. إرسال أمر فعلي للمضخة (MQTT/Hardware)
    MQTT.publish(f"devices/{device_id}/command", {
        "action": "start",
        "duration": 15,
        "timestamp": now().isoformat()
    })
    
    # ✅ 5. حفظ الكل
    await db.commit()
    
    return {
        "command_id": command.id,
        "event_id": event.id,
        "status": "executed",
        "message": "الأمر تم إرساله للمضخة"
    }

// 3️⃣ DATABASE RECORDS (تسجيل الأمر والحدث)

-- جدول irrigation_commands
INSERT INTO irrigation_commands (
    actuator_id, mode, duration_min, created_at
) VALUES (
    123, 'manual', 15, '2026-05-09 22:55:00+00'
);

-- جدول irrigation_events
INSERT INTO irrigation_events (
    actuator_id, event_type, triggered_by, 
    start_time, end_time, duration_sec
) VALUES (
    123, 'start', 'manual', 
    '2026-05-09 22:55:00+00', NULL, NULL
);

// ✅ النتيجة:
// - المضخة تشتغل لمدة 15 دقيقة
// - الأمر مسجل في DB
// - الحدث مسجل في DB (لاحقاً يُحدّث end_time و duration_sec)
```

---

## **🔐 FLOW 3: منطق Manual/Auto Mode**

### **Global State Management**

```javascript
// في DashboardHome.jsx
const [globalAutoMode, setGlobalAutoMode] = useState(false);

// AutomationToggleCard يتحكم بها
<AutomationToggleCard
  isActive={globalAutoMode}
  onToggle={setGlobalAutoMode}
  title="الأتمتة الذكية"
/>

// تُمرر إلى جميع components
<RecommendationCard ... globalAutoMode={globalAutoMode} />
<AlertCard ... globalAutoMode={globalAutoMode} />
```

### **المنطق الشرطي في RecommendationCard**

```jsx
// File: DashboardShared.jsx - line ~857

{!globalAutoMode ? (
  // ========== MANUAL MODE ==========
  <div className="flex gap-1">
    {/* Feedback buttons (always visible) */}
    <button onClick={() => onFeedback(rec.id, 'down')}>👎</button>
    <button onClick={() => onFeedback(rec.id, 'up')}>👍</button>
    
    {/* Action buttons (only in manual mode) */}
    <button 
      onClick={handleExecute}
      className="bg-emerald-600"
    >
      ✅ تنفيذ الري
    </button>
    
    <button 
      onClick={() => onIgnore(rec.id)}
      className="bg-white border"
    >
      ❌ تجاهل
    </button>
  </div>
) : (
  // ========== AUTO MODE ==========
  <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200">
    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
    <span className="text-xs font-black text-emerald-700">
      ✅ تم تنفيذ الري تلقائياً
    </span>
  </div>
)}
```

### **الفرق في السلوك**

| الحالة | العرض | السلوك |
|--------|-------|--------|
| Manual Mode | ✅ تنفيذ / ❌ تجاهل / 👍👎 | المستخدم يقرر تنفيذ أم لا |
| Auto Mode | ✅ تم تنفيذي تلقائياً | النظام ينفذ بدون انتظار |

---

## **🔌 FLOW 4: نظام مراقبة الاتصال (NEW - Connectivity Alerts)**

### **المكونات الجديدة**

```python
# ملف جديد: backend/src/services/connectivity_monitor.py

class ConnectivityMonitor:
    # دالة 1: فحص دوري لجميع الأجهزة
    async def check_farm_connectivity(farm_id, db):
        # كل 60 ثانية من startup task
        # تتحقق من: has device.last_seen > TIMEOUT?
        # إذا نعم → توليد alert تلقائي
        
    # دالة 2: تحديث last_seen عند استقبال قراءة
    async def update_device_seen(device_id, db):
        # يُستدعى من sensors router
        # يحدّث: last_seen, is_online, connection_lost_at
```

### **مسار العمل**

```
┌──────────────────────────────────────┐
│ جهاز (حساس أو مضخة)                    │
│ يُرسل قراءة كل 30 ثانية               │
└──────────────┬──────────────────────┘
               │ POST /api/v1/sensors
               │ Body: { device_id, sensor_type, value }
               ▼
┌──────────────────────────────────────┐
│ sensors.py: ingest_sensor_reading()  │
└──────────┬───────────────────────────┘
           │ عند استقبال قراءة:
           │
           ├─> حفظ SensorReading
           │
           └─> استدعاء ConnectivityMonitor
                └─> update_device_seen(device_id)
                    ├─ Set: last_seen = NOW
                    ├─ Set: is_online = TRUE
                    └─ Set: connection_lost_at = NULL

┌──────────────────────────────────────┐
│ main.py: Startup Task                │
│ كل 60 ثانية                          │
└──────────┬───────────────────────────┘
           │
           └─> ConnectivityMonitor
                └─> check_farm_connectivity()
                    للـ كل جهاز:
                    │
                    ├─ إذا (NOW - last_seen) > 300 ثانية
                    │  و is_online = TRUE:
                    │
                    │  ├─ Set: is_online = FALSE
                    │  ├─ Set: connection_lost_at = NOW
                    │  └─ Generate Alert (CRITICAL)
                    │      Message: "⚠️ قطع الاتصال: {device}"
                    │
                    └─ إذا (NOW - last_seen) < 300 ثانية
                       و is_online = FALSE:
                       
                       └─ Set: is_online = TRUE
                          Message: "✅ استرجع الاتصال"
```

---

## **📊 FLOW 5: توليد التوصيات من Decision Engine**

### **المصادر**

```python
# decision_engine.py.analyze() يستقبل:
sensor_data = {
    "soil_moisture": 45,        # % من التربة
    "soil_temperature": 28,     # درجة مئوية
    "air_temperature": 32,      # درجة مئوية
    "air_humidity": 65,         # %
    "crop_type": "tomatoes"     # نوع المحصول
}

# ثم يجلب:
weather = await fetch_weather()  # latitude: 21.3891 (Makkah)
# Returns: { ext_temp, ext_humidity, cloudcover, is_day }
```

### **الفئات المدعومة**

```python
class RecommendationCategory(str, enum.Enum):
    irrigation = "irrigation"       # ✅ الري (توصيات: ري أو وقف)
    temperature = "temperature"     # ✅ درجة حرارة (توصيات: تبريد)
    humidity = "humidity"           # ✅ رطوبة (توصيات: تهوية)
    soil = "soil"                   # ⚠️ التربة (محدود حالياً)
    general = "general"             # ⚠️ عام (نادر الاستخدام)
```

### **مثال: التوصية بـ Irrigation**

```python
# في decision_engine.py.analyze():

if soil_moisture < optimal_min - 15:
    # حالة حرجة
    recommendations.append(SmartRecommendation(
        message="تحسين إدارة الري",
        reasoning=f"رطوبة التربة ({soil_moisture}%) انخفضت حرجياً. الإجراء: ري فوري",
        category="irrigation",
        severity="urgent",      # ← لون أحمر في UI
        confidence=0.95
    ))
elif soil_moisture > optimal_max + 10:
    # مرتفعة جداً
    recommendations.append(SmartRecommendation(
        message="تقليل فترات الري",
        reasoning=f"رطوبة التربة ({soil_moisture}%) عالية جداً. تقليل الري",
        category="irrigation",
        severity="normal",
        confidence=0.8
    ))
# بدون توصية إذا كانت مثالية - تجنب إرباك المستخدم
```

---

## **🗄️ Database Schema - الحقول المتعلقة بالتحكم والفيدباك**

```sql
-- جدول recommendations
CREATE TABLE recommendations (
    id INTEGER PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(id),
    message TEXT NOT NULL,
    reasoning TEXT,
    category VARCHAR(32),  -- irrigation, temperature, humidity, soil
    severity VARCHAR(16),  -- normal, warning, urgent
    is_read BOOLEAN DEFAULT FALSE,
    
    -- ========== FEEDBACK FIELDS ==========
    helpful BOOLEAN NULL,  -- NULL (لم يقيّم), TRUE (مفيد), FALSE (غير مفيد)
    feedback_at DATETIME(timezone),  -- وقت التقييم
    
    -- ========== EXECUTION TRACKING ==========
    is_alert BOOLEAN DEFAULT FALSE,
    mode VARCHAR(10),  -- 'auto' أو 'manual' وقت التوليد
    actual_outcome BOOLEAN NULL,  -- هل كانت النتيجة صحيحة؟
    outcome_at DATETIME(timezone),
    
    created_at DATETIME(timezone)
);

-- جدول alerts
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY,
    farm_id INTEGER REFERENCES farms(id),
    device_id VARCHAR(64),
    sensor_type VARCHAR(32),
    severity VARCHAR(16),  -- critical, high, warning, info
    status VARCHAR(16),  -- open, acknowledged, resolved
    message TEXT,
    
    -- ========== FEEDBACK ==========
    helpful BOOLEAN NULL,  -- NULL (لم يقيّم), TRUE (صحيح), FALSE (false alarm)
    
    created_at DATETIME(timezone),
    resolved_at DATETIME(timezone)
);

-- جدول devices (محدّث)
CREATE TABLE devices (
    id INTEGER PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(id),
    device_id VARCHAR(64) UNIQUE,
    name VARCHAR(128),
    type VARCHAR(32),  -- sensor, actuator
    status VARCHAR(16) DEFAULT 'active',
    
    -- ========== CONNECTIVITY FIELDS (NEW) ==========
    last_seen DATETIME(timezone),  -- آخر قراءة تم استقبالها
    is_online BOOLEAN DEFAULT TRUE,  -- حالة الاتصال الحالية
    connection_lost_at DATETIME(timezone),  -- متى قطع الاتصال
    
    created_at DATETIME(timezone)
);

-- جدول irrigation_events
CREATE TABLE irrigation_events (
    id INTEGER PRIMARY KEY,
    actuator_id INTEGER REFERENCES actuators(id),
    event_type VARCHAR(16),  -- start, stop
    triggered_by VARCHAR(16),  -- manual, auto, schedule
    start_time DATETIME(timezone),
    end_time DATETIME(timezone),
    duration_sec INTEGER,
    water_volume_liters FLOAT
);

-- جدول device_commands (سجل أوامر)
CREATE TABLE device_commands (
    id INTEGER PRIMARY KEY,
    device_id VARCHAR(64),
    command_type VARCHAR(32),  -- start, stop, config
    payload JSON,
    executed_at DATETIME(timezone),
    response JSON
);
```

---

## **✅ قائمة التحقق (Verification Checklist)**

### **الجزء 1: الفيدباك ✅ موثق**
- [x] Button 👍 connected to onFeedback callback
- [x] onFeedback sends POST /recommendations/{farmId}/feedback/{recId}
- [x] Backend saves to Recommendation.helpful
- [x] Backend records Recommendation.feedback_at
- [x] FeedbackLearningBridge integrates feedback
- [x] Database tracks feedback for continuous learning

### **الجزء 2: التنفيذ ✅ موثق**
- [x] Button "Execute" connected to onExecute callback
- [x] onExecute calls executeRecommendation(category, farmId)
- [x] Irrigation category → triggerManualIrrigation → POST /irrigation/manual
- [x] Temperature/Humidity → triggerManualCooling → POST /commands/cooling
- [x] Backend creates IrrigationCommand record
- [x] Backend creates IrrigationEvent record
- [x] Backend sends actual MQTT command to device

### **الجزء 3: Manual/Auto Mode ✅ موثق**
- [x] globalAutoMode state in DashboardHome
- [x] AutomationToggleCard controls globalAutoMode
- [x] RecommendationCard checks !globalAutoMode
- [x] Manual mode: show Execute + Ignore buttons
- [x] Auto mode: show "Auto Executed" badge only
- [x] Feedback buttons visible in both modes

### **الجزء 4: Connectivity Alerts ✅ جديد**
- [x] Device table has last_seen, is_online, connection_lost_at
- [x] ConnectivityMonitor.update_device_seen() updates on reading
- [x] ConnectivityMonitor.check_farm_connectivity() runs every 60s
- [x] Auto-generate CRITICAL alert on disconnection
- [x] Auto-clear on reconnection

### **الجزء 5: Weather Integration ✅ موثق**
- [x] DecisionEngine.fetch_weather() from open-meteo API
- [x] Latitude: 21.3891 (Makkah), Longitude: 39.8579
- [x] Fetches: temperature_2m, relative_humidity_2m, cloudcover
- [x] Integrated with sensor_data in scoring algorithm
- [x] Used in irrigation, temperature decisions

### **الجزء 6: Scope of Recommendations ⚠️ محدود**
- [x] Irrigation category implemented
- [x] Temperature category implemented
- [x] Humidity category implemented
- [ ] Soil health category (basic only)
- [ ] Pest management (not yet)
- [ ] Disease detection (not yet)
- [ ] Crop stage tracking (not yet)

---

## **🚀 التعديلات الجديدة المضافة**

### **1. Database Schema Updates**
- Added `last_seen`, `is_online`, `connection_lost_at` to devices table

### **2. New Service: ConnectivityMonitor**
- File: `backend/src/services/connectivity_monitor.py`
- Functions:
  - `check_farm_connectivity()` - periodic check
  - `update_device_seen()` - called on sensor reading

### **3. Integration Points**
- `main.py`: Added ConnectivityMonitor to startup task
- `sensors.py`: Call `update_device_seen()` in ingest_sensor_reading()

### **4. Disabled: Chatbot**
- Commented out import and router in main.py
- Protects Rimas's work from interference

---

## **📝 نموذج الاستدعاء المتسلسل (Call Sequence)**

```
USER ACTION: "تنفيذ التوصية"
     ↓
RecommendationCard.handleExecute()
     ↓
onExecute(category='irrigation', farmId=20)
     ↓
executeRecommendation('irrigation', 20)  [useWarifData.js]
     ↓
triggerManualIrrigation('start', 20, 15)
     ↓
fetch('POST /api/v1/irrigation/manual', {
  device_id: 'irrigation_farm_20',
  duration_min: 15
})
     ↓
BACKEND: start_manual_irrigation()
     ├─ Fetch actuator
     ├─ Create IrrigationCommand (mode='manual')
     ├─ Create IrrigationEvent (event_type='start')
     ├─ Publish MQTT: devices/irrigation_farm_20/command
     └─ Commit to DB
     ↓
MQTT Device: Receives command → Opens valve → 15 min run
     ↓
DEVICE: Sends completion → stops valve
     ↓
BACKEND: Receives stop signal
     ├─ Update IrrigationEvent (end_time, duration_sec, volume)
     └─ Commit to DB
     ↓
DATABASE:
  ├─ irrigation_commands: {mode: 'manual', duration_min: 15}
  ├─ irrigation_events: {event_type: 'start', duration_sec: 900}
  └─ device_commands: {command_type: 'start', executed_at: ...}
     ↓
✅ RESULT: نظام التحكم كامل ومسجل في قاعدة البيانات
```

---

**آخر تحديث**: 2026-05-09 23:00 UTC  
**المراجع**: VERIFICATION_REPORT.md, backend/src/services/connectivity_monitor.py
