// src/lib/lunchNotify.server.js
//
// สร้างเหตุการณ์ lunch สำหรับ toast แอดมิน (อ่านโดย /api/admin/notifications/poll)
//
// กติกาเหล็ก: การแจ้งเตือนห้ามทำให้งานหลักล้ม (submit / poll)
// ทุกฟังก์ชัน export ในไฟล์นี้ catch เองทั้งหมด log แล้วไปต่อ ไม่ throw ออกไปเด็ดขาด
// ซ้ำ = dedupeKey ชน unique index (E11000) -> ถือว่ามีแล้ว เงียบไว้

import LunchNotification from "@/models/LunchNotification";
import LunchOrder from "@/models/LunchOrder";
import Restaurant from "@/models/Restaurant";

import { countAvailable } from "@/lib/couponStock.server";
import {
  LUNCH_STOCK_LOW_DEFAULT,
  ORDER_SOFT_CLOSE_HHMM,
  bkkAt,
  toBkkYMD,
} from "@/lib/lunchConfig";

// unique index ต้องมีจริงก่อน insert แรก ไม่งั้น 2 instance ที่ยิงพร้อมกันจะได้แถวซ้ำ
let indexesReady = null;
function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = LunchNotification.init().catch((e) => {
      indexesReady = null;
      throw e;
    });
  }
  return indexesReady;
}

/** สร้าง 1 เหตุการณ์ — คืน "created" | "exists" | "failed" (ไม่ throw) */
export async function notifyLunch({ kind, dedupeKey, message, ...refs }) {
  try {
    await ensureIndexes();
    await LunchNotification.create({ kind, dedupeKey, message, ...refs });
    return "created";
  } catch (e) {
    if (e?.code === 11000) return "exists";
    console.error(`[lunchNotify] ${dedupeKey} failed:`, e?.message || e);
    return "failed";
  }
}

/**
 * หลัง submit สำเร็จ (commit แล้ว) — เรียกจาก lunchSubmit
 *   1) lunch.submit:<orderId>
 *   2) ร้าน stock: เหลือ 0 -> stock_out, เหลือ <= threshold -> stock_low (ครั้งเดียวต่อร้านต่อวัน)
 */
export async function notifyAfterSubmit(order) {
  try {
    if (!order?._id) return;
    const name = order.holderName || "ผู้เรียน";
    const cls = order.courseName || "-";
    const code = order.couponCode || "-";
    const shop = order.restaurantName || "-";

    const message =
      order.status === "at_shop"
        ? `คุณ ${name} (${cls}) เลือกไปสั่งที่ร้าน ${shop} · รหัส ${code}`
        : `คุณ ${name} (${cls}) สั่งอาหาร ${shop} · รหัส ${code}`;

    await notifyLunch({
      kind: "submit",
      dedupeKey: `lunch.submit:${order._id}`,
      message,
      dayYMD: order.dayYMD || "",
      classId: order.classId || null,
      restaurantId: order.restaurantId || null,
      orderId: order._id,
    });

    // stock level — เฉพาะออเดอร์ที่เพิ่งได้รหัสจากคลัง
    if (order.couponSource !== "stock" || !order.restaurantId) return;

    const [remaining, restaurant] = await Promise.all([
      countAvailable(order.restaurantId, order.dayYMD),
      Restaurant.findById(order.restaurantId).select("couponStockLowThreshold").lean(),
    ]);
    const t = Number(restaurant?.couponStockLowThreshold);
    const threshold = Number.isFinite(t) && t >= 0 ? t : LUNCH_STOCK_LOW_DEFAULT;
    const base = {
      dayYMD: order.dayYMD || "",
      restaurantId: order.restaurantId,
      orderId: order._id,
    };

    if (remaining === 0) {
      await notifyLunch({
        ...base,
        kind: "stock_out",
        dedupeKey: `lunch.stock_out:${order.restaurantId}:${order.dayYMD}`,
        message: `คูปองร้าน ${shop} หมดแล้ว`,
      });
    } else if (remaining <= threshold) {
      await notifyLunch({
        ...base,
        kind: "stock_low",
        dedupeKey: `lunch.stock_low:${order.restaurantId}:${order.dayYMD}`,
        message: `คูปองร้าน ${shop} เหลือ ${remaining} ใบ`,
      });
    }
  } catch (e) {
    console.error("[lunchNotify] notifyAfterSubmit failed:", e?.message || e);
  }
}

// ทำครั้งเดียวต่อวันต่อ instance — dedupeKey กันซ้ำข้าม instance อยู่แล้ว
let unorderedDoneFor = "";

/**
 * 11:00 ยังไม่สั่ง — ไม่มี cron จึงเรียกจาก poll ของแอดมิน
 * ก่อน 11:00 / ทำไปแล้ววันนี้ -> ไม่ query อะไรเลย
 * นอกนั้น aggregate ครั้งเดียว: pending (รวม unassigned) ต่อคลาสของวันนี้
 */
export async function ensureUnorderedNotifications(now = new Date()) {
  try {
    const at = new Date(now);
    const dayYMD = toBkkYMD(at);
    if (unorderedDoneFor === dayYMD) return 0;

    const softClose = bkkAt(dayYMD, ORDER_SOFT_CLOSE_HHMM);
    if (!softClose || at < softClose) return 0;

    const groups = await LunchOrder.aggregate([
      { $match: { dayYMD, status: "pending" } },
      {
        $group: {
          _id: "$classId",
          n: { $sum: 1 },
          courseName: { $first: "$courseName" },
          roomName: { $first: "$roomName" },
        },
      },
    ]);

    let created = 0;
    let failed = false;
    for (const g of groups) {
      if (!g.n) continue;
      const r = await notifyLunch({
        kind: "unordered",
        dedupeKey: `lunch.unordered:${g._id}:${dayYMD}`,
        message: `ถึง 11:00 แล้ว ${g.courseName || "-"} ห้อง ${g.roomName || "-"} ยังไม่สั่ง ${g.n} คน`,
        dayYMD,
        classId: g._id,
      });
      if (r === "created") created += 1;
      if (r === "failed") failed = true;
    }

    // ล้มบางคลาส -> poll ครั้งถัดไปลองใหม่ (ที่สร้างไปแล้วจะชน dedupeKey เงียบ ๆ)
    if (!failed) unorderedDoneFor = dayYMD;
    return created;
  } catch (e) {
    console.error("[lunchNotify] ensureUnorderedNotifications failed:", e?.message || e);
    return 0;
  }
}
