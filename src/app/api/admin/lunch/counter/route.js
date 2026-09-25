// src/app/api/admin/lunch/counter/route.js
// GET ?q= -> { dayYMD, items, awaitingReturn }
// หน้า Counter: ค้นหาออเดอร์วันนี้ (ชื่อ / ชื่อเล่น / รหัสคูปอง) + รายการรอรับคูปองคืน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import CouponStockCode from "@/models/CouponStockCode";
import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { computeStatus } from "@/lib/lunchOrders.server";
import {
  searchCounterOrders,
  listAwaitingReturn,
  lunchAdminErrorBody,
} from "@/lib/lunchAdmin.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const [{ dayYMD, orders }, awaitingReturn] = await Promise.all([
      searchCounterOrders({ q: searchParams.get("q"), now }),
      listAwaitingReturn(),
    ]);

    const stockIds = orders.map((o) => o.stockCodeId).filter(Boolean);
    const stockDocs = stockIds.length
      ? await CouponStockCode.find({ _id: { $in: stockIds } }).select("status").lean()
      : [];
    const stockStatus = new Map(stockDocs.map((d) => [String(d._id), d.status]));

    const items = orders.map((o) => ({
      orderId: String(o._id),
      classId: String(o.classId),
      studentId: String(o.studentId),
      dayYMD: o.dayYMD,
      name: o.holderName || "",
      nickname: o.nickname || "",
      className: o.courseName || "",
      room: o.roomName || "",
      restaurantName: o.restaurantName || "",
      status: computeStatus(o, now),
      couponCode: o.couponCode || "",
      couponSource: o.couponSource || "",
      couponVoided: !!o.couponVoidedAt,
      stockStatus: o.stockCodeId ? stockStatus.get(String(o.stockCodeId)) || "" : "",
      handedOutAt: o.handedOutAt || null,
      handedOutBy: o.handedOutBy || "",
      deadlineAt: o.deadlineAt || null,
    }));

    return NextResponse.json({ dayYMD, items, awaitingReturn }, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
