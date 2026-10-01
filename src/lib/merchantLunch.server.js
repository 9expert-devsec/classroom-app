// src/lib/merchantLunch.server.js
//
// C3c: Merchant ตัวใหม่บน LunchOrder — ร้านที่เปิดคูปองและไม่ใช้คูปอง stock (วันนี้คือ Kaizen)
//   lookup : ดูข้อมูลลูกค้าจากรหัส e-coupon (ไม่มีราคาใด ๆ)
//   redeem : กดใช้แบบ atomic — findOneAndUpdate ครั้งเดียวที่มี redeemedAt: null ใน filter
//   recent : รายการที่ใช้แล้ววันนี้ของร้านนี้ (ล่าสุด 10)
//
// รหัสต้องตรงทั้งร้าน วันนี้ (เวลาไทยผ่าน lunchNow) สถานะ ordered/at_shop และไม่ถูก void
// นอกนั้นทั้งหมด (ร้านอื่น วันอื่น ยกเลิก คูปอง stock) = not_found
import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import Restaurant from "@/models/Restaurant";
import { toBkkYMD, finalCloseAt, finalCloseLabel } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import { writeAuditLog } from "@/lib/auditLog.server";

/* ---------------- code ---------------- */

/**
 * "9XP-B6MW" / "9xpb6mw" / "B6MW" / " 9xp b6mw " -> "9XP-B6MW"
 * รูปแบบอื่น -> "" (ถือว่าไม่พบ)
 */
export function normalizeECouponCode(input) {
  const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^9XP[A-Z0-9]{4}$/.test(s)) return `9XP-${s.slice(3)}`;
  if (/^[A-Z0-9]{4}$/.test(s)) return `9XP-${s}`;
  return "";
}

/* ---------------- restaurants ---------------- */

const ELIGIBLE = {
  couponEnabled: true,
  usesCouponStock: { $ne: true },
  isActive: { $ne: false },
};

export async function listMerchantRestaurants() {
  const docs = await Restaurant.find(ELIGIBLE).select("name logoUrl").sort({ name: 1 }).lean();
  return docs.map((r) => ({ id: String(r._id), name: r.name || "", logo: r.logoUrl || "" }));
}

/** ร้านต้องอยู่ในกลุ่มที่ Merchant ให้บริการ ไม่งั้น null */
export async function getMerchantRestaurant(restaurantId) {
  const id = String(restaurantId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const r = await Restaurant.findOne({ _id: id, ...ELIGIBLE }).select("name logoUrl").lean();
  return r ? { id: String(r._id), name: r.name || "", logo: r.logoUrl || "" } : null;
}

/* ---------------- DTO (ไม่มีราคา) ---------------- */

function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function customerOf(order) {
  const { firstName, lastName } = splitName(order.holderName);
  return {
    code: order.eCouponCode || order.couponCode || "",
    nickname: order.nickname || "",
    firstName,
    lastName,
    room: order.roomName || "",
    className: order.courseName || "",
    dayYMD: order.dayYMD || "",
    mode: order.status === "at_shop" ? "at_shop" : "order",
    items: (order.lines || []).map((l) => ({
      name: l.name || "",
      qty: l.qty || 0,
      options: (l.options || []).map((o) => o.choiceName).filter(Boolean),
      note: l.note || "",
    })),
  };
}

const PROJECTION =
  "status dayYMD eCouponCode couponCode nickname holderName roomName courseName lines.name lines.qty lines.options.choiceName lines.note redeemedAt";

function baseFilter({ restaurantId, code, dayYMD }) {
  return {
    eCouponCode: code,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    dayYMD,
    status: { $in: ["ordered", "at_shop"] },
    couponVoidedAt: null,
  };
}

function isPastFinalClose(dayYMD, now) {
  const fc = finalCloseAt(dayYMD);
  return !!fc && new Date(now).getTime() >= fc.getTime();
}

/** สถานะของออเดอร์ที่พบแล้ว: used ชนะทุกอย่าง, แล้วจึงดูเวลาปิด */
function stateOf(order, now) {
  if (order.redeemedAt) {
    return {
      state: "used",
      usedAt: new Date(order.redeemedAt).toISOString(),
      customer: customerOf(order),
    };
  }
  if (isPastFinalClose(order.dayYMD, now)) {
    return { state: "expired", validUntil: finalCloseLabel(), customer: customerOf(order) };
  }
  return { state: "unused", customer: customerOf(order) };
}

/* ---------------- lookup ---------------- */

export async function lookupECoupon({ restaurantId, code, now = lunchNow() }) {
  const normalized = normalizeECouponCode(code);
  if (!normalized || !mongoose.Types.ObjectId.isValid(String(restaurantId || ""))) {
    return { state: "not_found" };
  }
  const dayYMD = toBkkYMD(now);
  const order = await LunchOrder.findOne(baseFilter({ restaurantId, code: normalized, dayYMD }))
    .select(PROJECTION)
    .lean();
  if (!order) return { state: "not_found" };
  return stateOf(order, now);
}

/* ---------------- redeem (atomic) ---------------- */

export async function redeemECoupon({ restaurant, code, via, req = null, now = lunchNow() }) {
  const normalized = normalizeECouponCode(code);
  if (!normalized || !restaurant?.id) return { state: "not_found" };

  const at = new Date(now);
  const dayYMD = toBkkYMD(at);
  const filter = baseFilter({ restaurantId: restaurant.id, code: normalized, dayYMD });
  const redeemedVia = via === "scan" ? "scan" : "typed";

  // ก่อนเวลาปิดเท่านั้นที่ลองเขียน — หลังเวลาปิดตกไปอ่านสถานะด้านล่าง (expired)
  let updated = null;
  if (!isPastFinalClose(dayYMD, at)) {
    updated = await LunchOrder.findOneAndUpdate(
      { ...filter, redeemedAt: null },
      {
        $set: {
          redeemedAt: at,
          redeemedRestaurantId: new mongoose.Types.ObjectId(restaurant.id),
          redeemedVia,
        },
      },
      { new: true },
    )
      .select(PROJECTION)
      .lean();
  }

  if (updated) {
    try {
      await writeAuditLog({
        ctx: {
          user: {
            username: `merchant:${restaurant.name}`,
            name: `merchant:${restaurant.name}`,
          },
        },
        req,
        action: "lunch.redeem",
        entityType: "LunchOrder",
        entityId: String(updated._id),
        entityLabel: `${updated.holderName || "-"} • ${updated.dayYMD || ""}`,
        before: { redeemedAt: null },
        after: { redeemedAt: at.toISOString(), redeemedVia },
        meta: {
          orderId: String(updated._id),
          restaurantId: restaurant.id,
          code: normalized,
          via: redeemedVia,
          dayYMD: updated.dayYMD,
        },
      });
    } catch (e) {
      console.warn("[merchantLunch] writeAuditLog failed:", e?.message || e);
    }
    return { ...stateOf(updated, at), redeemed: true };
  }

  // ไม่ match: อ่านซ้ำครั้งเดียวเพื่อบอก used (พร้อมเวลา) / expired / not_found
  const fresh = await LunchOrder.findOne(filter).select(PROJECTION).lean();
  if (!fresh) return { state: "not_found" };
  return stateOf(fresh, at);
}

/* ---------------- recent ---------------- */

export async function recentRedemptions({ restaurantId, now = lunchNow(), limit = 10 }) {
  if (!mongoose.Types.ObjectId.isValid(String(restaurantId || ""))) return [];
  const rows = await LunchOrder.find({
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    dayYMD: toBkkYMD(now),
    redeemedAt: { $ne: null },
  })
    .sort({ redeemedAt: -1 })
    .limit(limit)
    .select("redeemedAt nickname holderName eCouponCode couponCode")
    .lean();
  return rows.map((o) => ({
    usedAt: new Date(o.redeemedAt).toISOString(),
    nickname: o.nickname || "",
    name: o.holderName || "",
    code: o.eCouponCode || o.couponCode || "",
  }));
}
