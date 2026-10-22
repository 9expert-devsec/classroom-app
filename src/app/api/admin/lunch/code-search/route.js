// src/app/api/admin/lunch/code-search/route.js
// GET ?code=<รหัสคูปอง> -> { found, code, primary, history }
//
// R2b (C1): ค้นหาด้วยรหัสคูปองข้ามทุกวัน (ไม่ใช่แค่วันที่เลือก)
//   - เทียบแบบตรงตัวตามที่เก็บไว้ (couponCode / eCouponCode) — ตัดช่องว่างหัวท้ายเท่านั้น
//     (รหัส CASA อาจมีขีด แต่ไม่มีช่องว่าง)
//   - primary = ผู้ถือปัจจุบัน: ใบที่รหัสยัง held / awaiting_return (ล่าสุด) ไม่มี = ใบล่าสุดที่มีรหัสนี้
//     เป็นแถวปกติรูปเดียวกับ /orders (buildOrderRows) พร้อมปุ่มตามกติกาเดิม
//     R3: ไม่มีผู้ถือปัจจุบัน -> primary.noHolder / noHolderLabel และไม่มีปุ่มที่เปลี่ยนสถานะ
//   - history = ผู้ถือก่อนหน้า (อ่านอย่างเดียว): วันที่ / ผู้เรียน / คลาส / สถานะรหัส / เหตุผลยกเลิก
// /api/admin/lunch/counter ไม่เปลี่ยน
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import LunchOrder from "@/models/LunchOrder";
import Class from "@/models/Class";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { lunchAdminErrorBody } from "@/lib/lunchAdmin.server";
import { lunchNow } from "@/lib/lunchClock.server";
import { couponCodeStateOf } from "@/lib/lunchCodeState";
import { cancelReasonLabel } from "@/lib/lunchCancelReasons";
import {
  buildOrderRows,
  ORDER_ROW_FIELDS,
  CLASS_ROW_FIELDS,
} from "@/lib/lunchOrderRows.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_CODE = 40;
const MAX_HITS = 50;

// R3 (A1): ป้ายของแถวหลักเมื่อไม่มีผู้ถือรหัสแล้ว (ตามสถานะรหัสของใบล่าสุด)
function noHolderLabel(state) {
  if (state === "voided") return "ไม่มีผู้ถือ (ยกเลิกแล้ว)";
  if (state === "returned" || state === "released") return "ไม่มีผู้ถือ (คืนแล้ว)";
  if (state === "not_collected") return "ไม่มีผู้ถือ (ไม่มารับ — รับคืนแล้ว)";
  return "ไม่มีผู้ถือ";
}

export async function GET(req) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") || "").trim();
    if (!code || code.length > MAX_CODE || /\s/.test(code)) {
      return NextResponse.json({ found: false, code }, { headers: NO_STORE });
    }

    const hits = await LunchOrder.find({ $or: [{ couponCode: code }, { eCouponCode: code }] })
      .sort({ createdAt: 1 })
      .limit(MAX_HITS)
      .select(ORDER_ROW_FIELDS)
      .lean();
    if (!hits.length) return NextResponse.json({ found: false, code }, { headers: NO_STORE });

    const now = lunchNow();
    const stockIds = hits.map((o) => o.stockCodeId).filter(Boolean);
    const stockDocs = stockIds.length
      ? await CouponStockCode.find({ _id: { $in: stockIds } }).select("status orderId").lean()
      : [];
    const stockById = new Map(stockDocs.map((d) => [String(d._id), d]));
    // R5-3e: ใบที่ประทับ "ไม่มารับคูปอง" (รหัสรับคืนเข้าคลังแล้ว) ไม่ใช่ผู้ถือปัจจุบัน — เป็นประวัติ
    //         รหัสที่ถูกจองให้ใบใหม่จึงไม่โผล่เป็นผู้ถือสองคน
    const stateOf = (o) =>
      o.couponNotCollectedAt && o.status !== "cancelled"
        ? "not_collected"
        : couponCodeStateOf(o, stockById.get(String(o.stockCodeId || "")) || null);

    // ผู้ถือปัจจุบัน: ใบล่าสุดที่รหัสยัง held / awaiting_return — ไม่มี = ใบล่าสุดที่มีรหัสนี้
    const holders = hits.filter((o) => ["held", "awaiting_return"].includes(stateOf(o)));
    const primary = (holders.length ? holders : hits)[(holders.length ? holders : hits).length - 1];

    // บริบทของแถวหลัก = ทุกใบของ (คลาส, ผู้เรียน, วัน) เดียวกัน (isLatest / เคยสั่ง / เหตุผลยกเลิก)
    const context = await LunchOrder.find({
      classId: primary.classId,
      studentId: primary.studentId,
      dayYMD: primary.dayYMD,
    })
      .sort({ createdAt: 1 })
      .select(ORDER_ROW_FIELDS)
      .lean();
    const [built] = await buildOrderRows({ rows: [primary], context, now });

    // R3 (A1): ไม่มีใบไหนถือรหัสนี้อยู่ (ทุกใบ คืนแล้ว / คืนเข้า stock / void) -> แถวหลักเป็นแค่
    //          ใบล่าสุดที่เคยถือ: ติดป้าย "ไม่มีผู้ถือ" ตามสถานะรหัส และซ่อนปุ่มที่เปลี่ยนสถานะทั้งหมด
    const noHolder = holders.length === 0;
    const primaryRow = noHolder
      ? {
          ...built,
          noHolder: true,
          noHolderLabel: noHolderLabel(stateOf(primary)),
          actions: {},
          canReissue: false,
          canCancel: false,
        }
      : built;

    const classIds = [...new Set(hits.map((o) => String(o.classId)))];
    const classDocs = await Class.find({ _id: { $in: classIds } }).select(CLASS_ROW_FIELDS).lean();
    const classById = new Map(classDocs.map((c) => [String(c._id), c]));

    // ผู้ถือก่อนหน้า (ใหม่ -> เก่า) อ่านอย่างเดียว
    const history = hits
      .filter((o) => String(o._id) !== String(primary._id))
      .reverse()
      .map((o) => {
        const c = classById.get(String(o.classId));
        const byAdmin = !!o.cancelledBy && o.cancelledBy !== "learner";
        return {
          orderId: String(o._id),
          dayYMD: o.dayYMD,
          name: o.holderName || "",
          nickname: o.nickname || "",
          className: c ? c.customCourseName || c.courseName || c.title || "" : o.courseName || "",
          room: c?.room || o.roomName || "",
          restaurantName: o.restaurantName || "",
          status: o.status,
          couponCodeState: stateOf(o),
          cancelReasonLabel:
            o.status === "cancelled" ? cancelReasonLabel(o.cancelReason, { byAdmin }) : "",
        };
      });

    return NextResponse.json(
      { found: true, code, primary: primaryRow, history },
      { headers: NO_STORE },
    );
  } catch (err) {
    const { status, body } = lunchAdminErrorBody(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
