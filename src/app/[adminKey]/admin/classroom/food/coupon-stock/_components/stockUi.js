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
  // R5-3f: assigned ที่วันเรียนผ่านไปแล้วแสดง "ไม่มารับ" แทน (STALE_ASSIGNED_*)
  assigned: "รอส่งมอบ",
  handed_out: "ส่งมอบแล้ว",
  awaiting_return: "รอคืน",
  void: "ยกเลิก",
};

// R5-3f: assigned + วันเรียนผ่านไปแล้ว (item.staleAssigned) — ป้ายเดียวแทน "รอส่งมอบ"
export const STALE_ASSIGNED_LABEL = "ไม่มารับ";
export const STALE_ASSIGNED_STYLE = "bg-amber-100 text-amber-800";

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
 * R5-3c: ล็อต "ใช้งานอยู่" = ไม่ถูกยกเลิก และยังมีรหัสที่ยังไม่จบ (พร้อมใช้ / รอส่งมอบ / ไม่มารับ / รอคืน) อย่างน้อย 1 ใบ
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

/**
 * R5-3g: สถานะวันหมดอายุ — ใช้ร่วมกันทั้งป้ายการ์ดล็อต บรรทัดวันที่ และคอลัมน์หมดอายุในตาราง
 *   ok      > 7 วัน      ปกติ          เขียว
 *   soon    1–7 วัน      ใกล้หมดอายุ    เหลืองอำพัน
 *   today   0 วัน        หมดอายุวันนี้   ส้มเข้ม
 *   expired เลยมาแล้ว     หมดอายุแล้ว    แดง
 * คืน { key, d, label, pillCls, textCls, dayText } หรือ null (ไม่มีวันหมดอายุ / ไม่รู้วันนี้)
 */
const EXPIRY_LEVELS = {
  ok: { label: "ปกติ", pillCls: "bg-green-100 text-green-700", textCls: "text-green-700" },
  soon: { label: "ใกล้หมดอายุ", pillCls: "bg-amber-100 text-amber-800", textCls: "text-amber-700" },
  today: { label: "หมดอายุวันนี้", pillCls: "bg-orange-200 text-orange-900", textCls: "font-semibold text-orange-700" },
  expired: { label: "หมดอายุแล้ว", pillCls: "bg-red-100 text-red-700", textCls: "text-red-600" },
};

export function expiryStatus(today, expiresYMD) {
  const d = daysLeft(today, expiresYMD);
  if (d === null) return null;
  const key = d < 0 ? "expired" : d === 0 ? "today" : d <= EXPIRING_DAYS ? "soon" : "ok";
  const dayText = d < 0 ? `เลยมา ${-d} วัน` : d === 0 ? "หมดอายุวันนี้" : `เหลือ ${d} วัน`;
  return { key, d, dayText, ...EXPIRY_LEVELS[key] };
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
