// shared helpers for the coupon-stock admin page (client-side only)
import { bangkokYMD, diffDaysYMD_BKK } from "@/lib/classDates";

export const EXPIRING_DAYS = 7;

// real CouponStockCode.status values, in tab order
export const STATUS_ORDER = [
  "available",
  "assigned",
  "handed_out",
  "awaiting_return",
  "void",
];

export const STATUS_LABELS = {
  available: "พร้อมใช้",
  // R5-3a: กระดาษ = "ใช้แล้ว" เมื่อส่งมอบ — assigned ยังเป็นแค่การจอง
  assigned: "จองแล้ว",
  handed_out: "ส่งมอบแล้ว",
  awaiting_return: "รอคืน",
  void: "ยกเลิก",
};

export const STATUS_STYLES = {
  available: "bg-green-100 text-green-700",
  assigned: "bg-blue-100 text-blue-700",
  handed_out: "bg-violet-100 text-violet-700",
  awaiting_return: "bg-amber-100 text-amber-700",
  void: "bg-slate-200 text-slate-600",
};

// lot card key = importBatch + expiresYMD (the summary takes both from the lot doc);
// R5: cards also carry lotId / lotStatus / buckets
export const NO_BATCH = "__none__";

export function isLotCancelled(b) {
  return b?.lotStatus === "cancelled";
}

/**
 * R5-3c: ล็อต "ใช้งานอยู่" = ไม่ถูกยกเลิก และยังมีรหัสที่ยังไม่จบ (พร้อมใช้ / จองแล้ว / รอคืน) อย่างน้อย 1 ใบ
 * นอกนั้น "ปิดแล้ว" (ยกเลิกแล้ว หรือส่งมอบ/ยกเลิกรายใบหมดทุกใบ)
 *   - หมดอายุแต่ยังมีใบพร้อมใช้ = ใช้งานอยู่ (ให้แอดมินเห็นแล้วยกเลิก)
 *   - ยกเลิกแล้วแต่ยังมีใบจอง = ปิดแล้ว (Counter ทำต่อจากหน้า tracking)
 */
export function isLotActive(b) {
  if (!b || isLotCancelled(b)) return false;
  return (b.available || 0) + (b.assigned || 0) + (b.awaitingReturn || 0) > 0;
}

// มุมมองของแถวการ์ดล็อต — จำต่อผู้ใช้ใน localStorage
export const LOT_VIEWS = ["active", "closed", "all"];
export const LOT_VIEW_LABELS = { active: "ใช้งานอยู่", closed: "ปิดแล้ว", all: "ทั้งหมด" };
const LOT_VIEW_STORAGE_KEY = "couponStock.lotView";

export function loadLotView() {
  try {
    const v = window.localStorage.getItem(LOT_VIEW_STORAGE_KEY);
    return LOT_VIEWS.includes(v) ? v : "active";
  } catch {
    return "active";
  }
}

export function saveLotView(v) {
  try {
    window.localStorage.setItem(LOT_VIEW_STORAGE_KEY, v);
  } catch {
    // private mode / storage blocked — ใช้ค่าในหน้าต่อไปตามปกติ
  }
}

export function lotKey(importBatch, expiresYMD) {
  return `${importBatch || NO_BATCH}|${expiresYMD || ""}`;
}

export function parseLotKey(key) {
  if (!key) return null;
  const i = key.lastIndexOf("|");
  if (i < 0) return null;
  return { batch: key.slice(0, i), expiresYMD: key.slice(i + 1) };
}

export function lotLabel(importBatch) {
  return importBatch || "ไม่ระบุล็อต";
}

/** days from today until expiry (negative = already expired) */
export function daysLeft(today, expiresYMD) {
  if (!today || !expiresYMD) return null;
  return diffDaysYMD_BKK(today, expiresYMD);
}

/** red when expired or within EXPIRING_DAYS */
export function isExpiryUrgent(today, expiresYMD) {
  const d = daysLeft(today, expiresYMD);
  return d !== null && d <= EXPIRING_DAYS;
}

export function formatImportedAt(value) {
  return value ? bangkokYMD(value) : "—";
}

/** R5-3: เรียก endpoint ล็อต -> { ok, status, data } (ไม่ throw ตอน 4xx เพื่อให้หน้าจอดู data.code เอง) */
export async function lotApi(path, body, method = "POST") {
  const res = await fetch(`/api/admin/food/coupon-stock/lots${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await safeJson(res);
  return { ok: res.ok && data.ok !== false, status: res.status, data };
}

// ข้อความเมื่อ impactHash ไม่ตรง (มีคนแก้ล็อต / รหัสในล็อตเปลี่ยนสถานะระหว่างเปิดหน้าต่าง)
export const IMPACT_CHANGED_MSG = "ข้อมูลในล็อตเปลี่ยนระหว่างนี้ — ตรวจสอบผลกระทบใหม่อีกครั้ง";

export async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
