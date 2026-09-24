// src/app/api/lunch/[token]/route.js
//
// หน้าสั่งอาหารบนมือถือของผู้เรียน — token คือความลับเพียงอย่างเดียว
// ไม่รับและไม่คืน studentId ไม่ว่ากรณีใด
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { getLunchSession } from "@/lib/lunchOrders.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req, { params }) {
  try {
    await dbConnect();

    const token = String(params?.token || "");
    const session = await getLunchSession(token, new Date());

    if (!session) {
      return NextResponse.json(
        { error: "invalid" },
        { status: 404, headers: NO_STORE },
      );
    }
    if (session.gone) {
      return NextResponse.json(
        { error: "replaced" },
        { status: 410, headers: NO_STORE },
      );
    }

    return NextResponse.json(session, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/lunch/[token] error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500, headers: NO_STORE },
    );
  }
}
