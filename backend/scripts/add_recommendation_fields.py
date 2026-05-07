"""
Migration Script: إضافة حقول is_alert و mode لجدول recommendations
يعمل على Railway PostgreSQL database
"""

import os
import sys
import asyncio
from datetime import datetime
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import settings

async def run_migration():
    """تشغيل Migration"""

    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    print("🔍 فحص اتصال قاعدة البيانات...")
    async with engine.begin() as conn:
        # الحصول على أعمدة جدول recommendations
        def get_columns(sync_conn):
            inspector = inspect(sync_conn)
            return [col['name'] for col in inspector.get_columns('recommendations')]

        columns = await conn.run_sync(get_columns)
        print(f"✅ الأعمدة الموجودة: {columns}")

        # فحص وجود العمود is_alert
        if 'is_alert' not in columns:
            print("➕ إضافة العمود is_alert...")
            await conn.execute(text("""
                ALTER TABLE recommendations
                ADD COLUMN is_alert BOOLEAN DEFAULT FALSE;
            """))
            print("✅ تم إضافة is_alert")
        else:
            print("⚠️ العمود is_alert موجود بالفعل")

        # فحص وجود العمود mode
        if 'mode' not in columns:
            print("➕ إضافة العمود mode...")
            await conn.execute(text("""
                ALTER TABLE recommendations
                ADD COLUMN mode VARCHAR(10) NULL;
            """))
            print("✅ تم إضافة mode")
        else:
            print("⚠️ العمود mode موجود بالفعل")

        # إنشاء index على is_alert
        try:
            await conn.execute(text("""
                CREATE INDEX idx_recommendations_is_alert ON recommendations(is_alert);
            """))
            print("✅ تم إنشاء index على is_alert")
        except Exception as e:
            if "already exists" in str(e) or "duplicate key" in str(e).lower():
                print("⚠️ Index موجود بالفعل")
            else:
                raise

        # ────────────────────────────────────────────────────────────────────
        # ALERTS TABLE - إضافة حقل helpful
        print("\n📋 فحص جدول alerts...")

        def get_alerts_columns(sync_conn):
            inspector = inspect(sync_conn)
            return [col['name'] for col in inspector.get_columns('alerts')]

        alerts_columns = await conn.run_sync(get_alerts_columns)
        print(f"✅ الأعمدة الموجودة في alerts: {alerts_columns}")

        if 'helpful' not in alerts_columns:
            print("➕ إضافة العمود helpful في alerts...")
            await conn.execute(text("""
                ALTER TABLE alerts
                ADD COLUMN helpful BOOLEAN NULL;
            """))
            print("✅ تم إضافة helpful في alerts")
        else:
            print("⚠️ العمود helpful موجود بالفعل في alerts")

    await engine.dispose()
    print("\n✅ Migration انتهت بنجاح!")

async def main():
    """الدالة الرئيسية"""
    try:
        print("🚀 بدء Migration Script...")
        print(f"⏰ الوقت: {datetime.now()}")
        db_host = settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'localhost'
        print(f"🗄️ قاعدة البيانات: {db_host}")
        print("-" * 50)

        await run_migration()

        print("-" * 50)
        print("✨ انتهى بنجاح!")

    except Exception as e:
        print(f"❌ خطأ: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
