// src/app/api/admin/food/coupon-stock/import/preview/route.js
// ตรวจรหัสที่วางมา แต่ยังไม่บันทึกอะไรทั้งสิ้น
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import {
  validateImportTarget,
  classifyCodes,
} from "@/lib/couponStockImport.server";

export const dynamic = "force-dynamic";

function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// POST { restaurantId, codesText, importBatch, expiresYMD }
export async function POST(req) {
  try {
    // preview ไม่เขียนอะไร แต่เป็นหน้าจอฝั่ง write จึงใช้สิทธิ์เดียวกับ import
    await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "").trim();

    const { restaurant, expiresYMD } = await validateImportTarget({
      restaurantId,
      expiresYMD: body?.expiresYMD,
    });

    const result = await classifyCodes({
      restaurantId,
      codesText: body?.codesText,
    });

    return NextResponse.json({
      ok: true,
      restaurant: { _id: String(restaurant._id), name: restaurant.name },
      importBatch: String(body?.importBatch || "").trim(),
      expiresYMD,
      ...result,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
