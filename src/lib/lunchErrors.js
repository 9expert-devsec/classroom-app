// src/lib/lunchErrors.js
// R4-2: error ของ action อาหาร / lunch แยกเป็นไฟล์เล็ก ๆ — foodChoice.server.js ใช้ได้โดยไม่ต้อง import
// lunchAdmin.server.js (ซึ่ง import lunchChoice.js -> foodChoice.server.js กลายเป็นวง)
// lunchAdmin.server.js re-export class นี้ตัวเดียวกัน (instanceof ใน lunchAdminErrorBody ยังใช้ได้)

export class LunchAdminError extends Error {
  constructor(status, reason, message, extra = null) {
    super(message);
    this.name = "LunchAdminError";
    this.status = status;
    this.reason = reason;
    this.extra = extra;
  }
}
