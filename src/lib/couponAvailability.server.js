// src/lib/couponAvailability.server.js
//
// จุดเดียวที่ตัดสินว่า "วันนี้คลาสนี้เลือก Cash Coupon ได้ไหม"
// ทุก read path (food/today, checkin/food, calendar) ต้องเรียกผ่านที่นี่
// ห้าม re-implement กฎซ้ำอีก มิฉะนั้นจะหลุดกันคนละแบบเหมือนรอบก่อน
//
// กติกา:
//   - คลาสที่ตั้ง disableCoupon ไว้ -> ไม่ได้ (class_disabled)
//   - วันนั้นต้องมีอย่างน้อย 1 entry ที่ mode = "coupon" และร้านนั้น
//     couponEnabled = true และ isActive != false -> ไม่งั้น no_coupon_restaurant
//
// การเลือกว่าจะกินร้านไหน เกิดบนมือถือผู้เรียนทีหลัง ไม่ใช่รอบนี้

import FoodDaySet from "@/models/FoodDaySet";
import Restaurant from "@/models/Restaurant";
import { bangkokYMD, addDaysYMD_BKK } from "@/lib/classDates";
import { countAvailable } from "@/lib/couponStock.server";

/**
 * วันอบรม (Bangkok "YYYY-MM-DD") ของ day ที่ N ในคลาสนี้
 * days[] เป็น source of truth (อาจข้ามวันได้) ไม่มีก็ไล่จาก date + (day-1)
 * ห้ามใช้ getter ของ server-local date — ไปทาง classDates ทั้งหมด
 */
export function resolveClassDayYMD(classDoc, day) {
  const d = Math.max(1, Number(day || 1));

  if (Array.isArray(classDoc?.days) && classDoc.days[d - 1]) {
    return String(classDoc.days[d - 1]).slice(0, 10);
  }

  if (!classDoc?.date) return "";
  const startYMD = bangkokYMD(classDoc.date);
  if (!startYMD) return "";

  return addDaysYMD_BKK(startYMD, d - 1);
}

/**
 * FoodDaySet ของวันนั้น หาโดย dayYMD เท่านั้น
 * เอกสารที่ถูก supersede จะไม่มี dayYMD จึงหาไม่เจอโดยอัตโนมัติ
 */
export async function getDaySet(dayYMD) {
  const ymd = String(dayYMD || "").slice(0, 10);
  if (!ymd) return null;
  return FoodDaySet.findOne({ dayYMD: ymd }).lean();
}

/**
 * {
 *   available, reason,
 *   couponRestaurantIds,           // เฉพาะร้านที่ "เปิดรับจริง" (ใช้ต่อได้เลย)
 *   couponRestaurants: [{ restaurantId, name, usesCouponStock,
 *                         stockAvailable, open, reason }]
 * }
 * reason: "class_disabled" | "no_coupon_restaurant" | null
 *
 * ร้าน stock ที่คูปองหมด (stockAvailable = 0) จะ open:false reason:"stock_out"
 * ร้านที่ไม่ใช้ stock จะ stockAvailable = null (ออก e-coupon ได้ไม่จำกัด)
 */
export async function getCouponAvailability({ classDoc, dayYMD, daySet }) {
  const empty = { couponRestaurantIds: [], couponRestaurants: [] };

  if (classDoc?.disableCoupon) {
    return { available: false, reason: "class_disabled", ...empty };
  }

  const ds = daySet !== undefined ? daySet : await getDaySet(dayYMD);

  const couponEntryIds = (ds?.entries || [])
    .filter((e) => e?.mode === "coupon" && e?.restaurant)
    .map((e) => String(e.restaurant));

  if (couponEntryIds.length === 0) {
    return { available: false, reason: "no_coupon_restaurant", ...empty };
  }

  // ร้านต้องเปิดใช้งาน และถูกตั้งว่าร่วมระบบคูปองได้จริง
  const usable = await Restaurant.find({
    _id: { $in: couponEntryIds },
    couponEnabled: true,
    isActive: { $ne: false },
  })
    .select("_id name usesCouponStock")
    .lean();

  if (usable.length === 0) {
    return { available: false, reason: "no_coupon_restaurant", ...empty };
  }

  // ร้าน stock ต้องมีคูปองที่ยังไม่หมดอายุเหลืออยู่จริง
  const couponRestaurants = await Promise.all(
    usable.map(async (r) => {
      const usesCouponStock = !!r.usesCouponStock;
      const stockAvailable = usesCouponStock
        ? await countAvailable(r._id, dayYMD)
        : null;

      const open = usesCouponStock ? stockAvailable > 0 : true;

      return {
        restaurantId: String(r._id),
        name: r.name || "",
        usesCouponStock,
        stockAvailable,
        open,
        reason: open ? null : "stock_out",
      };
    }),
  );

  const openOnes = couponRestaurants.filter((r) => r.open);

  if (openOnes.length === 0) {
    return {
      available: false,
      reason: "no_coupon_restaurant",
      couponRestaurantIds: [],
      couponRestaurants,
    };
  }

  return {
    available: true,
    reason: null,
    couponRestaurantIds: openOnes.map((r) => r.restaurantId),
    couponRestaurants,
  };
}

/** ข้อความไทยสำหรับ reason (ใช้ตอบ API ให้ตรงกันทุกที่) */
export function couponUnavailableMessage(reason) {
  if (reason === "class_disabled") {
    return "คลาสนี้ปิดการใช้คูปองไว้";
  }
  if (reason === "no_coupon_restaurant") {
    return "วันนี้ไม่มีร้านคูปองเปิดให้เลือก";
  }
  return "ไม่สามารถใช้คูปองได้ในขณะนี้";
}
