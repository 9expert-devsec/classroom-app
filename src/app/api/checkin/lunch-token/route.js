// src/app/api/checkin/lunch-token/route.js
//
// แท็บเล็ตขอ path ของ QR สำหรับผู้เรียนหลังเซ็นชื่อเสร็จ
//
// guard แบบเดียวกับ route เช็คอินสาธารณะอื่น ๆ คือไม่มี cookie/แอดมิน
// แต่ server ต้องพิสูจน์เองทุกข้อ ห้ามเชื่อ body นอกจาก id สองตัว:
//   - นักเรียนคนนี้อยู่คลาสนี้จริง
//   - วันนี้เช็คอินแล้วจริง
//   - ตัวเลือกอาหารที่บันทึกไว้ของวันนี้คือ "coupon" จริง
// R2a: กติกาทั้งหมดอยู่ที่ assertLunchIssueAllowed (lunchActions.server.js)
//      ใช้ตัวเดียวกับแอดมิน "ออก QR" — ออกใบใหม่ได้แล้วเขียน audit lunch.issue
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireKiosk, authErrorResponse, kioskAuditCtx } from "@/lib/kioskAuth.server";

import { issueLunchOrder, computeStatus } from "@/lib/lunchOrders.server";
import { assertLunchIssueAllowed, issueReasonMessage } from "@/lib/lunchActions.server";
import { writeLunchAudit } from "@/lib/lunchAdmin.server";
import { orderWindow, finalCloseLabel } from "@/lib/lunchConfig";
import { lunchNow } from "@/lib/lunchClock.server";

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

// POST { classId, studentId } -> { path: "/lunch/<token>" }
export async function POST(req) {
  // L2a: kiosk session required, before any DB work or body parsing
  let auth;
  try {
    auth = await requireKiosk(req);
  } catch (e) {
    return authErrorResponse(e);
  }

  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const classId = String(body?.classId || "").trim();
    const studentId = String(body?.studentId || "").trim();

    if (!isObjectId(classId) || !isObjectId(studentId)) {
      return bad("ข้อมูลไม่ครบ", 400, { reason: "bad_request" });
    }

    // ทุกคำตอบที่ไม่สำเร็จแนบ reason ไปด้วย — แท็บเล็ตใช้แยกว่า "ไม่ได้เลือกคูปอง"
    // (ไม่ต้องแสดงอะไร) ออกจากความผิดพลาดที่ต้องแจ้งเจ้าหน้าที่
    const guard = await assertLunchIssueAllowed({ classId, studentId });
    if (!guard.ok) {
      return bad(issueReasonMessage(guard.reason), guard.status, { reason: guard.reason });
    }

    // 4) ออกออเดอร์ (idempotent — กด Step 3 ซ้ำได้ token เดิม)
    const res = await issueLunchOrder({
      studentId,
      classId,
      dayYMD: guard.todayYMD,
    });

    if (!res.ok) {
      return bad(issueReasonMessage(res.reason), 409, { reason: res.reason });
    }

    // R2a: audit เฉพาะตอนออกใบใหม่จริง (กดซ้ำได้ token เดิม ไม่ลงซ้ำ)
    if (res.created) {
      await writeLunchAudit({
        ctx: kioskAuditCtx(auth.session),
        req,
        action: "lunch.issue",
        order: res.order,
        before: { status: "none" },
        after: { status: "pending", deadlineAt: res.order.deadlineAt },
        meta: {
          statusBefore: "none",
          statusAfter: "pending",
          source: "kiosk",
          reopenCount: res.order.reopenCount || 0,
        },
      });
    }

    // P4b-0: ส่งเส้นตายจริงของใบนี้ + phase กลับไปด้วย (ใบที่ออก QR ใหม่ไม่ใช่ 11:15)
    // C1: ไม่ยืดเวลาให้เอง — เลยเส้นตาย = short (สั่งแบบย่อได้ถึง 15:00), ถึง 15:00 = expired
    const now = lunchNow();
    const win = orderWindow(
      {
        dayYMD: res.order.dayYMD,
        deadlineAt: res.order.deadlineAt,
      },
      now,
    );
    return NextResponse.json(
      {
        path: `/lunch/${res.order.token}`,
        deadlineAt: win.deadlineAt ? new Date(win.deadlineAt).toISOString() : null,
        phase: win.phase,
        status: computeStatus(res.order, now),
        // C3a: เวลาปิดจริง (lunchTimes) ให้ข้อความบนแท็บเล็ตไม่ฮาร์ดโค้ด
        finalHM: finalCloseLabel(),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("POST /api/checkin/lunch-token error:", err);
    return bad("เกิดข้อผิดพลาดในระบบ", 500, { reason: "internal_error" });
  }
}
