// src/app/api/checkin/lunch-token/route.js
//
// แท็บเล็ตขอ path ของ QR สำหรับผู้เรียนหลังเซ็นชื่อเสร็จ
//
// guard แบบเดียวกับ route เช็คอินสาธารณะอื่น ๆ คือไม่มี cookie/แอดมิน
// แต่ server ต้องพิสูจน์เองทุกข้อ ห้ามเชื่อ body นอกจาก id สองตัว:
//   - นักเรียนคนนี้อยู่คลาสนี้จริง
//   - วันนี้เช็คอินแล้วจริง
//   - ตัวเลือกอาหารที่บันทึกไว้ของวันนี้คือ "coupon" จริง
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import Student from "@/models/Student";
import Class from "@/models/Class";
import Checkin from "@/models/Checkin";

import { issueLunchOrder } from "@/lib/lunchOrders.server";
import { couponUnavailableMessage } from "@/lib/couponAvailability.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { classDayIndexToday } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function bad(message, status = 400, extra = {}) {
  return NextResponse.json(
    { ok: false, error: message, ...extra },
    { status, headers: NO_STORE },
  );
}

function isObjectId(x) {
  return /^[0-9a-fA-F]{24}$/.test(String(x || "").trim());
}

// ข้อความไทยของเหตุผลที่ออก QR ไม่ได้
function reasonMessage(reason) {
  if (reason === "class_disabled" || reason === "no_coupon_restaurant") {
    return couponUnavailableMessage(reason);
  }
  if (reason === "not_checked_in") return "ยังไม่พบการเช็คอินของวันนี้";
  if (reason === "not_coupon_choice") return "วันนี้ไม่ได้เลือกรับคูปอง";
  if (reason === "coupon_not_today") return "ตัวเลือกคูปองที่บันทึกไว้ไม่ใช่ของวันนี้";
  if (reason === "not_class_day") return "วันนี้ไม่ใช่วันเรียนของคลาสนี้";
  if (reason === "student_not_in_class") return "ผู้เรียนไม่ได้อยู่ในคลาสนี้";
  if (reason === "student_not_found") return "ไม่พบผู้เรียน";
  if (reason === "class_not_found") return "ไม่พบคลาส";
  return "ออก QR ไม่สำเร็จ";
}

// POST { classId, studentId } -> { path: "/lunch/<token>" }
export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const classId = String(body?.classId || "").trim();
    const studentId = String(body?.studentId || "").trim();

    if (!isObjectId(classId) || !isObjectId(studentId)) {
      return bad("ข้อมูลไม่ครบ", 400, { reason: "bad_request" });
    }

    const [student, klass] = await Promise.all([
      Student.findById(studentId).select("classId food").lean(),
      Class.findById(classId).select("date days dayCount duration.dayCount").lean(),
    ]);

    // ทุกคำตอบที่ไม่สำเร็จแนบ reason ไปด้วย — แท็บเล็ตใช้แยกว่า "ไม่ได้เลือกคูปอง"
    // (ไม่ต้องแสดงอะไร) ออกจากความผิดพลาดที่ต้องแจ้งเจ้าหน้าที่
    const fail = (reason, status) => bad(reasonMessage(reason), status, { reason });

    if (!student) return fail("student_not_found", 404);
    if (!klass) return fail("class_not_found", 404);

    // 1) ผู้เรียนต้องอยู่คลาสนี้จริง
    if (String(student.classId || "") !== classId) {
      return fail("student_not_in_class", 403);
    }

    // 3a) ไม่ได้เลือกคูปองเลย = ไม่มี Step 3 (ไม่ใช่ความผิดพลาด)
    const food = student.food || {};
    if (String(food.choiceType || "") !== "coupon") {
      return fail("not_coupon_choice", 409);
    }

    const todayYMD = toBkkYMD(new Date());

    // 2) ต้องเช็คอินแล้ววันนี้ — ดูจาก Checkin ของวันเรียนที่ตรงกับวันนี้
    //    P3g: วันเรียนของวันนี้มาจาก helper กลาง (เวลาไทย, days[] ก่อน)
    const dayIndex = classDayIndexToday(klass) || 0;

    if (dayIndex < 1) return fail("not_class_day", 409);

    const checkin = await Checkin.findOne({
      studentId: student._id,
      classId: klass._id,
      day: dayIndex,
    }).lean();

    if (!checkin) return fail("not_checked_in", 409);

    // 3b) คูปองที่เลือกไว้ต้องเป็นของคลาสนี้ และของ "วันนี้"
    //    P3c: Student.food เก็บค่าเดียวทับกันไปเรื่อย ๆ ถ้าไม่เช็ค day ด้วย
    //    คนที่เลือกคูปองไว้เมื่อวานจะยังขอ QR ของวันนี้ได้
    const foodClassMatches =
      !food.classId || String(food.classId) === classId;
    const foodDayMatches =
      food.day === null || food.day === undefined
        ? false
        : Number(food.day) === dayIndex;

    if (!foodClassMatches || !foodDayMatches) {
      return fail("coupon_not_today", 409);
    }

    // 4) ออกออเดอร์ (idempotent — กด Step 3 ซ้ำได้ token เดิม)
    const res = await issueLunchOrder({
      studentId,
      classId,
      dayYMD: todayYMD,
    });

    if (!res.ok) {
      return bad(reasonMessage(res.reason), 409, { reason: res.reason });
    }

    return NextResponse.json(
      { path: `/lunch/${res.order.token}` },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("POST /api/checkin/lunch-token error:", err);
    return bad("เกิดข้อผิดพลาดในระบบ", 500, { reason: "internal_error" });
  }
}
