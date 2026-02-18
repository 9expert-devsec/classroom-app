// src/app/api/checkin/food/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";
import FoodEditLog from "@/models/FoodEditLog";

export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function clean(x) {
  return String(x || "").trim();
}

function lower(x) {
  return clean(x).toLowerCase();
}

function uniqStrArr(a) {
  if (!Array.isArray(a)) return [];
  return [
    ...new Set(
      a
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

function pickStudentName(st) {
  return (
    clean(st?.name) || clean(st?.thaiName) || clean(st?.engName) || "ผู้เรียน"
  );
}

function normalizeChoiceType({
  choiceType,
  noFood,
  coupon,
  restaurantId,
  menuId,
}) {
  // explicit flags มาก่อน
  if (coupon === true || lower(choiceType) === "coupon") return "coupon";
  if (noFood === true || lower(choiceType) === "nofood") return "noFood";

  // ถ้าไม่มีเมนู/ร้าน ให้ถือว่าไม่รับอาหาร (กันพัง + UI บางหน้าส่งมาไม่ครบ)
  if (!clean(restaurantId) && !clean(menuId)) return "noFood";

  // default = food
  return "food";
}

function normalizeFoodSnapshot(food) {
  const f = food || {};
  const addonIds = uniqStrArr(f.addonIds).sort();
  return JSON.stringify({
    noFood: !!f.noFood,
    choiceType: clean(f.choiceType),
    classId: clean(f.classId),
    day: Number.isFinite(Number(f.day)) ? Number(f.day) : null,

    restaurantId: clean(f.restaurantId),
    menuId: clean(f.menuId),
    addonIds,
    drinkId: clean(f.drinkId),

    // legacy (ไม่เอามาเทียบเยอะ เดี๋ยวต่างเพราะชื่อ)
    note: clean(f.note),
  });
}

async function writeFoodEditLog({ student, nextFood, prevFood, source = "" }) {
  try {
    const before = normalizeFoodSnapshot(prevFood);
    const after = normalizeFoodSnapshot(nextFood);
    if (before === after) return; // ไม่เปลี่ยนจริง → ไม่ยิง log

    await FoodEditLog.create({
      studentId: String(student?._id || ""),
      classId: clean(nextFood?.classId),
      day: Number.isFinite(Number(nextFood?.day)) ? Number(nextFood.day) : null,

      choiceType: clean(nextFood?.choiceType),
      restaurantId: clean(nextFood?.restaurantId),
      menuId: clean(nextFood?.menuId),
      addonIds: uniqStrArr(nextFood?.addonIds),
      drinkId: clean(nextFood?.drinkId),

      note: clean(nextFood?.note),

      studentName: pickStudentName(student),
      studentCompany: clean(student?.company),

      source: clean(source),
    });
  } catch (e) {
    // ไม่ให้พัง flow หลัก
    console.warn("[food] writeFoodEditLog failed:", e?.message || e);
  }
}

/* ---------------- route ---------------- */

export async function POST(req) {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    studentId,
    classId,
    day,

    // flags / mode
    noFood,
    choiceType = "",
    coupon,
    source = "", // optional: "edit-user" | "checkin" | ""

    // selections (legacy)
    restaurantId,
    menuId,
    addons = [],
    drink = "",
    note = "",

    // selections by id
    addonIds = [],
    drinkId = "",
  } = body || {};

  if (!studentId) {
    return NextResponse.json(
      { ok: false, error: "studentId is required" },
      { status: 400 },
    );
  }

  const student = await Student.findById(studentId);
  if (!student) {
    return NextResponse.json(
      { ok: false, error: "Student not found" },
      { status: 404 },
    );
  }

  const safeClassId = clean(classId) || clean(student.food?.classId);
  const safeDay = Number.isFinite(Number(day))
    ? Number(day)
    : student.food?.day;

  const finalChoiceType = normalizeChoiceType({
    choiceType,
    noFood,
    coupon,
    restaurantId,
    menuId,
  });

  const safeNote = clean(note);

  // legacy strings fallback
  const safeAddonsLegacy = Array.isArray(addons)
    ? addons
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const safeDrinkLegacy = clean(drink);

  // ids normalize
  const safeAddonIds = uniqStrArr(addonIds);
  const safeDrinkId = clean(drinkId);

  const prevFood = student.food
    ? JSON.parse(JSON.stringify(student.food))
    : null;

  /* ---------------- COUPON / NO FOOD ---------------- */
  if (finalChoiceType === "coupon" || finalChoiceType === "noFood") {
    const isCoupon = finalChoiceType === "coupon";

    const nextFood = {
      noFood: true,
      coupon: isCoupon, // เผื่อ compat
      choiceType: finalChoiceType,

      classId: safeClassId || "",
      day: Number.isFinite(Number(safeDay)) ? Number(safeDay) : undefined,

      restaurantId: "",
      menuId: "",

      addonIds: [],
      drinkId: "",

      // legacy
      addons: [],
      drink: "",

      note: safeNote || (isCoupon ? "COUPON" : "ไม่รับอาหาร"),
    };

    student.food = nextFood;
    student.markModified("food");
    await student.save();

    await writeFoodEditLog({ student, nextFood, prevFood, source });

    return NextResponse.json({
      ok: true,
      noFood: true,
      coupon: isCoupon,
      choiceType: finalChoiceType,
    });
  }

  /* ---------------- FOOD (menu validate) ---------------- */
  const menuDoc = menuId
    ? await FoodMenu.findById(menuId)
        .select("restaurant addonIds drinkIds")
        .lean()
    : null;

  if (!menuDoc) {
    // เมนูไม่ถูกต้อง → กันพังด้วย noFood
    const nextFood = {
      noFood: true,
      coupon: false,
      choiceType: "noFood",
      classId: safeClassId || "",
      day: Number.isFinite(Number(safeDay)) ? Number(safeDay) : undefined,
      restaurantId: "",
      menuId: "",
      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",
      note: safeNote || "ไม่รับอาหาร",
    };

    student.food = nextFood;
    student.markModified("food");
    await student.save();

    await writeFoodEditLog({ student, nextFood, prevFood, source });

    return NextResponse.json({ ok: true, noFood: true, choiceType: "noFood" });
  }

  // restaurantId ยึดตามเมนู
  const finalRestaurantId = String(
    menuDoc.restaurant || restaurantId || "",
  ).trim();

  // allow lists
  const allowedAddonIds = new Set(
    (menuDoc.addonIds || []).map((id) => String(id)),
  );
  const allowedDrinkIds = new Set(
    (menuDoc.drinkIds || []).map((id) => String(id)),
  );

  const finalAddonIds = safeAddonIds.filter((id) => allowedAddonIds.has(id));

  // drinkId: ต้องอยู่ใน allowed
  let finalDrinkId =
    safeDrinkId && allowedDrinkIds.has(safeDrinkId) ? safeDrinkId : "";

  // fallback map drink name -> id (เฉพาะ allowed)
  if (!finalDrinkId && safeDrinkLegacy && allowedDrinkIds.size > 0) {
    const allowedList = Array.from(allowedDrinkIds);
    const allowedDrinkDocs = await FoodDrink.find({ _id: { $in: allowedList } })
      .select("name")
      .lean();

    const hit = allowedDrinkDocs.find(
      (d) => clean(d?.name) === safeDrinkLegacy,
    );
    if (hit?._id) finalDrinkId = String(hit._id);
  }

  const needDrink = false;

  // ต้องมีเมนู + ร้าน + (ถ้าต้องเลือก drink -> ต้องมี drinkId)
  const hasCompleteFood =
    !!finalRestaurantId &&
    !!clean(menuId) &&
    true;

  if (!hasCompleteFood) {
    const nextFood = {
      noFood: true,
      coupon: false,
      choiceType: "noFood",
      classId: safeClassId || "",
      day: Number.isFinite(Number(safeDay)) ? Number(safeDay) : undefined,
      restaurantId: "",
      menuId: "",
      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",
      note: safeNote || "ไม่รับอาหาร",
    };

    student.food = nextFood;
    student.markModified("food");
    await student.save();

    await writeFoodEditLog({ student, nextFood, prevFood, source });

    return NextResponse.json({ ok: true, noFood: true, choiceType: "noFood" });
  }

  // resolve names (legacy)
  const [addonDocs, drinkDoc] = await Promise.all([
    finalAddonIds.length
      ? FoodAddon.find({ _id: { $in: finalAddonIds } })
          .select("name")
          .lean()
      : [],
    finalDrinkId
      ? FoodDrink.findById(finalDrinkId).select("name").lean()
      : null,
  ]);

  const finalAddonNames = addonDocs.map((x) => x.name).filter(Boolean);
  const finalDrinkName = drinkDoc?.name ? String(drinkDoc.name) : "";

  const nextFood = {
    noFood: false,
    coupon: false,
    choiceType: "food",

    classId: safeClassId || "",
    day: Number.isFinite(Number(safeDay)) ? Number(safeDay) : undefined,

    restaurantId: finalRestaurantId,
    menuId: String(menuId),

    addonIds: finalAddonIds,
    drinkId: finalDrinkId,

    // legacy
    addons: finalAddonNames.length ? finalAddonNames : safeAddonsLegacy,
    drink: finalDrinkName || safeDrinkLegacy,

    note: safeNote,
  };

  student.food = nextFood;
  student.markModified("food");
  await student.save();

  await writeFoodEditLog({ student, nextFood, prevFood, source });

  return NextResponse.json({
    ok: true,
    noFood: false,
    coupon: false,
    choiceType: "food",
  });
}
