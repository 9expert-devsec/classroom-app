// /api/food/today/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import FoodDaySet from "@/models/FoodDaySet";
import FoodSet from "@/models/FoodSet";
import Student from "@/models/Student";
import Class from "@/models/Class";

import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

function normalizeDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toStr(x) {
  return x == null ? "" : String(x);
}

function buildCurrentFood(studentDoc) {
  const f = studentDoc?.food || {};
  const choiceType = toStr(f.choiceType || "");
  const restaurantId = toStr(f.restaurantId || "");
  const menuId = toStr(f.menuId || "");
  const addonIds = Array.isArray(f.addonIds)
    ? f.addonIds.map((x) => toStr(x))
    : [];
  const drinkId = toStr(f.drinkId || "");
  const note = toStr(f.note || "");
  const noFood = !!f.noFood;

  return {
    choiceType,
    restaurantId,
    menuId,
    addonIds,
    drinkId,
    note,
    noFood,
  };
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const dayParam = searchParams.get("day");

    const day = Number(dayParam);
    const hasDay = Number.isFinite(day) && day > 0;

    // ---------------------------
    // ✅ NEW: currentFood (prefill)
    // ---------------------------
    let currentFood = null;
    if (studentId) {
      const stu = await Student.findById(studentId).select("food").lean();
      if (stu) currentFood = buildCurrentFood(stu);
    }

    let targetDate = new Date();
    let classInfo = {
      courseName: "",
      classImageUrl: "",
      days: [],
      disableCoupon: false,
      classKind: "normal",
    };

    const applyOffset = (baseDate) => {
      const d = new Date(baseDate);
      if (hasDay) d.setDate(d.getDate() + (day - 1));
      return d;
    };

    const buildClassInfo = (klass) => ({
      courseName: klass?.customCourseName || klass?.courseName || "",
      classImageUrl: klass?.classImageUrl || "",
      days: Array.isArray(klass?.days) ? klass.days : [],
      disableCoupon: !!klass?.disableCoupon,
      classKind: klass?.classKind || "normal",
    });

    // 1) classId
    if (classId) {
      const klass = await Class.findById(classId)
        .select(
          "date days courseName customCourseName classImageUrl disableCoupon classKind",
        )
        .lean();
      if (klass?.date) targetDate = applyOffset(klass.date);
      if (klass) classInfo = buildClassInfo(klass);
    }
    // 2) studentId -> class
    else if (studentId) {
      const student = await Student.findById(studentId)
        .select("classId class")
        .lean();

      const cId = student?.classId || student?.class;
      if (cId) {
        const klass = await Class.findById(cId)
          .select(
            "date days courseName customCourseName classImageUrl disableCoupon classKind",
          )
          .lean();
        if (klass?.date) targetDate = applyOffset(klass.date);
        if (klass) classInfo = buildClassInfo(klass);
      }
    }
    // 3) only day
    else if (hasDay) {
      targetDate = applyOffset(targetDate);
    }

    const dayStart = normalizeDay(targetDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const daySet = await FoodDaySet.findOne({
      date: { $gte: dayStart, $lt: dayEnd },
    }).lean();

    // ✅ RULE: ถ้าไม่มีการตั้งค่าใน Calendar → ไม่มีร้าน/เมนูวันนี้
    if (
      !daySet ||
      !Array.isArray(daySet.entries) ||
      daySet.entries.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        hasFoodSetup: false,
        items: [],
        currentFood, // ✅ still return
        classInfo,
      });
    }

    // ✅ class-level exception: class นี้ห้ามใช้คูปอง → ตัด entry ที่เป็น coupon ทิ้งตั้งแต่ตรงนี้
    // (นี่คือจุดเดียวที่ disableCoupon มีผลตอนอ่าน; class อื่นวันเดียวกันยังเห็นตามปกติ)
    const dayEntries = classInfo.disableCoupon
      ? daySet.entries.filter((en) => en.mode !== "coupon")
      : daySet.entries;

    // restKey -> true เมื่อวันนี้ร้านนั้น "เป็นคูปอง"
    const couponRestKeys = new Set(
      dayEntries
        .filter((en) => en.mode === "coupon")
        .map((en) => String(en.restaurant)),
    );

    const restaurantIds = dayEntries.map((e) => e.restaurant);

    const restaurants = await Restaurant.find({
      _id: { $in: restaurantIds },
      isActive: { $ne: false },
    })
      .select("name logoUrl isActive couponLabel couponAmount")
      .lean();

    // restaurantId -> allowed menuIds (string) based on set
    const setMenuMap = new Map();

    // coupon entry ไม่ต้อง resolve FoodSet เลย
    const setIds = dayEntries
      .filter((e) => e.mode !== "coupon")
      .map((e) => e.set)
      .filter(Boolean);
    if (setIds.length > 0) {
      const sets = await FoodSet.find({ _id: { $in: setIds } }).lean();
      const setsMap = new Map(sets.map((s) => [String(s._id), s]));

      dayEntries.forEach((entry) => {
        if (entry.mode === "coupon" || !entry.set) return;
        const setDoc = setsMap.get(String(entry.set));
        if (!setDoc) return;

        const restKey = String(entry.restaurant);
        const menuIds = (setDoc.menuIds || []).map((id) => String(id));
        if (menuIds.length > 0) setMenuMap.set(restKey, menuIds);
      });
    }

    // coupon restaurant ไม่ดึงเมนู/add-on/drink เลย
    const activeRestaurantIds = restaurants
      .filter((r) => !couponRestKeys.has(String(r._id)))
      .map((r) => r._id);

    const menus = activeRestaurantIds.length
      ? await FoodMenu.find({
          isActive: { $ne: false },
          restaurant: { $in: activeRestaurantIds },
        })
          .select(
            "restaurant name imageUrl addons drinks addonIds drinkIds isActive",
          )
          .lean()
      : [];

    // ✅ ดึง add-on/drink เฉพาะที่ถูก “อ้างอิงโดยเมนูวันนี้” เพื่อไม่ให้ query หนัก
    const allAddonIds = new Set();
    const allDrinkIds = new Set();

    for (const m of menus) {
      const restKey = String(m.restaurant);
      const allowedMenuIds = setMenuMap.get(restKey);
      if (Array.isArray(allowedMenuIds) && allowedMenuIds.length > 0) {
        if (!allowedMenuIds.includes(String(m._id))) continue;
      }
      (m.addonIds || []).forEach((id) => allAddonIds.add(String(id)));
      (m.drinkIds || []).forEach((id) => allDrinkIds.add(String(id)));
    }

    const [addonDocs, drinkDocs] = await Promise.all([
      allAddonIds.size
        ? FoodAddon.find({
            _id: { $in: [...allAddonIds] },
            isActive: { $ne: false },
          })
            .select("name imageUrl")
            .lean()
        : [],
      allDrinkIds.size
        ? FoodDrink.find({
            _id: { $in: [...allDrinkIds] },
            isActive: { $ne: false },
          })
            .select("name imageUrl")
            .lean()
        : [],
    ]);

    const addonById = new Map(addonDocs.map((a) => [String(a._id), a]));
    const drinkById = new Map(drinkDocs.map((d) => [String(d._id), d]));

    // ✅ สร้าง output map (ต่อร้าน) + เตรียม set สำหรับรวม addons/drinks ของร้านนั้น ๆ
    const map = new Map();
    const restaurantAddonIdsMap = new Map(); // restKey -> Set(addonId)
    const restaurantDrinkIdsMap = new Map(); // restKey -> Set(drinkId)

    restaurants.forEach((r) => {
      const restKey = String(r._id);
      const isCoupon = couponRestKeys.has(restKey);
      map.set(restKey, {
        id: restKey,
        name: r.name,
        logoUrl: r.logoUrl,
        menus: [],

        // ✅ NEW: ให้ FoodPage ใช้ (master list ของร้าน)
        addons: [],
        drinks: [],

        // ✅ coupon-as-restaurant (มาจาก FoodDaySet.entries[].mode)
        isCoupon,
        couponLabel: isCoupon ? r.couponLabel || "Cash Coupon" : "",
        couponAmount: isCoupon ? Number(r.couponAmount) || 0 : 0,
      });
      restaurantAddonIdsMap.set(restKey, new Set());
      restaurantDrinkIdsMap.set(restKey, new Set());
    });

    // ✅ ใส่เมนู + สะสม addonIds/drinkIds ต่อร้าน
    menus.forEach((m) => {
      const restKey = String(m.restaurant);
      if (!map.has(restKey)) return;

      const allowedMenuIds = setMenuMap.get(restKey);
      if (
        Array.isArray(allowedMenuIds) &&
        allowedMenuIds.length > 0 &&
        !allowedMenuIds.includes(String(m._id))
      ) {
        return;
      }

      // สะสม id ต่อร้าน (union)
      const aSet = restaurantAddonIdsMap.get(restKey);
      const dSet = restaurantDrinkIdsMap.get(restKey);
      (m.addonIds || []).forEach((id) => aSet?.add(String(id)));
      (m.drinkIds || []).forEach((id) => dSet?.add(String(id)));

      map.get(restKey).menus.push({
        id: String(m._id),
        name: m.name,
        imageUrl: m.imageUrl,

        // ✅ new: ผูกจริงรายเมนู
        addonIds: (m.addonIds || []).map((x) => String(x)),
        drinkIds: (m.drinkIds || []).map((x) => String(x)),

        // legacy compat
        addons: m.addons || [],
        drinks: m.drinks || [],
      });
    });

    // ✅ สร้าง restaurant.addons / restaurant.drinks จาก union set
    for (const [restKey, restObj] of map.entries()) {
      const aSet = restaurantAddonIdsMap.get(restKey) || new Set();
      const dSet = restaurantDrinkIdsMap.get(restKey) || new Set();

      const addons = [...aSet]
        .map((id) => {
          const doc = addonById.get(String(id));
          if (!doc) return null;
          return {
            id: String(id),
            name: doc.name,
            imageUrl: doc.imageUrl || "",
          };
        })
        .filter(Boolean)
        .sort((x, y) =>
          String(x.name || "").localeCompare(String(y.name || "")),
        );

      const drinks = [...dSet]
        .map((id) => {
          const doc = drinkById.get(String(id));
          if (!doc) return null;
          return {
            id: String(id),
            name: doc.name,
            imageUrl: doc.imageUrl || "",
          };
        })
        .filter(Boolean)
        .sort((x, y) =>
          String(x.name || "").localeCompare(String(y.name || "")),
        );

      restObj.addons = addons;
      restObj.drinks = drinks;
    }

    // ✅ coupon restaurant ไม่มีเมนู แต่ต้องไม่ถูกตัดทิ้ง
    const items = Array.from(map.values()).filter(
      (r) => r.menus.length > 0 || r.isCoupon,
    );

    return NextResponse.json({
      ok: true,
      hasFoodSetup: true,
      items,
      currentFood, // ✅ NEW
      classInfo,
    });
  } catch (err) {
    console.error("GET /api/food/today error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
