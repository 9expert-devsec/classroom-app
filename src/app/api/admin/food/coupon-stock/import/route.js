// src/app/api/admin/food/coupon-stock/import/route.js
// บันทึกรหัสที่ผ่านการตรวจแล้วจริง ๆ
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongoose";
import CouponStockCode from "@/models/CouponStockCode";
import CouponStockLot from "@/models/CouponStockLot";

import { requirePerm } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { writeAuditLog } from "@/lib/auditLog.server";
import {
  CouponImportError,
  validateImportTarget,
  validateImportLot,
  resolveImportLot,
  classifyCodes,
} from "@/lib/couponStockImport.server";

export const dynamic = "force-dynamic";

// รหัสชนกับที่มีคนเพิ่งแทรกระหว่างตรวจ -> ตรวจใหม่แล้วบันทึกอีกครั้ง (ครั้งที่ 2 ตัวที่ชนจะกลายเป็น exists)
const IMPORT_ATTEMPTS = 2;

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

function isDupKey(err) {
  return err?.code === 11000 || err?.writeErrors?.some?.((w) => (w?.err?.code ?? w?.code) === 11000);
}

function isLotNameDup(err) {
  return isDupKey(err) && /nameKey/.test(String(err?.message || ""));
}

/**
 * R5-1: สร้างล็อต (ถ้ายังไม่มี) + insert รหัสทั้งหมดใน transaction เดียว — ล้ม = ไม่มีอะไรถูกเขียน
 */
async function writeImport({ restaurantId, importType, importBatch, expiresYMD, note, createdBy, codesText }) {
  const classified = await classifyCodes({ restaurantId, codesText });
  if (classified.valid.length === 0) {
    return { classified, inserted: 0, lot: null, lotCreated: false };
  }

  let lot = null;
  let lotCreated = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      lotCreated = false;
      ({ lot } = await resolveImportLot({ restaurantId, importType, importBatch, expiresYMD, session }));
      if (!lot) {
        const [created] = await CouponStockLot.create(
          [{ restaurant: restaurantId, name: importBatch, expiresYMD, note, createdBy }],
          { session },
        );
        lot = created.toObject();
        lotCreated = true;
      }

      const docs = classified.valid.map((code) => ({
        restaurant: restaurantId,
        code,
        expiresYMD,
        lotId: lot._id,
        // ชื่อตามล็อตจริง (ล็อตเดิมอาจพิมพ์ตัวเล็ก/ใหญ่ต่างจากที่กรอกมา)
        importBatch: lot.name || "",
        note,
        status: "available",
      }));
      await CouponStockCode.insertMany(docs, { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }

  return { classified, inserted: classified.valid.length, lot, lotCreated };
}

// POST { restaurantId, codesText, importBatch, expiresYMD, importType?, note? }
//   importType: "new" | "existing" (ไม่ส่ง = แบบเดิม: เติมเข้าล็อตชื่อ+วันหมดอายุเดียวกัน หรือสร้างใหม่)
export async function POST(req) {
  try {
    const ctx = await requirePerm(PERM.FOOD_WRITE);
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const restaurantId = String(body?.restaurantId || "").trim();
    const importBatch = String(body?.importBatch || "").trim();
    const importType = body?.importType || "";

    // ตรวจซ้ำฝั่ง server เสมอ ไม่เชื่อผลจากหน้า preview
    const { restaurant, expiresYMD } = await validateImportTarget({
      restaurantId,
      expiresYMD: body?.expiresYMD,
    });

    const note = String(body?.note || "").trim();
    await validateImportLot({
      restaurantId,
      importType,
      importBatch,
      expiresYMD,
      note,
    });

    // รอบ retry ตรวจรหัสใหม่ทั้งหมด ตัวที่มีคนแทรกระหว่างทางจึงนับเป็น exists เอง
    let result = null;
    for (let attempt = 1; !result; attempt += 1) {
      try {
        result = await writeImport({
          restaurantId,
          importType,
          importBatch,
          expiresYMD,
          note,
          createdBy: ctx?.user?.name || ctx?.user?.username || "",
          codesText: body?.codesText,
        });
      } catch (err) {
        if (isLotNameDup(err)) {
          throw new CouponImportError(`ชื่อล็อต "${importBatch}" มีอยู่แล้วในร้านนี้`, 409);
        }
        if (!isDupKey(err) || attempt >= IMPORT_ATTEMPTS) throw err;
      }
    }

    const { classified, inserted, lot, lotCreated } = result;

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
        skippedExisting: classified.counts.exists,
        skippedDuplicateInPaste: classified.counts.duplicate,
        skippedInvalid: classified.counts.invalid,
        importType,
        lotId: lot ? String(lot._id) : "",
        lotCreated,
      },
      meta: { restaurantId: String(restaurant._id) },
    });

    return NextResponse.json({
      ok: true,
      inserted,
      counts: classified.counts,
      importBatch,
      expiresYMD,
      lotId: lot ? String(lot._id) : null,
    });
  } catch (e) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}
