// src/lib/foodSet.server.js
// shared rules for set menus (FoodSet): name validation + calendar usage
import FoodSet from "@/models/FoodSet";
import FoodDaySet from "@/models/FoodDaySet";
import { toBkkYMD } from "@/lib/lunchConfig";

export const SET_NAME_MAX = 50;

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** trimmed, max 50, unique per restaurant (case-insensitive) */
export async function validateSetName({ restaurantId, name, excludeId }) {
  const clean = String(name || "").trim();
  if (!clean) throw httpError("กรุณากรอกชื่อชุดเมนู");
  if (clean.length > SET_NAME_MAX) {
    throw httpError(`ชื่อชุดเมนูต้องไม่เกิน ${SET_NAME_MAX} ตัวอักษร`);
  }

  const filter = {
    restaurant: restaurantId,
    name: { $regex: `^${escapeRegex(clean)}$`, $options: "i" },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await FoodSet.exists(filter)) {
    throw httpError(`มีชุดเมนูชื่อ "${clean}" ในร้านนี้แล้ว`);
  }
  return clean;
}

/**
 * Food Calendar days from today (Asia/Bangkok) onward that use this set,
 * as sorted "YYYY-MM-DD". Past days are ignored.
 */
export async function upcomingSetDays(setId) {
  const docs = await FoodDaySet.find({
    "entries.set": setId,
    dayYMD: { $gte: toBkkYMD(new Date()) },
  })
    .select("dayYMD")
    .sort({ dayYMD: 1 })
    .lean();
  return docs.map((d) => d.dayYMD);
}
