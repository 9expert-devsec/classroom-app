// src/app/api/lunch/[token]/order/route.js
//
// ผู้เรียนกดยืนยันออเดอร์จากมือถือ
// token คือความลับเพียงอย่างเดียว — ไม่รับ studentId ไม่ว่ากรณีใด
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { getOrderByToken, getLunchSession } from "@/lib/lunchOrders.server";
import { submitLunchOrder, SubmitError } from "@/lib/lunchSubmit.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function errBody(reason, message, extra = {}) {
  const body = { error: message, reason };
  if (extra.field) body.field = extra.field;
  if (Number.isInteger(extra.lineIndex)) body.lineIndex = extra.lineIndex;
  return body;
}

export async function POST(req, { params }) {
  try {
    await dbConnect();

    const token = String(params?.token || "");
    const order = await getOrderByToken(token);

    // 1) token
    if (!order) {
      return NextResponse.json(
        errBody("invalid", "QR ไม่ถูกต้อง"),
        { status: 404, headers: NO_STORE },
      );
    }
    if (order.status === "cancelled" || !order.activeKey) {
      return NextResponse.json(
        errBody("replaced", "QR นี้ถูกแทนที่แล้ว กรุณาติดต่อเจ้าหน้าที่"),
        { status: 410, headers: NO_STORE },
      );
    }

    const body = await req.json().catch(() => ({}));

    let result;
    try {
      result = await submitLunchOrder({ order, body, now: new Date() });
    } catch (err) {
      if (err instanceof SubmitError) {
        // already_ordered ควรแนบสรุปของเดิมกลับไปให้ client แสดงได้ทันที
        if (err.reason === "already_ordered") {
          const session = await getLunchSession(token, new Date());
          return NextResponse.json(
            {
              ...errBody(err.reason, err.message, err),
              order: session?.order ?? null,
            },
            { status: err.status, headers: NO_STORE },
          );
        }
        return NextResponse.json(errBody(err.reason, err.message, err), {
          status: err.status,
          headers: NO_STORE,
        });
      }
      throw err;
    }

    // 9) ตอบด้วย DTO ก้อนเดียวกับ GET เพื่อให้ client refresh หน้าได้เลย
    const session = await getLunchSession(token, new Date());
    return NextResponse.json(
      { ...session, replay: !!result.replay },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("POST /api/lunch/[token]/order error:", err);
    return NextResponse.json(
      errBody("internal_error", "เกิดข้อผิดพลาดในระบบ"),
      { status: 500, headers: NO_STORE },
    );
  }
}
