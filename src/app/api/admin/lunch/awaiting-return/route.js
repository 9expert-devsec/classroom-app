// src/app/api/admin/lunch/awaiting-return/route.js
// GET -> { today, items: [{ codeId, code, orderId, dayYMD, name, nickname, className, room,
//                          restaurantName, cancelReasonLabel, cancelledAt, daysOutstanding }] }
//
// R2b (C2): คูปองกระดาษที่ "รอรับคืน" ทุกใบ ไม่จำกัดวัน — เก่าสุดขึ้นก่อน
//   แหล่งเดียวกับ couponCodeState = awaiting_return: CouponStockCode.status "awaiting_return"
//   (รหัสยังผูก orderId ของใบที่ถูกยกเลิก) · รับคืนผ่าน POST /api/admin/lunch/return ตัวเดิม
//   ซึ่งไม่จำกัดวัน / เวลา (กติกา: ส่งมอบ / รับคืน ได้รับยกเว้น)
// /api/admin/lunch/counter (listAwaitingReturn) ไม่เปลี่ยน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import CouponStockCode from "@/models/CouponStockCode";
import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";
import Restaurant from "@/models/Restaurant";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { lunchNow } from "@/lib/lunchClock.server";
import { toBkkYMD } from "@/lib/lunchConfig";
import { cancelReasonLabel } from "@/lib/lunchCancelReasons";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// จำนวนวันระหว่าง "YYYY-MM-DD" สองวัน (วันตามปฏิทิน ไม่สนเวลา)
function daysBetween(fromYMD, toYMD) {
  if (!fromYMD || !toYMD) return null;
  const a = Date.parse(`${fromYMD}T00:00:00Z`);
  const b = Date.parse(`${toYMD}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export async function GET() {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const codes = await CouponStockCode.find({ status: "awaiting_return" })
      .select("code orderId restaurant updatedAt")
      .lean();

    const orderIds = codes.map((c) => c.orderId).filter(Boolean);
    const orders = orderIds.length
      ? await LunchOrder.find({ _id: { $in: orderIds } })
          .select(
            "classId studentId dayYMD holderName nickname courseName roomName restaurantName cancelledAt cancelReason cancelledBy",
          )
          .lean()
      : [];
    const orderById = new Map(orders.map((o) => [String(o._id), o]));

    const classIds = [...new Set(orders.map((o) => String(o.classId)).filter(Boolean))];
    const shopIds = [...new Set(codes.map((c) => String(c.restaurant || "")).filter(Boolean))];
    const [classDocs, shopDocs] = await Promise.all([
      classIds.length
        ? Class.find({ _id: { $in: classIds } }).select("title courseName customCourseName room").lean()
        : [],
      shopIds.length ? Restaurant.find({ _id: { $in: shopIds } }).select("name").lean() : [],
    ]);
    const classById = new Map(classDocs.map((c) => [String(c._id), c]));
    const shopName = new Map(shopDocs.map((r) => [String(r._id), r.name || ""]));

    const today = toBkkYMD(lunchNow());
    const items = codes
      .map((c) => {
        const o = orderById.get(String(c.orderId)) || {};
        const k = o.classId ? classById.get(String(o.classId)) : null;
        const byAdmin = !!o.cancelledBy && o.cancelledBy !== "learner";
        return {
          codeId: String(c._id),
          code: c.code,
          orderId: c.orderId ? String(c.orderId) : "",
          classId: o.classId ? String(o.classId) : "",
          studentId: o.studentId ? String(o.studentId) : "",
          dayYMD: o.dayYMD || "",
          name: o.holderName || "",
          nickname: o.nickname || "",
          className: k ? k.customCourseName || k.courseName || k.title || "" : o.courseName || "",
          room: k?.room || o.roomName || "",
          restaurantName: o.restaurantName || shopName.get(String(c.restaurant || "")) || "",
          cancelReasonLabel: o._id ? cancelReasonLabel(o.cancelReason, { byAdmin }) : "",
          cancelledAt: o.cancelledAt || c.updatedAt || null,
          daysOutstanding: daysBetween(o.dayYMD, today),
        };
      })
      // เก่าสุดขึ้นก่อน: วันของออเดอร์ แล้วเวลายกเลิก
      .sort(
        (a, b) =>
          String(a.dayYMD).localeCompare(String(b.dayYMD)) ||
          new Date(a.cancelledAt || 0).getTime() - new Date(b.cancelledAt || 0).getTime(),
      );

    return NextResponse.json({ today, items }, { headers: NO_STORE });
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
