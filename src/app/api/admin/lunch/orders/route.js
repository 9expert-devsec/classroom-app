// src/app/api/admin/lunch/orders/route.js
//
// GET รายการออเดอร์อาหารกลางวันของวันหนึ่ง สำหรับหน้า "ติดตามการสั่งอาหาร"
//   ?date=YYYY-MM-DD (default วันนี้ เวลาไทย) &classId= &status= &q=
//
// แสดง "ใบล่าสุดของผู้เรียนแต่ละคน" (คลาส+ผู้เรียน+วัน) — ใบที่ถูกยกเลิกแล้วมีใบใหม่
// จะไม่โผล่ซ้ำ · R2a: ตัวกรอง "cancelled" ก็ใช้ใบล่าสุดเหมือนกัน (แถวตรงกับการ์ด)
// R2b: รูปแถวอยู่ที่ buildOrderRows (src/lib/lunchOrderRows.server.js) ใช้ร่วมกับ /code-search
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongoose";
import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { computeStatus } from "@/lib/lunchOrders.server";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { lunchNow } from "@/lib/lunchClock.server";
import { toBkkYMD, lunchTestTimesLabel, lunchCloseLabels } from "@/lib/lunchConfig";
import { isYMD } from "@/lib/classDates";
import {
  buildOrderRows,
  ORDER_ROW_FIELDS,
  CLASS_ROW_FIELDS,
} from "@/lib/lunchOrderRows.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUSES = ["pending", "forfeited", "ordered", "at_shop", "cancelled"];

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const now = lunchNow();

    const dateQ = String(searchParams.get("date") || "").trim();
    const dayYMD = isYMD(dateQ) ? dateQ : toBkkYMD(now);
    const classId = String(searchParams.get("classId") || "").trim();
    const statusQ = String(searchParams.get("status") || "all").trim();
    const q = String(searchParams.get("q") || "").trim().slice(0, 60);

    const find = { dayYMD };
    if (classId && mongoose.Types.ObjectId.isValid(classId)) find.classId = classId;

    const all = await LunchOrder.find(find).sort({ createdAt: 1 }).select(ORDER_ROW_FIELDS).lean();

    // ใบล่าสุดของแต่ละคน
    const latestByKey = new Map();
    for (const o of all) latestByKey.set(`${o.classId}:${o.studentId}`, o);

    const nameRe = q ? new RegExp(escapeRegExp(q), "i") : null;
    const matchName = (o) =>
      !nameRe || nameRe.test(o.holderName || "") || nameRe.test(o.nickname || "");

    const latest = [...latestByKey.values()].filter(matchName);

    // ตัวเลขสรุปต่อสถานะ (จากใบล่าสุดของแต่ละคน ตามตัวกรองคลาส/ชื่อ)
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const o of latest) counts[computeStatus(o, now)] += 1;

    // R2a: ทุกตัวกรอง (รวม cancelled) ใช้ชุด "ใบล่าสุดของแต่ละคน" เดียวกับการ์ด — แถวตรงกับตัวเลข
    const rows = STATUSES.includes(statusQ)
      ? latest.filter((o) => computeStatus(o, now) === statusQ)
      : latest;

    // รายชื่อคลาสของวันนั้น (ไว้ทำตัวกรอง + หัวกลุ่ม)
    const classIds = [...new Set(all.map((o) => String(o.classId)))];
    const classDocs = classIds.length
      ? await Class.find({ _id: { $in: classIds } }).select(CLASS_ROW_FIELDS).lean()
      : [];
    const classById = new Map(classDocs.map((c) => [String(c._id), c]));
    const classes = classDocs
      .map((c) => ({
        id: String(c._id),
        name: c.customCourseName || c.courseName || c.title || "",
        room: c.room || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // R3-1: ตัวกรอง "รอรับคืน" = แถวที่มีคูปองกระดาษรอรับคืน (จากใบใดก็ได้ของวันนั้น)
    const built = await buildOrderRows({ rows, context: all, now, classById });
    const items =
      statusQ === "awaiting_return" ? built.filter((r) => r.pendingReturns.length > 0) : built;

    return NextResponse.json(
      {
        dayYMD,
        today: toBkkYMD(now),
        classes,
        counts,
        items,
        testTimes: lunchTestTimesLabel(),
        // R3x-3: เวลาปิดที่ใช้จริง สำหรับข้อความในหน้า (client ไม่คำนวณเอง)
        closeTimes: lunchCloseLabels(),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
