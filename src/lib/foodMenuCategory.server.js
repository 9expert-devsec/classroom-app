// src/lib/foodMenuCategory.server.js
// shared validation for menu categories (create + rename)
import FoodMenuCategory from "@/models/FoodMenuCategory";

export const CATEGORY_NAME_MAX = 50;

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trim + length check + unique within the shop (case-insensitive).
 * excludeId: the category being renamed.
 */
export async function validateCategoryName({ restaurantId, name, excludeId }) {
  const clean = String(name || "").trim();
  if (!clean) throw httpError("กรุณากรอกชื่อหมวดหมู่");
  if (clean.length > CATEGORY_NAME_MAX) {
    throw httpError(`ชื่อหมวดหมู่ต้องไม่เกิน ${CATEGORY_NAME_MAX} ตัวอักษร`);
  }

  const filter = {
    restaurant: restaurantId,
    name: { $regex: `^${escapeRegex(clean)}$`, $options: "i" },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const taken = await FoodMenuCategory.exists(filter);
  if (taken) throw httpError(`มีหมวดหมู่ชื่อ "${clean}" ในร้านนี้แล้ว`, 409);

  return clean;
}
