/**
 * WARIF System - Global Configuration
 * Use this file to set default static values for the simulation.
 */

export const WARIF_CONFIG = {
  // للوصول العالمي، يرجى وضع رابط Ngrok هنا (مثال: https://xxxx.ngrok-free.app/video)
  // للوصول المحلي السريع، ضعي رابط DroidCam (مثال: http://192.168.1.XX:4747/video)
  DEFAULT_CAMERA_URL: "https://account-stuffy-crib.ngrok-free.dev/video", 
  
  // خيارات الأمان الافتراضية (اختياري)
  DEFAULT_CAMERA_USER: "",
  DEFAULT_CAMERA_PASS: "",
  
  // إعدادات أخرى للمحاكاة
  SIMULATION_MODE: true
};
