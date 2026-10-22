// src/lib/foodDayOptions.server.js
//
// R4-5A: จุดเดียวที่ตอบว่า "วันนั้นคลาสนี้เลือกอาหารอะไรได้บ้าง" ตามแผน Food Calendar
//   - kiosk Step 2       : GET /api/food/today           (items เดิมทุก field)
//   - แอดมิน Food Report : GET /api/admin/food/day-options (toModalOptions)
//   - ตรวจตอนบันทึก       : POST /api/checkin/food        (validateFoodChoice)
// ห้ามเขียนกฎแผนวันซ้ำที่อื่น — ย้ายมาจาก /api/food/today ตรง ๆ (พฤติกรรม kiosk เดิม)
//
// กติกา (เหมือน kiosk เดิม):
//   - ไม่มี FoodDaySet / ไม่มี entry -> ไม่มีร้าน Set (hasFoodSetup = false)
//   - เฉพาะ entry mode "set" (entry เก่าที่ไม่มี mode = set) · coupon/closed ไม่เข้ารายการ Set
//   - ร้านต้อง isActive != false · เมนูต้อง isActive != false
//   - entry ผูก FoodSet ที่มีเมนู -> เฉพาะเมนูในชุดนั้น · ไม่ผูก/ชุดว่าง -> ทุกเมนูที่เปิดของร้าน
//   - add-on / เครื่องดื่มของเมนู = addonIds/drinkIds ของเมนูที่ยังเปิดอยู่ (isActive != false)
//   - คูปอง = getCouponAvailability (disableCoupon ของคลาส + ร้านคูปองในแผน + stock)

import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodSet from "@/models/FoodSet";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";
import Class from "@/models/Class";

import {
  resolveClassDayYMD,
  getDaySet,
  getCouponAvailability,
  couponUnavailableMessage,
} from "@/lib/couponAvailability.server";

export const NO_SET_IN_PLAN_MESSAGE = "วันนี้ไม่มีร้าน Set ในแผน Food Calendar";

const CLASS_SELECT =
  "date days dayCount duration.dayCount courseName customCourseName classImageUrl disableCoupon classKind";

const byName = (x, y) => String(x.name || "").localeCompare(String(y.name || ""));

/**
 * ร้าน Set + เมนูของวันนั้น (รูปแบบ items เดิมของ /api/food/today)
 * [{ id, name, logoUrl, menus:[{ id, name, imageUrl, addonIds, drinkIds, addons, drinks }],
 *    addons:[{id,name,imageUrl}], drinks:[{id,name,imageUrl}] }]
 */
async function buildSetItems(daySet) {
  const setEntries = (daySet?.entries || []).filter(
    (e) => (e.mode || "set") === "set",
  );
  if (setEntries.length === 0) return [];

  const restaurants = await Restaurant.find({
    _id: { $in: setEntries.map((e) => e.restaurant) },
    isActive: { $ne: false },
  })
    .select("name logoUrl isActive")
    .lean();

  // restaurantId -> allowed menuIds (string) based on set
  const setMenuMap = new Map();
  const setIds = setEntries.map((e) => e.set).filter(Boolean);
  if (setIds.length > 0) {
    const sets = await FoodSet.find({ _id: { $in: setIds } }).lean();
    const setsMap = new Map(sets.map((s) => [String(s._id), s]));
    setEntries.forEach((entry) => {
      if (!entry.set) return;
      const setDoc = setsMap.get(String(entry.set));
      if (!setDoc) return;
      const menuIds = (setDoc.menuIds || []).map((id) => String(id));
      if (menuIds.length > 0) setMenuMap.set(String(entry.restaurant), menuIds);
    });
  }

  const menus = await FoodMenu.find({
    isActive: { $ne: false },
    restaurant: { $in: restaurants.map((r) => r._id) },
  })
    .select("restaurant name imageUrl addons drinks addonIds drinkIds isActive")
    .lean();

  const inPlan = (m) => {
    const allowed = setMenuMap.get(String(m.restaurant));
    return !(Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(String(m._id)));
  };
  const planMenus = menus.filter(inPlan);

  // ดึง add-on/drink เฉพาะที่ถูกอ้างอิงโดยเมนูวันนี้
  const allAddonIds = new Set();
  const allDrinkIds = new Set();
  for (const m of planMenus) {
    (m.addonIds || []).forEach((id) => allAddonIds.add(String(id)));
    (m.drinkIds || []).forEach((id) => allDrinkIds.add(String(id)));
  }

  const [addonDocs, drinkDocs] = await Promise.all([
    allAddonIds.size
      ? FoodAddon.find({ _id: { $in: [...allAddonIds] }, isActive: { $ne: false } })
          .select("name imageUrl")
          .lean()
      : [],
    allDrinkIds.size
      ? FoodDrink.find({ _id: { $in: [...allDrinkIds] }, isActive: { $ne: false } })
          .select("name imageUrl")
          .lean()
      : [],
  ]);
  const addonById = new Map(addonDocs.map((a) => [String(a._id), a]));
  const drinkById = new Map(drinkDocs.map((d) => [String(d._id), d]));

  const map = new Map();
  const restAddonIds = new Map();
  const restDrinkIds = new Map();
  restaurants.forEach((r) => {
    const key = String(r._id);
    map.set(key, { id: key, name: r.name, logoUrl: r.logoUrl, menus: [], addons: [], drinks: [] });
    restAddonIds.set(key, new Set());
    restDrinkIds.set(key, new Set());
  });

  planMenus.forEach((m) => {
    const key = String(m.restaurant);
    if (!map.has(key)) return;
    (m.addonIds || []).forEach((id) => restAddonIds.get(key).add(String(id)));
    (m.drinkIds || []).forEach((id) => restDrinkIds.get(key).add(String(id)));
    map.get(key).menus.push({
      id: String(m._id),
      name: m.name,
      imageUrl: m.imageUrl,
      addonIds: (m.addonIds || []).map((x) => String(x)),
      drinkIds: (m.drinkIds || []).map((x) => String(x)),
      // legacy compat
      addons: m.addons || [],
      drinks: m.drinks || [],
    });
  });

  const toOpts = (ids, byId) =>
    [...ids]
      .map((id) => {
        const doc = byId.get(String(id));
        return doc ? { id: String(id), name: doc.name, imageUrl: doc.imageUrl || "" } : null;
      })
      .filter(Boolean)
      .sort(byName);

  for (const [key, rest] of map.entries()) {
    rest.addons = toOpts(restAddonIds.get(key), addonById);
    rest.drinks = toOpts(restDrinkIds.get(key), drinkById);
  }

  return Array.from(map.values()).filter((r) => r.menus.length > 0);
}

/**
 * ตัวเลือกอาหารของคลาส/วันตามแผน Food Calendar
 * ส่ง classDoc (lean, มี date/days/disableCoupon) หรือ classId · day (1-based) หรือ dayYMD ตรง ๆ
 * ไม่มีคลาส -> วันนี้ (Bangkok) ตาม dayYMD ที่ส่งมา
 * @returns {{ classDoc, dayYMD, daySet, hasFoodSetup, items, coupon }}
 *   coupon = ผลของ getCouponAvailability (ยังไม่รวมกฎ 15:00 — ผู้เรียกตัดสินเอง)
 */
export async function getFoodDayOptions({
  classDoc,
  classId,
  day,
  dayYMD,
  includeCoupon = true, // false = ข้ามการนับ stock คูปอง (ตรวจ Set อย่างเดียว) -> coupon = null
} = {}) {
  let cls = classDoc || null;
  if (!cls && classId) {
    cls = await Class.findById(classId).select(CLASS_SELECT).lean();
  }

  const ymd =
    dayYMD || (cls ? resolveClassDayYMD(cls, Number(day) > 0 ? Number(day) : 1) : "");

  const daySet = await getDaySet(ymd);
  const coupon = includeCoupon
    ? await getCouponAvailability({ classDoc: cls, dayYMD: ymd, daySet })
    : null;

  const hasFoodSetup =
    !!daySet && Array.isArray(daySet.entries) && daySet.entries.length > 0;
  const items = hasFoodSetup ? await buildSetItems(daySet) : [];

  return { classDoc: cls, dayYMD: ymd, daySet, hasFoodSetup, items, coupon };
}

/** add-on / เครื่องดื่มที่เมนูนี้เลือกได้จริง (เมนูอ้างถึง และยังเปิดอยู่) */
export function menuAllowedOptions(restaurant, menu) {
  const addonIds = new Set((menu?.addonIds || []).map(String));
  const drinkIds = new Set((menu?.drinkIds || []).map(String));
  return {
    addons: (restaurant?.addons || []).filter((a) => addonIds.has(String(a.id))),
    drinks: (restaurant?.drinks || []).filter((d) => drinkIds.has(String(d.id))),
  };
}

/** รูปแบบสำหรับโมดัลแก้ไขอาหารของแอดมิน (Food Report) */
export function toModalOptions({ items, coupon }) {
  const restaurants = (items || []).map((r) => ({
    id: r.id,
    name: r.name,
    menus: r.menus.map((m) => {
      const { addons, drinks } = menuAllowedOptions(r, m);
      return {
        id: m.id,
        name: m.name,
        addons: addons.map(({ id, name }) => ({ id, name })),
        drinks: drinks.map(({ id, name }) => ({ id, name })),
      };
    }),
  }));
  const setAvailable = restaurants.length > 0;
  const openCoupon = (coupon?.couponRestaurants || []).filter((r) => r.open);

  return {
    set: {
      available: setAvailable,
      reason: setAvailable ? null : NO_SET_IN_PLAN_MESSAGE,
      restaurants,
    },
    coupon: {
      available: !!coupon?.available,
      reason: coupon?.available ? null : couponUnavailableMessage(coupon?.reason),
      restaurants: openCoupon.map((r) => r.name).filter(Boolean),
    },
    noFood: { available: true },
  };
}

/**
 * ตรวจตัวเลือก Set กับแผนของวัน — null = ผ่าน, { reason, error } = ไม่อยู่ในแผน (ตอบ 409)
 * restaurantId ว่างได้ (ยึดร้านของเมนู) แต่ถ้าส่งมาต้องตรงกับร้านของเมนู
 */
export function validateSetChoice({ items }, { restaurantId, menuId, addonIds = [], drinkId = "" }) {
  const rid = String(restaurantId || "").trim();
  const mid = String(menuId || "").trim();

  const restaurant = rid
    ? (items || []).find((r) => r.id === rid)
    : (items || []).find((r) => r.menus.some((m) => m.id === mid));
  if (!restaurant) {
    return {
      reason: "restaurant_not_in_plan",
      error: "ร้านนี้ไม่อยู่ในแผน Food Calendar ของวันนี้ (หรือปิดรับวันนี้)",
    };
  }

  const menu = restaurant.menus.find((m) => m.id === mid);
  if (!menu) {
    return {
      reason: "menu_not_in_plan",
      error: "เมนูนี้ไม่อยู่ในชุดเมนู Set ของวันนี้",
    };
  }

  const allowed = menuAllowedOptions(restaurant, menu);
  const addonOk = new Set(allowed.addons.map((a) => a.id));
  if ((addonIds || []).some((id) => !addonOk.has(String(id)))) {
    return {
      reason: "addon_not_allowed",
      error: "Add-on ที่เลือกใช้กับเมนูนี้ไม่ได้",
    };
  }

  const did = String(drinkId || "").trim();
  if (did && !allowed.drinks.some((d) => d.id === did)) {
    return {
      reason: "drink_not_allowed",
      error: "เครื่องดื่มที่เลือกใช้กับเมนูนี้ไม่ได้",
    };
  }

  return null;
}
