// src/app/api/admin/food/coupon-stock/lots/impact/route.js
// R5-1: ประเมินผลกระทบของการแก้/ลบ/ยกเลิกล็อต (dry run) — ไม่เขียนอะไรทั้งสิ้น ไม่ลง audit
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { computeLotImpact } from "@/lib/couponStockLots.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function optStr(v) {
  return v === undefined || v === null ? undefined : String(v);
}

// POST { lotId, action: "edit" | "delete" | "cancel", newName?, newExpiresYMD? }
// ตอบ { ok: true, impact } — impact.ok = บันทึกได้ไหม (คนละความหมายกับ ok ของคำขอ)
export async function POST(req) {
  try {
    // ไม่เขียนอะไร แต่เป็นขั้นแรกของการแก้ล็อต จึงใช้สิทธิ์เดียวกับฝั่ง write
    await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const impact = await computeLotImpact({
      lotId: String(body?.lotId || "").trim(),
      action: String(body?.action || "").trim(),
      newName: optStr(body?.newName),
      newExpiresYMD: optStr(body?.newExpiresYMD)?.trim(),
    });

    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
