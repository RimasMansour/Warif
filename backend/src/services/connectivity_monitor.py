# backend/src/services/connectivity_monitor.py
"""
نظام مراقبة الاتصال - يكشف انقطاع الأجهزة تلقائياً
Connectivity Monitor - Detects device disconnections automatically
"""

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from src.db.models.models import Device, Alert, AlertSeverity

logger = logging.getLogger(__name__)

# timeout بالثواني - إذا لم نتلقَ قراءة لمدة 5 دقائق، الجهاز مقطوع
DEVICE_TIMEOUT_SECONDS = 300  # 5 minutes


class ConnectivityMonitor:
    """مراقب الاتصال - يولد تنبيهات فورية عند انقطاع الأجهزة"""

    @staticmethod
    async def check_farm_connectivity(farm_id: int, db: AsyncSession) -> list:
        """
        فحص اتصال جميع أجهزة المزرعة
        يُستدعى دورياً (كل دقيقة) من startup task

        Returns: list of generated alerts
        """
        generated_alerts = []
        now = datetime.now(timezone.utc)

        try:
            # جلب جميع أجهزة المزرعة
            result = await db.execute(
                select(Device).where(Device.farm_id == farm_id)
            )
            devices = result.scalars().all()

            for device in devices:
                # إذا كان last_seen موجود وأقدم من TIMEOUT
                if device.last_seen:
                    time_since_last_seen = (now - device.last_seen).total_seconds()

                    if time_since_last_seen > DEVICE_TIMEOUT_SECONDS:
                        # الجهاز مقطوع ❌
                        if device.is_online:
                            device.is_online = False
                            device.connection_lost_at = now
                            # Commit the status flip immediately so alert creation
                            # failures cannot roll it back.
                            try:
                                await db.commit()
                            except Exception:
                                await db.rollback()
                                continue

                            logger.warning(
                                f"[Connectivity] Device {device.device_id} "
                                f"disconnected! Last seen: {device.last_seen}"
                            )

                            try:
                                alert = await _generate_connectivity_alert(
                                    farm_id=farm_id, device=device, db=db
                                )
                                await db.commit()
                                if alert:
                                    generated_alerts.append(alert)
                            except Exception as alert_err:
                                logger.error(
                                    f"[Connectivity] Alert creation failed for "
                                    f"{device.device_id}: {alert_err}"
                                )
                                await db.rollback()
                    else:
                        # الجهاز متصل ✅
                        if not device.is_online:
                            device.is_online = True
                            device.connection_lost_at = None
                            try:
                                await db.commit()
                                logger.info(
                                    f"[Connectivity] Device {device.device_id} reconnected"
                                )
                            except Exception:
                                await db.rollback()

        except Exception as e:
            logger.error(f"[ConnectivityMonitor] Error checking farm {farm_id}: {e}")
            await db.rollback()

        return generated_alerts

    @staticmethod
    async def update_device_seen(device_id: str, db: AsyncSession) -> None:
        """
        تحديث last_seen عند تلقي أي قراءة من الجهاز
        يُستدعى من sensors router عند استقبال reading جديدة
        """
        try:
            now = datetime.now(timezone.utc)

            # تحديث last_seen
            await db.execute(
                update(Device)
                .where(Device.device_id == device_id)
                .values(
                    last_seen=now,
                    is_online=True,
                    connection_lost_at=None
                )
            )
            await db.commit()

        except Exception as e:
            logger.error(f"[ConnectivityMonitor] Error updating {device_id}: {e}")
            await db.rollback()


async def _generate_connectivity_alert(
    farm_id: int,
    device: Device,
    db: AsyncSession
) -> Alert:
    """
    توليد تنبيه connectivity فوري
    نوع: critical للمضخات/المراوح, warning للحساسات
    """
    # تحديد severity حسب نوع الجهاز
    if device.type == "actuator":  # مضخة, مروحة = مهم جداً
        severity = AlertSeverity.critical
        message = (
            f"⚠️ قطع الاتصال: {device.name} "
            f"({device.device_id}) - لا يمكن إرسال الأوامر"
        )
    else:  # حساس = تنبيه عادي
        severity = AlertSeverity.warning
        message = (
            f"⚠️ قطع الاتصال: حساس {device.name} "
            f"({device.device_id}) - توقف عن الإرسال"
        )

    alert = Alert(
        farm_id=farm_id,
        device_id=device.device_id,
        sensor_type=device.type,
        severity=severity,
        message=message,
        threshold=None,
        actual_value=None,
        status="open",
    )

    db.add(alert)
    await db.flush()

    return alert
