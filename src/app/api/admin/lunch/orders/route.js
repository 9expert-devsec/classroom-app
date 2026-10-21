// src/app/api/admin/lunch/orders/route.js
//
// GET รายการออเดอร์อาหารกลางวันของวันหนึ่ง สำหรับหน้า "ติดตามการสั่งอาหาร"
//   ?date=YYYY-MM-DD (default วันนี้ เวลาไทย) &classId= &status= &q=
//
// แสดง "ใบล่าสุดของผู้เรียนแต่ละคน" (คลาส+ผู้เรียน+วัน) — ใบที่ถูกยกเลิกแล้วมีใบใหม่
// จะไม่โผล่ซ้ำ · R2a: ตัวกรอง "cancelled" ก็ใช้ใบล่าสุดเหมือนกัน (แถวตรงกับการ์ด)
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import dbConnect from "@/lib/mongoose";
import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { computeStatus } from "@/lib/lunchOrders.server";
import { getOrderCouponSource } from "@/lib/lunchCouponSource";
import {
  lunchAdminErrorBody,
  reopenBlockedReason,
  cancelBlockedReason,
} from "@/lib/lunchAdmin.server";
import { lunchNow } from "@/lib/lunchClock.server";
import { toBkkYMD, lunchTestTimesLabel } from "@/lib/lunchConfig";
import { bangkokHM, isYMD } from "@/lib/classDates";

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

    const all = await LunchOrder.find(find)
      .sort({ createdAt: 1 })
      .select(
        "classId studentId dayYMD status deadlineAt holderName nickname courseName roomName restaurantName usesCouponStock couponCode couponSource couponVoidedAt stockCodeId itemsTotal overBudget reopenCount createdAt submittedAt redeemedAt cancelledAt cancelReason handedOutAt handedOutBy activeKey token",
      )
      .lean();

    // ใบล่าสุดของแต่ละคน
    const latestByKey = new Map();
    for (const o of all) latestByKey.set(`${o.classId}:${o.studentId}`, o);
    const latestIds = new Set([...latestByKey.values()].map((o) => String(o._id)));

    // R-c: "เคยสั่งแล้ว" = ใบใดก็ได้ของคนนั้นในวันนั้นมี submittedAt (ไม่ใช่แค่ใบล่าสุด)
    const placedKeys = new Set(
      all.filter((o) => !!o.submittedAt).map((o) => `${o.classId}:${o.studentId}`),
    );

    // R2a: เหตุผลของใบที่ถูกยกเลิกล่าสุดของแต่ละคน (all เรียงตาม createdAt -> ใบหลังทับใบก่อน)
    const latestCancelReasonByKey = new Map();
    for (const o of all) {
      if (o.status === "cancelled") {
        latestCancelReasonByKey.set(`${o.classId}:${o.studentId}`, o.cancelReason || "");
      }
    }

    const nameRe = q ? new RegExp(escapeRegExp(q), "i") : null;
    const matchName = (o) =>
      !nameRe || nameRe.test(o.holderName || "") || nameRe.test(o.nickname || "");

    const latest = [...latestByKey.values()].filter(matchName);

    // ตัวเลขสรุปต่อสถานะ (จากใบล่าสุดของแต่ละคน ตามตัวกรองคลาส/ชื่อ)
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const o of latest) counts[computeStatus(o, now)] += 1;

    // R2a: ทุกตัวกรอง (รวม cancelled) ใช้ชุด "ใบล่าสุดของแต่ละคน" เดียวกับการ์ด — แถวตรงกับตัวเลข
    let rows;
    if (STATUSES.includes(statusQ)) {
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

    const today = toBkkYMD(now);
    const items = rows.map((o) => {
      const status = computeStatus(o, now);
      const isLatest = latestIds.has(String(o._id));
      // C1: ยกเลิก / ออก QR ใหม่ ได้เฉพาะใบที่เคยสั่งแล้ว และก่อน 15:00
      // R-c: เคยสั่ง = ใบใดก็ได้ของวันนั้น
      const placedToday = placedKeys.has(`${o.classId}:${o.studentId}`);
      const reissueable = status === "cancelled" && isLatest && dayYMD === today;
      const reissueBlocked = reissueable ? reopenBlockedReason(o, now, placedToday) : "";
      const cancelBlocked = cancelBlockedReason(o, now);
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
        couponSource: o.couponCode ? getOrderCouponSource(o) : "",
        usesCouponStock: !!o.usesCouponStock,
        stockStatus: o.stockCodeId ? stockStatus.get(String(o.stockCodeId)) || "" : "",
        // P4b: ส่งมอบ / รับคืน
        stockCodeId: o.stockCodeId ? String(o.stockCodeId) : "",
        handedOutHM: o.handedOutAt ? bangkokHM(o.handedOutAt) : "",
        handedOutBy: o.handedOutBy || "",
        couponVoided: !!o.couponVoidedAt,
        // C2: ร้านใช้คูปองแล้ว
        redeemedHM: o.redeemedAt ? bangkokHM(o.redeemedAt) : "",
        itemsTotal: o.itemsTotal || 0,
        overBudget: o.overBudget || 0,
        deadlineHM: o.deadlineAt ? bangkokHM(o.deadlineAt) : "",
        reopenCount: o.reopenCount || 0,
        cancelReason: o.cancelReason || "",
        isLatest,
        // R2a: ธงของแถว (ไม่ส่ง token ออกไปในรายการเด็ดขาด — ดู QR ผ่าน POST /qr)
        latestCancelReason:
          latestCancelReasonByKey.get(`${o.classId}:${o.studentId}`) ?? "",
        placedToday,
        hasLiveToken: o.status !== "cancelled" && !!o.activeKey && !!o.token,
        // ใบล่าสุดของวันนี้ถูกยกเลิก + เคยสั่งแล้ว + ก่อน 15:00 -> ออก QR ใหม่ได้
        canReissue: reissueable && !reissueBlocked,
        reissueBlockedReason: reissueBlocked,
        // null = ไม่แสดงปุ่มยกเลิก, "" = กดได้, ข้อความ = แสดงแต่กดไม่ได้
        canCancel: cancelBlocked === "",
        cancelBlockedReason: cancelBlocked || "",
      };
    });

    return NextResponse.json(
      { dayYMD, today, classes, counts, items, testTimes: lunchTestTimesLabel() },
      { headers: NO_STORE },
    );
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
