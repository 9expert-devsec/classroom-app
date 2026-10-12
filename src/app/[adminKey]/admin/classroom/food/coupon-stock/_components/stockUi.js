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
  assigned: "ถูกใช้แล้ว",
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

// lot identity = importBatch + expiresYMD (there is no Lot collection)
export const NO_BATCH = "__none__";

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

export async function safeJson(res) {
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { _raw: t };
  }
}
