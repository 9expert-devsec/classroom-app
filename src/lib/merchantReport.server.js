// src/lib/merchantReport.server.js
//
// C4: สรุปการใช้คูปองของร้านหนึ่งร้าน (Merchant) บน LunchOrder — ไม่มีราคาใด ๆ
//   ช่วงเวลา today / week (จันทร์–อาทิตย์) / month คิดฝั่ง server เป็นเวลาไทยจาก lunchNow()
//   (dev เคารพ LUNCH_FAKE_NOW เหมือนส่วนอื่นของ lunch)
//
// redeem ทำได้เฉพาะวันของออเดอร์เอง (lookup/redeem กรอง dayYMD = วันนี้)
// จึงกรองด้วย dayYMD ในช่วง + redeemedAt != null ได้ตรงกับ "ใช้ในช่วงนี้"
// และใช้ index { restaurantId: 1, dayYMD: 1, redeemedAt: -1 } ได้ทั้ง 2 เงื่อนไข
import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import { toBkkYMD } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";

export const REPORT_RANGES = ["today", "week", "month"];
export const PAGE_SIZE = 10;
export const EXPORT_CAP = 2000;

const LABELS = { today: "Today", week: "This week", month: "This month" };

/* ---------------- ranges (Asia/Bangkok) ---------------- */

const pad = (n) => String(n).padStart(2, "0");

function ymdParts(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** วันในปฏิทิน (ไม่มีเวลา) บวก/ลบวัน คิดบน UTC ล้วนกัน DST/timezone */
function addDaysYMD(ymd, days) {
  const { y, m, d } = ymdParts(ymd);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function reportRange(range, now = lunchNow()) {
  const today = toBkkYMD(now);
  const { y, m, d } = ymdParts(today);
  let fromYMD = today;
  let toYMD = today;

  if (range === "week") {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = อาทิตย์
    fromYMD = addDaysYMD(today, -((dow + 6) % 7));
    toYMD = addDaysYMD(fromYMD, 6);
  } else if (range === "month") {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    fromYMD = `${y}-${pad(m)}-01`;
    toYMD = `${y}-${pad(m)}-${pad(last)}`;
  }

  return {
    key: range,
    label: LABELS[range],
    fromYMD,
    toYMD,
    todayYMD: today,
    fromISO: new Date(`${fromYMD}T00:00:00.000+07:00`).toISOString(),
    toISO: new Date(`${toYMD}T23:59:59.999+07:00`).toISOString(),
  };
}

/* ---------------- query ---------------- */

function filterOf(restaurantId, r) {
  return {
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    dayYMD: { $gte: r.fromYMD, $lte: r.toYMD },
    redeemedAt: { $ne: null },
  };
}

const FIELDS = "redeemedAt nickname holderName roomName eCouponCode couponCode";

function rowOf(o) {
  return {
    redeemedAt: new Date(o.redeemedAt).toISOString(),
    nickname: o.nickname || "",
    name: String(o.holderName || "").trim(),
    room: o.roomName || "",
    code: o.eCouponCode || o.couponCode || "",
  };
}

function rangeDto(r) {
  return { label: r.label, fromISO: r.fromISO, toISO: r.toISO, fromYMD: r.fromYMD, toYMD: r.toYMD };
}

/** หน้าละ PAGE_SIZE ใหม่สุดก่อน */
export async function reportPage({ restaurantId, range, page = 1, now = lunchNow() }) {
  const r = reportRange(range, now);
  const filter = filterOf(restaurantId, r);
  const total = await LunchOrder.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.floor(Number(page) || 1)), pageCount);

  const docs = await LunchOrder.find(filter)
    .sort({ redeemedAt: -1, _id: -1 })
    .skip((p - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .select(FIELDS)
    .lean();

  return { range: rangeDto(r), total, page: p, pageCount, rows: docs.map(rowOf) };
}

/** ทั้งช่วง (สำหรับรูปสรุป) สูงสุด EXPORT_CAP แถว + จำนวนต่อวัน (week/month) */
export async function reportAll({ restaurantId, range, now = lunchNow() }) {
  const r = reportRange(range, now);
  const filter = filterOf(restaurantId, r);

  const [total, docs, grouped] = await Promise.all([
    LunchOrder.countDocuments(filter),
    LunchOrder.find(filter)
      .sort({ redeemedAt: -1, _id: -1 })
      .limit(EXPORT_CAP)
      .select(FIELDS)
      .lean(),
    range === "today"
      ? Promise.resolve([])
      : LunchOrder.aggregate([
          { $match: filter },
          { $group: { _id: "$dayYMD", count: { $sum: 1 } } },
        ]),
  ]);

  const out = {
    range: rangeDto(r),
    total,
    page: 1,
    pageCount: 1,
    rows: docs.map(rowOf),
    truncated: total > EXPORT_CAP,
  };

  if (range !== "today") {
    // ทุกวันตั้งแต่ต้นช่วงถึงวันนี้ (วันในอนาคตยังไม่มีข้อมูล ไม่ต้องแสดง)
    const counts = new Map(grouped.map((g) => [g._id, g.count]));
    const last = r.toYMD < r.todayYMD ? r.toYMD : r.todayYMD;
    const byDay = [];
    for (let ymd = r.fromYMD; ymd <= last; ymd = addDaysYMD(ymd, 1)) {
      byDay.push({ dayYMD: ymd, count: counts.get(ymd) || 0 });
    }
    out.byDay = byDay;
  }

  return out;
}
