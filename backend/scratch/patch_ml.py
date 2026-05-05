import re

file_path = "c:\\Users\\AyahB\\Downloads\\Warif-main\\backend\\src\\ml\\continual_learning.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure we clean up the previous failed partial edit first by reverting it, but it's okay because we are doing str replace safely.
# Wait, let's just do targeted replaces on the raw content.

# 1. conn = sqlite3.connect(...) -> conn = self._get_conn()
content = content.replace("conn = sqlite3.connect(self.db_path)", "conn = self._get_conn()")

# 2. CREATE TABLE IF NOT EXISTS
content = content.replace("CREATE TABLE IF NOT EXISTS sensor_readings", "CREATE TABLE IF NOT EXISTS ml_sensor_readings")
content = content.replace("CREATE TABLE IF NOT EXISTS predictions", "CREATE TABLE IF NOT EXISTS ml_predictions")
content = content.replace("CREATE TABLE IF NOT EXISTS model_versions", "CREATE TABLE IF NOT EXISTS ml_model_versions")

content = content.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
content = content.replace("FOREIGN KEY (reading_id) REFERENCES sensor_readings(id)", "FOREIGN KEY (reading_id) REFERENCES ml_sensor_readings(id)")

# 3. INSERT INTO and FROM
content = content.replace("INTO sensor_readings", "INTO ml_sensor_readings")
content = content.replace("INTO predictions", "INTO ml_predictions")
content = content.replace("INTO model_versions", "INTO ml_model_versions")
content = content.replace("FROM sensor_readings", "FROM ml_sensor_readings")
content = content.replace("FROM predictions", "FROM ml_predictions")
content = content.replace("FROM model_versions", "FROM ml_model_versions")

# 4. ? to %s in queries
content = content.replace("VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id")
content = content.replace("VALUES (?,?,?,?,?,?,?,?,?)", "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)")
content = content.replace("LIMIT ?", "LIMIT %s")

# 5. lastrowid to fetchone()[0]
content = content.replace("reading_id = c.lastrowid", "reading_id = c.fetchone()[0]")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch successful!")
