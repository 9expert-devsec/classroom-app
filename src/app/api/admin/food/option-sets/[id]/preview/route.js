import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { previewOptionSetImpact } from "@/lib/foodOptionSets.server";

export const dynamic = "force-dynamic";

// POST /api/admin/food/option-sets/[id]/preview — body = ชุดที่จะบันทึก (ว่าง = ค่าปัจจุบัน)
// ไม่เขียนอะไร: เมนูที่ผูก + ตัวเลือกที่เพิ่ม/ลบ/เปลี่ยนชื่อ + override ที่จะหาย + blocking
export async function POST(req, { params }) {
  try {
    await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const body = await req.json().catch(() => null);
    const proposed = body && typeof body === "object" && Object.keys(body).length ? body : null;
    const impact = await previewOptionSetImpact(String(params?.id || ""), proposed);
    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error", ...(e?.details ? { details: e.details } : {}) },
      { status: e?.status || 500 },
    );
  }
}
