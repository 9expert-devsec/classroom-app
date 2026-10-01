// src/lib/lunchClock.server.js
//
// นาฬิกาตัวเดียวของระบบ lunch ฝั่ง server — ทุกการเทียบเวลาของ lunch ต้องผ่าน lunchNow()
//
// C1: LUNCH_FAKE_NOW (ISO string เช่น "2026-10-01T11:30:00+07:00") ใช้ทดสอบหน้าต่างเวลา
//     โดยไม่ต้องแกล้งนาฬิกาเครื่อง — อ่านเฉพาะตอน NODE_ENV === "development" เท่านั้น
//     production ไม่มีทางอ่านค่านี้ ต่อให้ตั้ง env ไว้ก็ตาม

export function lunchNow() {
  if (process.env.NODE_ENV === "development") {
    const raw = String(process.env.LUNCH_FAKE_NOW || "").trim();
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}
