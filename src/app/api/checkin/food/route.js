// src/app/api/checkin/food/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Student from "@/models/Student";
import Class from "@/models/Class";
import FoodMenu from "@/models/FoodMenu";
import FoodAddon from "@/models/FoodAddon";
import FoodDrink from "@/models/FoodDrink";

import { PERM } from "@/lib/acl";
import {
  authErrorResponse,
  requireKioskOrAdmin,
  kioskAuditCtx,
} from "@/lib/kioskAuth.server";

import {
  getCouponAvailability,
  couponUnavailableMessage,
} from "@/lib/couponAvailability.server";
import { toBkkYMD, isCouponClosedFor } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";
import { todayClassDayOf } from "@/lib/lunchChoice";
import { LunchAdminError } from "@/lib/lunchAdmin.server";
// R2a: ตัวเลือกอาหาร + ออเดอร์ (log / audit อยู่ในนี้ด้วย)
import { changeFoodChoice } from "@/lib/lunchActions.server";
import { stripAutoNote } from "@/lib/foodNotes";

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

    // R4L-2: นาฬิกาเดียวกับระบบ lunch (lunchNow) — production เหมือนเดิม
    const now = lunchNow();
    const todayDay = todayClassDayOf(cls, now);
    if (!todayDay) {
      return { available: false, reason: "not_class_day" };
    }
    if (Number(recordDay) !== todayDay) {
      return { available: false, reason: "not_today", todayDay };
    }

    const todayYMD = toBkkYMD(now);
    return await getCouponAvailability({ classDoc: cls, dayYMD: todayYMD });
  } catch (e) {
    console.warn("[food] check coupon availability failed:", e?.message || e);
    return { available: true, reason: null };
  }
}

// วันเรียนของวันนี้ของคลาส (null = ไม่ใช่วันเรียน / หาไม่ได้)
// R4L-2: todayClassDayOf = นาฬิกา lunchNow เดียวกับ todayFoodOf
async function todayDayOfClass(classId) {
  try {
    if (!isObjectId(classId)) return null;
    const cls = await Class.findById(classId)
      .select("date days dayCount duration.dayCount")
      .lean();
    return cls ? todayClassDayOf(cls) : null;
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

  // R2a: actor ของ audit — แท็บเล็ต = ตัวแท็บเล็ตเสมอ (ไม่หยิบ admin cookie
  //      ที่บังเอิญอยู่ใน browser เดียวกัน) · แอดมินจาก Food Report = แอดมินคนนั้น
  const actorCtx = auth.kind === "admin" ? auth.ctx : kioskAuditCtx(auth.session);

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

  // R4L-2: ไม่ส่ง classId มา -> คลาสของผู้เรียนคนนี้ (Student 1 เอกสารต่อ 1 คลาส)
  //         ไม่ใช้ student.food.classId (ค่าที่ค้างจากตัวเลือกเดิม)
  const safeClassId = clean(classId) || clean(student.classId);
  // P3g: ไม่ส่ง day มา -> ใช้วันเรียนของวันนี้จาก helper กลาง
  // R4L-2: ไม่มี fallback ไปที่ student.food.day แล้ว — หาวันของวันนี้ไม่ได้ = ไม่บันทึก
  // R4-1A: แก้ได้เฉพาะ "วันนี้" ทั้ง kiosk และแอดมิน — ส่ง day อื่นมา = 409 (วันที่ผ่านมาแก้ไม่ได้)
  const hasDay =
    day !== undefined && day !== null && day !== "" && Number.isFinite(Number(day));
  const todayDay = await todayDayOfClass(safeClassId);
  const safeDay = hasDay ? Number(day) : todayDay;

  // ✅ Masterclass: ปฏิเสธก่อนแตะ student.food ใด ๆ
  // (ไม่ save, ไม่ writeFoodEditLog, ไม่ writeFoodAuditLog)
  if (await isMasterclassClass(safeClassId)) {
    return NextResponse.json(
      { ok: false, error: "food_not_available_for_masterclass" },
      { status: 400 },
    );
  }

  if (!todayDay) {
    return NextResponse.json(
      {
        ok: false,
        error: "วันนี้ไม่ใช่วันเรียนของคลาสนี้ จึงบันทึกตัวเลือกอาหารไม่ได้",
        reason: "not_class_day",
      },
      { status: 409 },
    );
  }
  if (safeDay !== todayDay) {
    return NextResponse.json(
      {
        ok: false,
        error: "แก้ไขได้เฉพาะตัวเลือกอาหารของวันนี้",
        reason: "not_today",
        day: safeDay,
        todayDay,
      },
      { status: 409 },
    );
  }

  const finalChoiceType = normalizeChoiceType({
    choiceType,
    noFood,
    coupon,
    restaurantId,
    menuId,
  });

  // C2: ถึง 15:00 แล้วเลือก Cash Coupon ไม่ได้ — ปฏิเสธก่อนเขียนอะไรทั้งนั้น
  // C3a: เฉพาะแท็บเล็ต (session kiosk) — แอดมินจาก Food Report (session แอดมิน + FOOD_WRITE)
  //      บันทึก coupon ได้ทุกเวลา route นี้ไม่ออก lunch order/QR อยู่แล้วไม่ว่าใครเรียก
  //      (QR ออกที่ /api/checkin/lunch-token ซึ่งรับเฉพาะ session kiosk)
  if (finalChoiceType === "coupon") {
    const now = lunchNow();
    if (isCouponClosedFor(auth.kind, toBkkYMD(now), now)) {
      return NextResponse.json(
        {
          ok: false,
          error: couponUnavailableMessage("coupon_closed"),
          reason: "coupon_closed",
        },
        { status: 403 },
      );
    }
  }

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

  // R1: โน้ตอัตโนมัติ ("COUPON" / "ไม่รับอาหาร") จาก client ไหนก็ตามถูกตัดทิ้ง
  // R2b: ไม่เติมโน้ตอัตโนมัติกลับลงไปอีก — หมายเหตุเก็บเฉพาะที่คนพิมพ์ ตัวเลือกดูจาก choiceType
  //     (กัน noFood / food ที่ติดโน้ต "COUPON" ค้างมาจากตัวเลือกเดิม)
  const safeNote = stripAutoNote(note);

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
  //    ordered / at_shop -> ห้ามเปลี่ยนเอง ต้องไปที่ Counter (409 order_locked)
  //    R1: ยกเลิกไม่สำเร็จ -> ไม่บันทึกตัวเลือกใหม่ (500 lunch_cancel_failed)
  // R2a (R-i): ทั้งหมดอยู่ใน changeFoodChoice — ยกเลิกใบ + บันทึก Student.food ใน transaction เดียว
  //            log / audit เขียนหลัง commit · null = สำเร็จ, Response = ตอบกลับทันที
  const saveChoice = async (nextFood) => {
    try {
      await changeFoodChoice({
        student,
        classId: safeClassId,
        nextFood,
        prevFood,
        ctx: actorCtx,
        req,
        source,
      });
    } catch (e) {
      if (e instanceof LunchAdminError) {
        return NextResponse.json(
          { ok: false, error: e.message, reason: e.reason },
          { status: e.status },
        );
      }
      throw e;
    }
    student.food = nextFood;
    return null;
  };

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

      note: safeNote,
    };

    const failed = await saveChoice(nextFood);
    if (failed) return failed;

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
      note: safeNote,
    };

    const failed = await saveChoice(nextFood);
    if (failed) return failed;

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
      note: safeNote,
    };

    const failed = await saveChoice(nextFood);
    if (failed) return failed;

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

  const failed = await saveChoice(nextFood);
  if (failed) return failed;

  return NextResponse.json({
    ok: true,
    noFood: false,
    coupon: false,
    choiceType: "food",
  });
}
