// src/app/api/admin/lunch/orders/route.js
//
// GET รายการออเดอร์อาหารกลางวันของวันหนึ่ง สำหรับหน้า "ติดตามการสั่งอาหาร"
//   ?date=YYYY-MM-DD (default วันนี้ เวลาไทย) &classId= &status= &q=
//
// แสดง "ใบล่าสุดของผู้เรียนแต่ละคน" (คลาส+ผู้เรียน+วัน) — ใบที่ถูกยกเลิกแล้วมีใบใหม่
// จะไม่โผล่ซ้ำ ยกเว้นกรองสถานะ "cancelled" ซึ่งแสดงใบที่ยกเลิกทั้งหมด
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongoose";
import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { computeStatus } from "@/lib/lunchOrders.server";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { bangkokHM, isYMD } from "@/lib/classDates";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUSES = ["pending", "unassigned", "ordered", "at_shop", "cancelled"];

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const now = new Date();

    const dateQ = String(searchParams.get("date") || "").trim();
    const dayYMD = isYMD(dateQ) ? dateQ : toBkkYMD(now);
    const classId = String(searchParams.get("classId") || "").trim();
    const statusQ = String(searchParams.get("status") || "all").trim();
    const q = String(searchParams.get("q") || "").trim().slice(0, 60);

    const find = { dayYMD };
    if (classId && mongoose.Types.ObjectId.isValid(classId)) find.classId = classId;

    const all = await LunchOrder.find(find)
      .sort({ createdAt: 1 })
      .select(
        "classId studentId dayYMD status deadlineAt holderName nickname courseName roomName restaurantName usesCouponStock couponCode couponSource couponVoidedAt stockCodeId itemsTotal overBudget reopenCount createdAt cancelledAt cancelReason handedOutAt handedOutBy",
      )
      .lean();

    // ใบล่าสุดของแต่ละคน
    const latestByKey = new Map();
    for (const o of all) latestByKey.set(`${o.classId}:${o.studentId}`, o);
    const latestIds = new Set([...latestByKey.values()].map((o) => String(o._id)));

    const nameRe = q ? new RegExp(escapeRegExp(q), "i") : null;
    const matchName = (o) =>
      !nameRe || nameRe.test(o.holderName || "") || nameRe.test(o.nickname || "");

    const latest = [...latestByKey.values()].filter(matchName);

    // ตัวเลขสรุปต่อสถานะ (จากใบล่าสุดของแต่ละคน ตามตัวกรองคลาส/ชื่อ)
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const o of latest) counts[computeStatus(o, now)] += 1;

    let rows;
    if (statusQ === "cancelled") {
      rows = all.filter((o) => o.status === "cancelled" && matchName(o));
    } else if (STATUSES.includes(statusQ)) {
      rows = latest.filter((o) => computeStatus(o, now) === statusQ);
    } else {
      rows = latest;
    }

    // สถานะคูปอง stock (ไว้บอกผลของการยกเลิกในหน้าจอ)
    const stockIds = rows.map((o) => o.stockCodeId).filter(Boolean);
    const stockDocs = stockIds.length
      ? await CouponStockCode.find({ _id: { $in: stockIds } }).select("status").lean()
      : [];
    const stockStatus = new Map(stockDocs.map((d) => [String(d._id), d.status]));

    // รายชื่อคลาสของวันนั้น (ไว้ทำตัวกรอง + หัวกลุ่ม)
    const classIds = [...new Set(all.map((o) => String(o.classId)))];
    const classDocs = classIds.length
      ? await Class.find({ _id: { $in: classIds } })
          .select("title courseName customCourseName room")
          .lean()
      : [];
    const classes = classDocs
      .map((c) => ({
        id: String(c._id),
        name: c.customCourseName || c.courseName || c.title || "",
        room: c.room || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const items = rows.map((o) => {
      const status = computeStatus(o, now);
      const isLatest = latestIds.has(String(o._id));
      return {
        orderId: String(o._id),
        classId: String(o.classId),
        studentId: String(o.studentId),
        dayYMD: o.dayYMD,
        name: o.holderName || "",
        nickname: o.nickname || "",
        status,
        restaurantName: o.restaurantName || "",
        couponCode: o.couponCode || "",
        couponSource: o.couponSource || "",
        usesCouponStock: !!o.usesCouponStock,
        stockStatus: o.stockCodeId ? stockStatus.get(String(o.stockCodeId)) || "" : "",
        // P4b: ส่งมอบ / รับคืน
        stockCodeId: o.stockCodeId ? String(o.stockCodeId) : "",
        handedOutHM: o.handedOutAt ? bangkokHM(o.handedOutAt) : "",
        handedOutBy: o.handedOutBy || "",
        couponVoided: !!o.couponVoidedAt,
        itemsTotal: o.itemsTotal || 0,
        overBudget: o.overBudget || 0,
        deadlineHM: o.deadlineAt ? bangkokHM(o.deadlineAt) : "",
        reopenCount: o.reopenCount || 0,
        cancelReason: o.cancelReason || "",
        isLatest,
        // ใบล่าสุดของวันนี้ถูกยกเลิก -> ออก QR ใหม่ได้
        canReissue: status === "cancelled" && isLatest && dayYMD === toBkkYMD(now),
      };
    });

    return NextResponse.json(
      { dayYMD, today: toBkkYMD(now), classes, counts, items },
      { headers: NO_STORE },
    );
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
