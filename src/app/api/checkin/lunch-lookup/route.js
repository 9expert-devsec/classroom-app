// src/app/api/checkin/lunch-lookup/route.js
//
// แท็บเล็ต "แสดง QR สั่งอาหาร": ค้นหาผู้เรียนของคลาสที่เรียนวันนี้ แล้วบอกว่า
// วันนี้เลือกคูปองไหม และมีออเดอร์ (ใบที่ยังไม่ยกเลิก) อยู่หรือยัง
//
// posture เดียวกับ /api/checkin/search: ไม่มี cookie/แอดมิน (แท็บเล็ตหน้างาน)
// ข้อจำกัด: q อย่างน้อย 2 ตัวอักษร (สั้นกว่านั้นตอบ 400) ยาวสุด 60, ได้สูงสุด 20 คน
// ไม่ส่งรหัสคูปองออกไปในรายการ — มีแค่ path ของ QR ซึ่งเปิดดูรหัสได้ทีละคน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import Student from "@/models/Student";
import Class from "@/models/Class";
import LunchOrder from "@/models/LunchOrder";

import { bangkokYMD, bangkokHM, computeDayIndexToday } from "@/lib/classDates";
import { computeStatus, activeKeyOf } from "@/lib/lunchOrders.server";
import { orderWindow } from "@/lib/lunchConfig";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MIN_Q = 2;
const MAX_Q = 60;
const LIMIT = 20;

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") || "").trim();
    if (q.length < MIN_Q) {
      return NextResponse.json(
        { error: `กรุณาพิมพ์อย่างน้อย ${MIN_Q} ตัวอักษร`, reason: "q_too_short" },
        { status: 400, headers: NO_STORE },
      );
    }
    if (q.length > MAX_Q) {
      return NextResponse.json(
        { error: "คำค้นหายาวเกินไป", reason: "q_too_long" },
        { status: 400, headers: NO_STORE },
      );
    }

    const now = new Date();
    const todayYMD = bangkokYMD(now);

    // คลาสที่วันนี้เป็นวันเรียน (ไม่รวม Masterclass — ไม่มีขั้นตอนอาหาร)
    const classes = await Class.find(
      { classKind: { $ne: "masterclass" } },
      { title: 1, courseName: 1, customCourseName: 1, room: 1, date: 1, days: 1, dayCount: 1, "duration.dayCount": 1 },
    ).lean();

    const todayClasses = new Map();
    for (const c of classes) {
      const day = computeDayIndexToday(c, todayYMD);
      if (day) todayClasses.set(String(c._id), { c, day });
    }
    if (!todayClasses.size) {
      return NextResponse.json({ today: todayYMD, items: [] }, { headers: NO_STORE });
    }

    const re = new RegExp(escapeRegExp(q), "i");
    const students = await Student.find({
      classId: { $in: [...todayClasses.keys()] },
      $or: [{ name: re }, { thaiName: re }, { engName: re }],
    })
      .select("name thaiName engName classId food")
      .sort({ name: 1, thaiName: 1 })
      .limit(LIMIT)
      .lean();

    // ใบที่ยัง live ของวันนี้ (activeKey = ยังไม่ถูกยกเลิก)
    const keys = students.map((s) => activeKeyOf(String(s.classId), String(s._id), todayYMD));
    const orders = keys.length
      ? await LunchOrder.find({ activeKey: { $in: keys } })
          .select("activeKey status deadlineAt token restaurantName")
          .lean()
      : [];
    const orderByKey = new Map(orders.map((o) => [o.activeKey, o]));

    const items = students.map((s) => {
      const cid = String(s.classId);
      const { c, day } = todayClasses.get(cid);
      const food = s.food || {};
      // เลือกคูปอง "ของวันนี้" ของคลาสนี้จริง (กติกาเดียวกับ lunch-token)
      const couponToday =
        String(food.choiceType || "") === "coupon" &&
        (!food.classId || String(food.classId) === cid) &&
        Number(food.day) === day;

      const o = orderByKey.get(activeKeyOf(cid, String(s._id), todayYMD));
      return {
        studentId: String(s._id),
        classId: cid,
        name: s.name || s.thaiName || s.engName || "",
        className: c.customCourseName || c.courseName || c.title || "",
        room: c.room || "",
        couponToday,
        order: o
          ? {
              status: computeStatus(o, now),
              path: `/lunch/${o.token}`,
              deadlineHM: o.deadlineAt ? bangkokHM(o.deadlineAt) : "",
              // P4b-0: ให้ QR view ใช้ LunchDeadlineLine ตัวเดียวกับ Step 3
              deadlineAt: o.deadlineAt ? new Date(o.deadlineAt).toISOString() : null,
              phase: orderWindow({ dayYMD: todayYMD, deadlineAt: o.deadlineAt }, now).phase,
              restaurantName: o.restaurantName || "",
            }
          : null,
      };
    });

    return NextResponse.json({ today: todayYMD, items }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/checkin/lunch-lookup error:", err);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในระบบ", reason: "internal_error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
