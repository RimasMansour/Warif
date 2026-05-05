#!/usr/bin/env python3
import psycopg2
from psycopg2 import sql

# قاعدة البيانات في Railway Cloud
conn = psycopg2.connect(
    host="mainline.proxy.rlwy.net",
    database="railway",
    user="postgres",
    password="mZjlAjbJRiVsUkPIkwqQzotQTYfbRDjX",
    port=27061
)

cursor = conn.cursor()

# إضافة الأعمدة الناقصة
commands = [
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS helpful BOOLEAN NULL;",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE NULL;",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS actual_outcome BOOLEAN NULL;",
    "ALTER TABLE recommendations ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMP WITH TIME ZONE NULL;",
]

for command in commands:
    try:
        cursor.execute(command)
        print(f"✅ تم: {command}")
    except Exception as e:
        print(f"❌ خطأ: {e}")

conn.commit()
cursor.close()
conn.close()

print("\n✅ اكتملت الـ migration!")
