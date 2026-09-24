// src/app/api/admin/food/coupon-stock/import/route.js
// บันทึกรหัสที่ผ่านการตรวจแล้วจริง ๆ
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  validateImportTarget,
  classifyCodes,
} from "@/lib/couponStockImport.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function safeAudit(payload) {
  try {
    await writeAuditLog(payload);
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

// POST { restaurantId, codesText, importBatch, expiresYMD }
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "").trim();
    const importBatch = String(body?.importBatch || "").trim();

    // ตรวจซ้ำฝั่ง server เสมอ ไม่เชื่อผลจากหน้า preview
    const { restaurant, expiresYMD } = await validateImportTarget({
      restaurantId,
      expiresYMD: body?.expiresYMD,
    });

    const classified = await classifyCodes({
      restaurantId,
      codesText: body?.codesText,
    });

    let inserted = 0;
    let raced = 0;

    if (classified.valid.length > 0) {
      const docs = classified.valid.map((code) => ({
        restaurant: restaurantId,
        code,
        expiresYMD,
        importBatch,
        status: "available",
      }));

      try {
        const res = await CouponStockCode.insertMany(docs, { ordered: false });
        inserted = res.length;
      } catch (err) {
        // ordered:false -> ตัวที่ผ่านถูกบันทึกแล้ว ที่ชนคือซ้ำ (E11000)
        inserted = err?.insertedDocs?.length ?? err?.result?.nInserted ?? 0;
        const writeErrors = err?.writeErrors || err?.result?.writeErrors || [];
        const dupes = writeErrors.filter((w) => (w?.err?.code ?? w?.code) === 11000);
        raced = dupes.length;

        if (writeErrors.length > dupes.length) throw err; // error อื่นไม่กลืน
      }
    }

    await safeAudit({
      ctx,
      req,
      action: "create",
      entityType: "CouponStockCode",
      entityId: String(restaurant._id),
      entityLabel: `${restaurant.name} / ${importBatch || "(ไม่ระบุล็อต)"}`,
      after: {
        importBatch,
        expiresYMD,
        inserted,
        skippedExisting: classified.counts.exists + raced,
        skippedDuplicateInPaste: classified.counts.duplicate,
        skippedInvalid: classified.counts.invalid,
      },
      meta: { restaurantId: String(restaurant._id) },
    });

    return NextResponse.json({
      ok: true,
      inserted,
      counts: {
        ...classified.counts,
        // ที่ preview บอกว่าใหม่ แต่มีคนแทรกก่อนระหว่างนั้น
        exists: classified.counts.exists + raced,
      },
      importBatch,
      expiresYMD,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
