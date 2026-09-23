import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    // audit ล้มไม่ควรทำให้ request fail
    console.error("writeAuditLog failed:", e);
  }
}

export async function GET() {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();
    const items = await Restaurant.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { name, logoUrl } = body || {};

    if (!name?.trim()) {
      return NextResponse.json({ error: "กรุณากรอกชื่อร้าน" }, { status: 400 });
    }

    const r = await Restaurant.create({
      name: name.trim(),
      logoUrl: logoUrl || "",
    });

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "Restaurant",
      entityId: String(r._id),
      entityLabel: r.name,
      after: { name: r.name, logoUrl: r.logoUrl },
    });

    return NextResponse.json({ ok: true, item: r });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
