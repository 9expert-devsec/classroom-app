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

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const dayParam = searchParams.get("day");

    const day = Number(dayParam);
    const hasDay = Number.isFinite(day) && day > 0;

    let targetDate = new Date();

    const applyOffset = (baseDate) => {
      const d = new Date(baseDate);
      if (hasDay) d.setDate(d.getDate() + (day - 1));
      return d;
    };

    // 1) classId
    if (classId) {
      const klass = await Class.findById(classId).select("date").lean();
      if (klass?.date) targetDate = applyOffset(klass.date);
    }
    // 2) studentId -> class
    else if (studentId) {
      const student = await Student.findById(studentId)
        .select("classId class")
        .lean();

      const cId = student?.classId || student?.class;
      if (cId) {
        const klass = await Class.findById(cId).select("date").lean();
        if (klass?.date) targetDate = applyOffset(klass.date);
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
      return NextResponse.json({ ok: true, hasFoodSetup: false, items: [] });
    }

    const restaurantIds = daySet.entries.map((e) => e.restaurant);

    const restaurants = await Restaurant.find({
      _id: { $in: restaurantIds },
      isActive: { $ne: false },
    })
      .select("name logoUrl isActive")
      .lean();

    // restaurantId -> allowed menuIds (string) based on set
    const setMenuMap = new Map();

    const setIds = daySet.entries.map((e) => e.set).filter(Boolean);
    if (setIds.length > 0) {
      const sets = await FoodSet.find({ _id: { $in: setIds } }).lean();
      const setsMap = new Map(sets.map((s) => [String(s._id), s]));

      daySet.entries.forEach((entry) => {
        if (!entry.set) return;
        const setDoc = setsMap.get(String(entry.set));
        if (!setDoc) return;

        const restKey = String(entry.restaurant);
        const menuIds = (setDoc.menuIds || []).map((id) => String(id));
        if (menuIds.length > 0) setMenuMap.set(restKey, menuIds);
      });
    }

    const activeRestaurantIds = restaurants.map((r) => r._id);

    const menus = await FoodMenu.find({
      isActive: { $ne: false },
      restaurant: { $in: activeRestaurantIds },
    })
      .select(
        "restaurant name imageUrl addons drinks addonIds drinkIds isActive",
      )
      .lean();

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
      map.set(restKey, {
        id: restKey,
        name: r.name,
        logoUrl: r.logoUrl,
        menus: [],

        // ✅ NEW: ให้ FoodPage ใช้ (master list ของร้าน)
        addons: [],
        drinks: [],
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

    const items = Array.from(map.values()).filter((r) => r.menus.length > 0);

    return NextResponse.json({ ok: true, hasFoodSetup: true, items });
  } catch (err) {
    console.error("GET /api/food/today error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
