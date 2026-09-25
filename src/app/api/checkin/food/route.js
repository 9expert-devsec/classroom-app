// src/app/api/checkin/food/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";
import FoodEditLog from "@/models/FoodEditLog";

// ✅ audit (best-effort)
import { requireAdmin } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import {
  authErrorResponse,
  requireKioskOrAdmin,
} from "@/lib/kioskAuth.server";
import { writeAuditLog } from "@/lib/auditLog.server";

import {
  getCouponAvailability,
  couponUnavailableMessage,
} from "@/lib/couponAvailability.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { classDayIndexToday } from "@/lib/classDates";
import { cancelPendingLunchOrderOnChoiceChange } from "@/lib/lunchAdmin.server";

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
  if (coupon === true || lower(choiceType) === "coupon") return "coupon";
  if (noFood === true || lower(choiceType) === "nofood") return "noFood";

  if (!clean(restaurantId) && !clean(menuId)) return "noFood";
  return "food";
}

function isObjectId(x) {
  return /^[0-9a-fA-F]{24}$/.test(clean(x));
}

// ✅ P1c: กฎเดียวสำหรับคูปอง — รวม disableCoupon ของคลาส เข้ากับ
//    "วันนั้นมีร้านคูปองที่ใช้ได้จริงไหม" ไว้ที่ couponAvailability.server.js
//
// P3c: ใช้ "วันนี้" ตามเวลาไทยเท่านั้น ไม่แตะ day ที่ client ส่งมาเลย
//      คูปองผูกกับ FoodDaySet ของวันจริง ถ้าปล่อยให้ client เลือก day ได้
//      ก็เท่ากับเลือกได้ว่าจะให้ตรวจวันไหน
//      วันนี้ไม่ใช่วันเรียนของคลาสนี้ -> เลือกคูปองไม่ได้ (not_class_day)
//
// P3g: "วันนี้คือ Day ไหน" มาจาก classDayIndexToday (helper เดียวกับเช็คอิน/lunch-token)
//      และคูปองรับได้เฉพาะเมื่อ day ที่กำลังบันทึก = วันนี้จริง (ไม่งั้น not_today)
async function checkCouponAvailability(classId, recordDay) {
  try {
    if (!isObjectId(classId)) return { available: true, reason: null };

    const cls = await Class.findById(classId)
      .select("date days dayCount duration.dayCount disableCoupon")
      .lean();
    if (!cls) return { available: true, reason: null };

    const todayDay = classDayIndexToday(cls);
    if (!todayDay) {
      return { available: false, reason: "not_class_day" };
    }
    if (Number(recordDay) !== todayDay) {
      return { available: false, reason: "not_today", todayDay };
    }

    const todayYMD = toBkkYMD(new Date());
    return await getCouponAvailability({ classDoc: cls, dayYMD: todayYMD });
  } catch (e) {
    console.warn("[food] check coupon availability failed:", e?.message || e);
    return { available: true, reason: null };
  }
}

// วันเรียนของวันนี้ของคลาส (null = ไม่ใช่วันเรียน / หาไม่ได้)
async function todayDayOfClass(classId) {
  try {
    if (!isObjectId(classId)) return null;
    const cls = await Class.findById(classId)
      .select("date days dayCount duration.dayCount")
      .lean();
    return cls ? classDayIndexToday(cls) : null;
  } catch {
    return null;
  }
}

// ✅ Masterclass ไม่มีขั้นตอนอาหาร (best-effort: ถ้าเช็คไม่ได้ = ถือว่าเป็นคลาสปกติ)
async function isMasterclassClass(classId) {
  try {
    if (!isObjectId(classId)) return false;
    const cls = await Class.findById(classId).select("classKind").lean();
    return cls?.classKind === "masterclass";
  } catch (e) {
    console.warn("[food] check classKind failed:", e?.message || e);
    return false;
  }
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

    note: clean(f.note),
  });
}

function pickFoodAudit(food) {
  const f = food || {};
  return {
    noFood: !!f.noFood,
    choiceType: clean(f.choiceType),
    classId: clean(f.classId),
    day: Number.isFinite(Number(f.day)) ? Number(f.day) : null,

    restaurantId: clean(f.restaurantId),
    menuId: clean(f.menuId),
    addonIds: uniqStrArr(f.addonIds).sort(),
    drinkId: clean(f.drinkId),

    note: clean(f.note),
  };
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.warn("[food] writeAuditLog failed:", e?.message || e);
  }
}

// 기존: FoodEditLog (ยังคงไว้)
async function writeFoodEditLog({ student, nextFood, prevFood, source = "" }) {
  try {
    const before = normalizeFoodSnapshot(prevFood);
    const after = normalizeFoodSnapshot(nextFood);
    if (before === after) return;

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
    console.warn("[food] writeFoodEditLog failed:", e?.message || e);
  }
}

// ✅ ใหม่: AuditLog (central) — best-effort และไม่ทำให้ flow พัง
async function writeFoodAuditLog({
  adminCtx,
  req,
  student,
  nextFood,
  prevFood,
  source = "",
}) {
  try {
    const before = normalizeFoodSnapshot(prevFood);
    const after = normalizeFoodSnapshot(nextFood);
    if (before === after) return;

    const sid = String(student?._id || "");
    const cid = clean(nextFood?.classId);
    const day = Number.isFinite(Number(nextFood?.day))
      ? Number(nextFood?.day)
      : null;

    await safeAudit({
      ctx: adminCtx || {},
      req,
      action: "update",
      entityType: "food",
      entityId: `${sid}__${cid || "noClass"}__day${day || 0}`,
      entityLabel:
        `${pickStudentName(student)} • food day ${day || "-"}`.trim(),
      before: pickFoodAudit(prevFood),
      after: pickFoodAudit(nextFood),
      meta: {
        studentId: sid,
        classId: cid,
        day,
        source: clean(source),
      },
      // ไม่ต้อง ignore อะไรมาก เพราะ snapshot เล็กอยู่แล้ว
      ignorePaths: [],
    });
  } catch (e) {
    console.warn("[food] writeFoodAuditLog failed:", e?.message || e);
  }
}

/* ---------------- route ---------------- */

export async function POST(req) {
  // L2a: kiosk session, or admin console with FOOD_WRITE (food report page)
  let auth;
  try {
    auth = await requireKioskOrAdmin(req, PERM.FOOD_WRITE);
  } catch (e) {
    return authErrorResponse(e);
  }

  await dbConnect();

  // ✅ optional admin context (มี cookie ก็จะ track ผู้แก้ไขได้)
  // audit ยังเหมือนเดิม: มี admin cookie เมื่อไหร่ก็บันทึกชื่อผู้แก้ไข
  let adminCtx = auth.kind === "admin" ? auth.ctx : null;
  if (!adminCtx) {
    try {
      adminCtx = await requireAdmin();
    } catch {
      adminCtx = null; // kiosk flow ก็ยังทำงานต่อ
    }
  }

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
    source = "",

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
  // P3g: ไม่ส่ง day มา -> ใช้วันเรียนของวันนี้จาก helper กลาง (เดิมใช้ค่าเก่าใน student.food)
  // ส่งมา -> เก็บตามนั้น (หน้าแก้ไขของเจ้าหน้าที่แก้ย้อนวันได้) แต่คูปองต้องเป็นวันนี้เท่านั้น
  const hasDay =
    day !== undefined && day !== null && day !== "" && Number.isFinite(Number(day));
  const safeDay = hasDay
    ? Number(day)
    : ((await todayDayOfClass(safeClassId)) ?? student.food?.day);

  // ✅ Masterclass: ปฏิเสธก่อนแตะ student.food ใด ๆ
  // (ไม่ save, ไม่ writeFoodEditLog, ไม่ writeFoodAuditLog)
  if (await isMasterclassClass(safeClassId)) {
    return NextResponse.json(
      { ok: false, error: "food_not_available_for_masterclass" },
      { status: 400 },
    );
  }

  const finalChoiceType = normalizeChoiceType({
    choiceType,
    noFood,
    coupon,
    restaurantId,
    menuId,
  });

  // ✅ กันฝั่ง server: บันทึก choiceType = "coupon" ได้เฉพาะเมื่อกฎกลางอนุญาต
  //    (คลาสไม่ได้ปิดคูปอง และวันนั้นมีร้านคูปองที่ใช้ได้จริง)
  if (finalChoiceType === "coupon") {
    const avail = await checkCouponAvailability(safeClassId, safeDay);
    if (!avail.available) {
      return NextResponse.json(
        {
          ok: false,
          error:
            avail.reason === "not_class_day"
              ? "วันนี้ไม่ใช่วันเรียนของคลาสนี้ จึงเลือกรับคูปองไม่ได้"
              : avail.reason === "not_today"
                ? "เลือกรับคูปองได้เฉพาะวันเรียนของวันนี้เท่านั้น"
                : couponUnavailableMessage(avail.reason),
          reason: avail.reason,
          ...(avail.reason === "not_today"
            ? { day: safeDay, todayDay: avail.todayDay }
            : {}),
        },
        { status: 409 },
      );
    }
  }

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

  // ✅ P3b: เคยเลือกคูปองไว้ แล้วกลับมาเปลี่ยนเป็นอย่างอื่น
  //    pending           -> ยกเลิก LunchOrder ให้อัตโนมัติ
  //    ordered / at_shop -> ห้ามเปลี่ยนเอง ต้องไปที่ Counter
  if (prevFood?.choiceType === "coupon" && finalChoiceType !== "coupon") {
    try {
      const res = await cancelPendingLunchOrderOnChoiceChange({
        studentId: String(student._id),
        classId: safeClassId,
        dayYMD: toBkkYMD(new Date()),
        req,
      });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.message, reason: res.reason },
          { status: 409 },
        );
      }
    } catch (e) {
      // ไม่ให้เรื่องคูปองไปล้มการเช็คอินทั้งอัน
      console.warn("[food] cancel lunch order failed:", e?.message || e);
    }
  }

  /* ---------------- COUPON / NO FOOD ---------------- */
  if (finalChoiceType === "coupon" || finalChoiceType === "noFood") {
    const isCoupon = finalChoiceType === "coupon";

    const nextFood = {
      noFood: true,
      coupon: isCoupon, // compat
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
    await writeFoodAuditLog({
      adminCtx,
      req,
      student,
      nextFood,
      prevFood,
      source,
    });

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
    await writeFoodAuditLog({
      adminCtx,
      req,
      student,
      nextFood,
      prevFood,
      source,
    });

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

  const hasCompleteFood = !!finalRestaurantId && !!clean(menuId) && true;

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
    await writeFoodAuditLog({
      adminCtx,
      req,
      student,
      nextFood,
      prevFood,
      source,
    });

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
  await writeFoodAuditLog({
    adminCtx,
    req,
    student,
    nextFood,
    prevFood,
    source,
  });

  return NextResponse.json({
    ok: true,
    noFood: false,
    coupon: false,
    choiceType: "food",
  });
}
