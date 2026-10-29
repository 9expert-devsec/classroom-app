import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  getOptionSet,
  updateOptionSet,
  deleteOptionSet,
} from "@/lib/foodOptionSets.server";

export const dynamic = "force-dynamic";

function jsonError(e) {
  return NextResponse.json(
    { ok: false, error: e?.message || "Server error", ...(e?.details ? { details: e.details } : {}) },
    { status: e?.status || 500 },
  );
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

function auditShape(s) {
  return {
    name: s.name,
    selectType: s.selectType,
    required: !!s.required,
    minSelect: s.minSelect ?? null,
    maxSelect: s.maxSelect ?? null,
    choices: (s.choices || []).map(
      (c) => `${c.name} +${Number(c.priceDelta) || 0}${c.isActive === false ? " (ปิด)" : ""}`,
    ),
  };
}

// GET /api/admin/food/option-sets/[id] — ชุด + เมนูที่ผูกอยู่
export async function GET(_req, { params }) {
  try {
    await requirePerm(PERM.FOOD_READ);
    await dbConnect();
    const item = await getOptionSet(String(params?.id || ""));
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return jsonError(e);
  }
}

// PUT /api/admin/food/option-sets/[id] — บันทึกชุดแล้ว sync ทุกเมนูที่ผูก
// 422 + details (ผลกระทบ) ถ้ามีเมนูที่จะผิดกติกา เช่น กลุ่มบังคับเลือกไม่เหลือตัวเลือกที่แสดง
export async function PUT(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const { before, item, impact } = await updateOptionSet(String(params?.id || ""), body);

    await safeAudit({
      ctx,
      req,
      action: "update",
      entityType: "FoodOptionSet",
      entityId: String(item._id),
      entityLabel: item.name,
      before: auditShape(before),
      after: auditShape(item),
      meta: {
        restaurantId: String(item.restaurant),
        syncedMenus: impact.menus.map((m) => m.id),
      },
    });

    return NextResponse.json({ ok: true, item, impact });
  } catch (e) {
    return jsonError(e);
  }
}

// DELETE /api/admin/food/option-sets/[id]?mode=remove|detach (default remove)
export async function DELETE(req, { params }) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();
    const mode = new URL(req.url).searchParams.get("mode") || "remove";
    const { item, mode: done, menus } = await deleteOptionSet(String(params?.id || ""), mode);

    await safeAudit({
      ctx,
      req,
      action: "delete",
      entityType: "FoodOptionSet",
      entityId: String(item._id),
      entityLabel: item.name,
      before: auditShape(item),
      meta: { restaurantId: String(item.restaurant), mode: done, menus: menus.map((m) => m.id) },
    });

    return NextResponse.json({ ok: true, mode: done, menus });
  } catch (e) {
    return jsonError(e);
  }
}
