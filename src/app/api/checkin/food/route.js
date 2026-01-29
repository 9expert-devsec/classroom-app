// src/app/api/checkin/food/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

export const dynamic = "force-dynamic";

export async function POST(req) {
  await dbConnect();

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const {
    studentId,
    classId,
    day,

    // flags
    noFood,
    choiceType = "",
    coupon, // ✅ NEW

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

  const safeNote = note ? String(note) : "";
  const safeClassId = classId ? String(classId) : "";
  const safeDay = Number.isFinite(Number(day)) ? Number(day) : undefined;

  const isCoupon =
    coupon === true || String(choiceType || "").toLowerCase() === "coupon";
  const isNoFood =
    noFood === true || String(choiceType || "").toLowerCase() === "nofood";

  // normalize ids
  const safeAddonIds = Array.isArray(addonIds)
    ? addonIds.map(String).filter(Boolean)
    : [];

  const safeDrinkId = drinkId ? String(drinkId) : "";

  // legacy strings fallback (เผื่อบาง UI ยังส่งแบบเก่า)
  const safeAddonsLegacy = Array.isArray(addons)
    ? addons.map(String).filter(Boolean)
    : [];
  const safeDrinkLegacy = drink ? String(drink) : "";

  /* ---------------- COUPON ----------------
     coupon = เลือกคูปอง -> ไปเซ็นได้เลย
     (ไม่ต้องมี restaurant/menu/addon/drink)
  ---------------------------------------- */
  if (isCoupon || isNoFood || (!restaurantId && !menuId)) {
    const finalChoice = isCoupon ? "coupon" : "noFood";
    student.food = {
      noFood: true,
      choiceType: finalChoice,
      classId: safeClassId || student.food?.classId || "",
      day: Number.isFinite(safeDay) ? safeDay : student.food?.day,

      restaurantId: "",
      menuId: "",

      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",

      note: safeNote || (finalChoice === "coupon" ? "COUPON" : "ไม่รับอาหาร"),
    };
    await student.save();
    return NextResponse.json({
      ok: true,
      noFood: true,
      choiceType: finalChoice,
    });
  }

  /* ---------------- NO FOOD ---------------- */
  // ✅ ตัดสิน noFood เบื้องต้น
  // - noFood === true -> no food
  // - ถ้าไม่มี restaurantId/menuId เลย -> no food
  const baseNoFood = noFood === true || (!restaurantId && !menuId);

  if (baseNoFood) {
    student.food = {
      noFood: true,
      coupon: false,
      choiceType: "noFood",

      classId: safeClassId || student.food?.classId || "",
      day: Number.isFinite(safeDay) ? safeDay : student.food?.day,

      restaurantId: "",
      menuId: "",

      // keep both new+legacy empty
      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",

      note: safeNote || "ไม่รับอาหาร",
    };

    await student.save();
    return NextResponse.json({
      ok: true,
      noFood: true,
      coupon: false,
      choiceType: "noFood",
    });
  }

  /* ---------------- FOOD (menu validate) ---------------- */
  // ✅ ถ้ามีเมนู -> validate ว่าตัวเลือก add-on/drink อยู่ในเมนูจริง
  const menuDoc = menuId
    ? await FoodMenu.findById(menuId)
        .select("restaurant addonIds drinkIds")
        .lean()
    : null;

  if (!menuDoc) {
    // เมนูไม่ถูกต้อง → บันทึกเป็น noFood เพื่อกันพัง
    student.food = {
      noFood: true,
      choiceType: "noFood",
      classId: safeClassId || student.food?.classId || "",
      day: Number.isFinite(safeDay) ? safeDay : student.food?.day,
      restaurantId: "",
      menuId: "",
      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",
      note: safeNote || "ไม่รับอาหาร",
    };
    await student.save();
    return NextResponse.json({ ok: true, noFood: true, choiceType: "noFood" });
  }

  // ถ้า restaurantId ส่งมาไม่ตรงเมนู ให้ใช้ของเมนูเป็นหลัก
  const finalRestaurantId = String(menuDoc.restaurant || restaurantId || "");

  // allowed lists
  const allowedAddonIds = new Set(
    (menuDoc.addonIds || []).map((id) => String(id)),
  );
  const allowedDrinkIds = new Set(
    (menuDoc.drinkIds || []).map((id) => String(id)),
  );

  const finalAddonIds = safeAddonIds.filter((id) => allowedAddonIds.has(id));
  let finalDrinkId =
    safeDrinkId && allowedDrinkIds.has(safeDrinkId) ? safeDrinkId : "";

  // ✅ fallback: ถ้าไม่มี drinkId แต่มี drink (ชื่อ) ให้พยายาม map ชื่อ -> id (เฉพาะใน allowed list)
  const safeDrinkName = String(safeDrinkLegacy || "").trim();
  if (!finalDrinkId && safeDrinkName && allowedDrinkIds.size > 0) {
    const allowedList = Array.from(allowedDrinkIds);
    const allowedDrinkDocs = await FoodDrink.find({ _id: { $in: allowedList } })
      .select("name")
      .lean();

    const hit = allowedDrinkDocs.find(
      (d) => String(d?.name || "").trim() === safeDrinkName,
    );

    if (hit?._id) finalDrinkId = String(hit._id);
  }

  // ✅ กติกา: ลูกค้าเลือก drink ได้ 1 อย่าง
  // ถ้าเมนูมี drink options -> ต้องเลือก 1
  const needDrink = (menuDoc.drinkIds || []).length > 0;
  const hasCompleteFood =
    !!finalRestaurantId && !!menuId && (needDrink ? !!finalDrinkId : true);

  const finalNoFood = !hasCompleteFood;

  if (finalNoFood) {
    student.food = {
      noFood: true,
      coupon: false,
      choiceType: "noFood",

      classId: safeClassId || student.food?.classId || "",
      day: Number.isFinite(safeDay) ? safeDay : student.food?.day,

      restaurantId: "",
      menuId: "",
      addonIds: [],
      drinkId: "",
      addons: [],
      drink: "",
      note: safeNote || "ไม่รับอาหาร",
    };

    await student.save();
    return NextResponse.json({
      ok: true,
      noFood: true,
      coupon: false,
      choiceType: "noFood",
    });
  }

  // ✅ resolve names เพื่อเก็บ legacy string ให้ report เดิมใช้ได้
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

  student.food = {
    noFood: false,
    choiceType: "food",
    classId: safeClassId || student.food?.classId || "",
    day: Number.isFinite(safeDay) ? safeDay : student.food?.day,

    restaurantId: finalRestaurantId,
    menuId: String(menuId),

    addonIds: finalAddonIds,
    drinkId: finalDrinkId,

    // legacy
    addons: finalAddonNames.length ? finalAddonNames : safeAddonsLegacy,
    drink: finalDrinkName || safeDrinkLegacy,

    note: safeNote,
  };

  await student.save();
  return NextResponse.json({
    ok: true,
    noFood: false,
    coupon: false,
    choiceType: "food",
  });
}
