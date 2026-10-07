// src/lib/lunchScroll.client.js
//
// จำตำแหน่งเลื่อนของหน้าเมนูร้าน ตอนกดเข้าหน้ารายละเอียดเมนู แล้วคืนให้ตอนกลับมา
// เก็บใน sessionStorage (ไม่ใช่ localStorage ที่ตะกร้าใช้ lunch:v1:<token>)
// ใช้ครั้งเดียว: หน้าเมนูอ่านแล้วลบทันที / หน้าเลือกร้านและการเปลี่ยนร้านล้างทิ้ง
// จึงเข้าหน้าเมนูทางอื่นแล้วเริ่มบนสุดเสมอ

const PREFIX = "lunch:v1:scroll:";

const keyOf = (token, restaurantId) => `${PREFIX}${token}:${restaurantId}`;

export function saveMenuScroll(token, restaurantId, top) {
  try {
    sessionStorage.setItem(keyOf(token, restaurantId), String(Math.round(top || 0)));
  } catch {
    // private mode / storage ปิด -> แค่ไม่จำตำแหน่ง
  }
}

/** อ่านแล้วลบ คืน 0 ถ้าไม่มี */
export function takeMenuScroll(token, restaurantId) {
  try {
    const k = keyOf(token, restaurantId);
    const v = Number(sessionStorage.getItem(k));
    sessionStorage.removeItem(k);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function clearMenuScroll(token, restaurantId) {
  try {
    sessionStorage.removeItem(keyOf(token, restaurantId));
  } catch {
    // ignore
  }
}

/** ล้างทุกร้านของ token นี้ */
export function clearMenuScrolls(token) {
  try {
    const prefix = `${PREFIX}${token}:`;
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}
