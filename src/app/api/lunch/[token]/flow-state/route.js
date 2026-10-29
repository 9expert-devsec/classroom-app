// src/app/api/lunch/[token]/flow-state/route.js
//
// GET -> 200 { open }  — ยังอยู่ในขั้นสั่งอาหารได้ไหม (ใช้โดย FlowGuard ตอนกลับมาจาก cache / bfcache)
//   open = ใบ pending ที่ยังใช้งานอยู่ และยังไม่ถึงเวลาปิดของวันนั้น
//   สั่งแล้ว / ยกเลิก / แทนที่ / หมดเวลา / ไม่รู้จัก -> open: false (หน้าแรกของ token เป็นคนแสดงผล)
// findOne ครั้งเดียวด้วย token (unique index) + projection เล็ก ๆ — ไม่มีการเขียน
import { NextResponse } from "next/server";

import dbConnect from "@/lib/mongoose";
import LunchOrder from "@/models/LunchOrder";
import { finalCloseAt } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req, { params }) {
  try {
    const token = String(params?.token || "").trim();
    if (!token) return NextResponse.json({ open: false }, { headers: NO_STORE });

    await dbConnect();
    const order = await LunchOrder.findOne({ token }).select("status activeKey dayYMD").lean();

    const fc = order ? finalCloseAt(order.dayYMD) : null;
    const open =
      !!order &&
      order.status === "pending" &&
      !!order.activeKey &&
      !(fc && lunchNow().getTime() >= fc.getTime());

    return NextResponse.json({ open }, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/lunch/[token]/flow-state error:", err?.message || err);
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: NO_STORE });
  }
}
