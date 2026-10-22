// src/lib/couponStockLots.server.js
//
// R5-1: ล็อตคูปองกระดาษ (CouponStockLot) — จัดกลุ่มรหัสตาม "การใช้งาน" + ประเมินผลกระทบก่อนแก้/ลบ/ยกเลิกล็อต
// ไฟล์นี้อ่านอย่างเดียว ไม่เขียนอะไรลง DB (R5-2/R5-3 เป็นคนเขียน โดยเช็ก impactHash กับที่นี่)
//
// คูปองกระดาษตามไม่ได้ว่าร้านรับไปแล้วหรือยัง จึงถือว่า "ยื่นให้ผู้เรียน = ใช้แล้ว" เว้นแต่ได้กระดาษคืนเข้าคลัง
//
//   status            เงื่อนไข                    bucket
//   available         -                          unused
//   void              -                          void    (นับแยก แต่ยังเป็นเป้าของการแก้ล็อต)
//   assigned          วันอบรม <  วันนี้            unused  + staleAssigned (นับแยก)
//   assigned          วันอบรม >= วันนี้            active
//   handed_out        ทุกวัน                      used
//   awaiting_return   -                          used    (กระดาษยังอยู่นอกคลัง)
//
// "เคยถูกใช้" (ลบล็อตไม่ได้) = มีออเดอร์ใดเคยอ้างถึงรหัส (stockCodeId) หรือสถานะไม่ใช่ available/void

import crypto from "node:crypto";
import mongoose from "mongoose";
import CouponStockCode from "@/models/CouponStockCode";
import CouponStockLot, { lotNameKey } from "@/models/CouponStockLot";
import LunchOrder from "@/models/LunchOrder";
import { isYMD } from "@/lib/classDates";
import { toBkkYMD } from "@/lib/lunchConfig";

export const LOT_NAME_MAX = 100;
export const LOT_ACTIONS = ["edit", "delete", "cancel"];

// bucket ที่รับวันหมดอายุใหม่ตอนแก้ล็อต — "used" คงค่าเดิม
const EXPIRY_TARGET_BUCKETS = new Set(["unused", "void", "active"]);

export class LotImpactError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LotImpactError";
    this.status = status;
  }
}

function idStr(x) {
  return x ? String(x) : "";
}

function learnerLabelOf(order) {
  if (!order) return "";
  const who = order.holderName || order.nickname || "";
  return [who, order.courseName].filter(Boolean).join(" · ");
}

/* ---------------- classify ---------------- */

/**
 * จัด bucket ให้รหัสทีละใบ — โหลดออเดอร์ที่ผูกอยู่ด้วย query เดียว
 * codes: [{ _id, code, status, orderId, expiresYMD }]
 * คืน Map<codeId, { bucket, staleAssigned, dayYMD, orderId, learnerLabel }>
 *
 * ออเดอร์ของรหัส = code.orderId (assign/handOut/release เขียนไว้เสมอ)
 * ข้อมูลเก่าที่ไม่มี orderId: หาออเดอร์ที่ยังไม่ถูกยกเลิกซึ่งอ้าง stockCodeId นี้
 */
export async function classifyStockCodes(codes, todayYMD = toBkkYMD(new Date()), { session = null } = {}) {
  const list = Array.isArray(codes) ? codes : [];
  const orderIds = list.map((c) => c.orderId).filter(Boolean);
  const orphanIds = list.filter((c) => !c.orderId && c.status === "assigned").map((c) => c._id);

  const or = [];
  if (orderIds.length) or.push({ _id: { $in: orderIds } });
  if (orphanIds.length) or.push({ stockCodeId: { $in: orphanIds }, status: { $ne: "cancelled" } });

  const orders = or.length
    ? await LunchOrder.find({ $or: or })
        .select("_id dayYMD status stockCodeId holderName nickname courseName roomName")
        .session(session)
        .lean()
    : [];
  const byId = new Map(orders.map((o) => [idStr(o._id), o]));
  const byStockCode = new Map(
    orders.filter((o) => o.stockCodeId && o.status !== "cancelled").map((o) => [idStr(o.stockCodeId), o]),
  );

  const out = new Map();
  for (const c of list) {
    const order = byId.get(idStr(c.orderId)) || (c.orderId ? null : byStockCode.get(idStr(c._id))) || null;
    const dayYMD = order?.dayYMD || "";
    let bucket = "unused";
    let staleAssigned = false;

    if (c.status === "void") bucket = "void";
    else if (c.status === "handed_out" || c.status === "awaiting_return") bucket = "used";
    else if (c.status === "assigned") {
      // ไม่พบออเดอร์ (dayYMD ว่าง) ถือเป็น active ไว้ก่อน — ปลอดภัยกว่าการปล่อยให้แก้เหมือนของว่าง
      if (dayYMD && dayYMD < todayYMD) staleAssigned = true;
      else bucket = "active";
    }

    out.set(idStr(c._id), {
      bucket,
      staleAssigned,
      dayYMD,
      orderId: order ? idStr(order._id) : idStr(c.orderId),
      learnerLabel: learnerLabelOf(order),
      // R5-3d: ใช้แสดงรายการค้างจอง (ชื่อ / ชื่อเล่น / คลาส / ห้อง)
      learner: order
        ? {
            holderName: order.holderName || "",
            nickname: order.nickname || "",
            courseName: order.courseName || "",
            roomName: order.roomName || "",
          }
        : null,
    });
  }
  return out;
}

/* ---------------- return to stock (R5-2) ---------------- */

// voidReason ของรหัสที่ถูก void เพราะล็อตถูกยกเลิก — restore คืนเฉพาะรหัสที่มีเหตุผลนี้
export const LOT_CANCELLED_REASON = "LOT_CANCELLED";

/**
 * จุดเดียวที่รหัสกลับเข้าคลัง (releaseCode: assigned, confirmReturn: awaiting_return)
 *   ล็อตถูกยกเลิก  -> void (LOT_CANCELLED)
 *   ล็อตปกติ       -> available + ดึง expiresYMD / importBatch จากล็อต
 *                    (กระดาษที่อยู่นอกคลังตอนแก้ล็อต ได้ค่าล่าสุดตอนกลับเข้ามา)
 *   ไม่มี lotId     -> available แบบเดิม (ไม่ควรมีหลัง backfill) + warning
 *
 * fromStatus = สถานะที่ต้องเป็นอยู่ (conditional update เหมือนเดิม) · set = field ที่ caller ล้าง/ตั้งเพิ่ม
 * คืน doc หลังเขียน หรือ null ถ้ารหัสไม่ได้อยู่ใน fromStatus
 *
 * เขียน lastReturnedAt ของล็อตใน transaction เดียวกัน: แก้/ยกเลิกล็อตพร้อมกัน = write conflict -> retry
 * ไม่ส่ง session มา = เปิด transaction เอง
 */
export async function returnCodeToStock(codeId, { fromStatus, set = {}, session = null } = {}) {
  if (!session) {
    const own = await mongoose.startSession();
    try {
      let doc = null;
      await own.withTransaction(async () => {
        doc = await returnCodeToStock(codeId, { fromStatus, set, session: own });
      });
      return doc;
    } finally {
      await own.endSession();
    }
  }

  const code = await CouponStockCode.findById(codeId).select("_id code status lotId").session(session).lean();
  if (!code || code.status !== fromStatus) return null;

  const lot = code.lotId
    ? await CouponStockLot.findById(code.lotId).select("name expiresYMD status").session(session).lean()
    : null;

  let back;
  if (lot?.status === "cancelled") {
    back = { status: "void", voidedAt: new Date(), voidReason: LOT_CANCELLED_REASON };
  } else if (lot) {
    back = { status: "available", expiresYMD: lot.expiresYMD, importBatch: lot.name || "" };
  } else {
    console.warn(
      `[couponStockLots] code ${code.code} (${idStr(code._id)}) returned to stock without a lot` +
        (code.lotId ? ` (lot ${idStr(code.lotId)} missing)` : " (no lotId)"),
    );
    back = { status: "available" };
  }

  if (lot) {
    await CouponStockLot.updateOne({ _id: lot._id }, { $set: { lastReturnedAt: new Date() } }, { session });
  }

  // R5-3e: การส่งมอบเป็นเหตุการณ์ของออเดอร์ (order.handedOutAt) — handedOutAt ของรหัสบอกแค่ผู้ถือปัจจุบัน
  //         กลับเข้าคลัง (หรือ void) = ไม่มีผู้ถือแล้ว จึงล้าง ไม่ให้ค่าเก่ารั่วไปถึงผู้ถือคนถัดไป
  //         returnedAt คงไว้ (เป็นประวัติของตัวรหัสเอง: คืนเข้าคลังครั้งล่าสุดเมื่อไร ไม่ผูกกับผู้ถือ)
  return CouponStockCode.findOneAndUpdate(
    { _id: code._id, status: fromStatus },
    { $set: { ...set, ...back, handedOutAt: null } },
    { new: true, session },
  ).lean();
}

/* ---------------- ever used ---------------- */

/** ล็อตนี้เคยมีรหัสถูกใช้ไหม (true = ลบล็อตไม่ได้ ต้อง "ยกเลิกที่เหลือ" แทน) */
export async function isLotEverUsed(lotId, { session = null } = {}) {
  const codes = await CouponStockCode.find({ lotId }).select("_id status").session(session).lean();
  if (codes.some((c) => c.status !== "available" && c.status !== "void")) return true;
  if (codes.length === 0) return false;
  const ref = await LunchOrder.exists({ stockCodeId: { $in: codes.map((c) => c._id) } }).session(session);
  return !!ref;
}

/* ---------------- impact (dry run) ---------------- */

function hashImpact(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function codeRow(c, info) {
  return {
    codeId: idStr(c._id),
    code: c.code,
    status: c.status,
    bucket: info.bucket,
    staleAssigned: info.staleAssigned,
    expiresYMD: c.expiresYMD,
    importBatch: c.importBatch || "",
    dayYMD: info.dayYMD,
  };
}

/**
 * ผลกระทบของการแก้/ลบ/ยกเลิกล็อต — ไม่เขียนอะไรเลย
 *   edit           : newName? / newExpiresYMD? (ต้องมีอย่างน้อย 1 อย่าง)
 *   delete, cancel : R5-2 server เป็นคนตัดสิน (delete-or-cancel) — ทั้งสอง action ให้ผลชุดเดียวกัน
 *                    decision = "delete" (ไม่เคยใช้) | "cancel" (เคยใช้) และ hash เดียวกัน
 *
 * ok = ไม่มี errors และไม่มี blockers
 * impactHash: endpoint ที่เขียนจริงคำนวณใหม่ใน transaction ถ้าไม่ตรง = มีอะไรเปลี่ยนตั้งแต่ preview -> 409
 * session: ส่งมาเมื่อเรียกจากใน transaction (อ่านด้วย snapshot เดียวกับที่จะเขียน)
 */
export async function computeLotImpact({ lotId, newName, newExpiresYMD, action, todayYMD, session = null } = {}) {
  if (!LOT_ACTIONS.includes(action)) throw new LotImpactError("action ไม่ถูกต้อง");
  if (!lotId || !mongoose.isValidObjectId(lotId)) throw new LotImpactError("lotId ไม่ถูกต้อง");

  const lot = await CouponStockLot.findById(lotId).session(session).lean();
  if (!lot) throw new LotImpactError("ไม่พบล็อต", 404);

  const today = todayYMD || toBkkYMD(new Date());
  const codes = await CouponStockCode.find({ lotId: lot._id })
    .select("_id code status orderId expiresYMD importBatch")
    .sort({ _id: 1 })
    .session(session)
    .lean();
  const info = await classifyStockCodes(codes, today, { session });
  const rows = codes.map((c) => codeRow(c, info.get(idStr(c._id))));

  const counts = { total: rows.length, unused: 0, void: 0, active: 0, used: 0, staleAssigned: 0 };
  for (const r of rows) {
    counts[r.bucket] += 1;
    if (r.staleAssigned) counts.staleAssigned += 1;
  }

  const errors = [];
  const warnings = [];
  const blockers = [];
  const inputs = {};
  const result = {
    lot: {
      _id: idStr(lot._id),
      restaurant: idStr(lot.restaurant),
      name: lot.name || "",
      expiresYMD: lot.expiresYMD,
      status: lot.status,
      cancelledAt: lot.cancelledAt || null,
    },
    action,
    today,
    counts,
  };

  if (action === "edit") {
    if (lot.status === "cancelled") {
      errors.push({ field: "lot", code: "lot_cancelled", message: "ล็อตนี้ถูกยกเลิกแล้ว กู้คืนล็อตก่อนจึงจะแก้ไขได้" });
    }

    const hasName = newName !== undefined && newName !== null;
    const hasExpiry = newExpiresYMD !== undefined && newExpiresYMD !== null && newExpiresYMD !== "";
    if (!hasName && !hasExpiry) throw new LotImpactError("กรุณาระบุชื่อล็อตหรือวันหมดอายุใหม่");

    const edit = { nameChanged: false, expiryChanged: false };

    if (hasName) {
      const name = String(newName).trim();
      inputs.newName = name;
      if (!name) {
        errors.push({ field: "name", code: "name_required", message: "กรุณาระบุชื่อล็อต" });
      } else if (name.length > LOT_NAME_MAX) {
        errors.push({ field: "name", code: "name_too_long", message: `ชื่อล็อตต้องไม่เกิน ${LOT_NAME_MAX} ตัวอักษร` });
      } else {
        const dup = await CouponStockLot.exists({
          restaurant: lot.restaurant,
          nameKey: lotNameKey(name),
          _id: { $ne: lot._id },
        }).session(session);
        if (dup) {
          errors.push({ field: "name", code: "name_taken", message: `ชื่อล็อต "${name}" มีอยู่แล้วในร้านนี้` });
        }
      }
      edit.nameChanged = name !== (lot.name || "");
      // ชื่อใหม่ไปทุกใบในล็อต (รวมที่ใช้ไปแล้ว)
      edit.renameCodes = rows.map((r) => r.code);
      edit.renameCodesChanging = rows.filter((r) => r.importBatch !== name).length;
    }

    if (hasExpiry) {
      const ymd = String(newExpiresYMD).slice(0, 10);
      inputs.newExpiresYMD = ymd;
      if (!isYMD(ymd)) {
        errors.push({ field: "expiresYMD", code: "expiry_invalid", message: "วันหมดอายุไม่ถูกต้อง" });
      } else {
        if (ymd < today) {
          errors.push({ field: "expiresYMD", code: "expiry_past", message: "วันหมดอายุต้องไม่เป็นวันที่ผ่านมาแล้ว" });
        } else if (ymd === today) {
          warnings.push({ field: "expiresYMD", code: "expiry_today", message: "ล็อตนี้จะหมดอายุสิ้นวันนี้" });
        }

        // รหัสที่ยังถูกจองให้วันอบรมหลังวันหมดอายุใหม่ = จะหมดอายุก่อนถึงวันใช้จริง
        for (const r of rows) {
          if (r.bucket === "active" && r.dayYMD && r.dayYMD > ymd) {
            const i = info.get(r.codeId);
            blockers.push({ code: r.code, dayYMD: r.dayYMD, learnerLabel: i.learnerLabel, orderId: i.orderId });
          }
        }
      }
      edit.expiryChanged = ymd !== lot.expiresYMD;
      const targets = rows.filter((r) => EXPIRY_TARGET_BUCKETS.has(r.bucket));
      edit.expiryCodes = targets.map((r) => r.code);
      edit.expiryCodeIds = targets.map((r) => r.codeId);
      edit.expiryCodesChanging = targets.filter((r) => r.expiresYMD !== ymd).length;
      edit.keepExpiryCodes = rows.filter((r) => !EXPIRY_TARGET_BUCKETS.has(r.bucket)).map((r) => ({
        code: r.code,
        status: r.status,
        expiresYMD: r.expiresYMD,
      }));
    }

    result.edit = edit;
  }

  if (action === "delete" || action === "cancel") {
    const everUsed = await isLotEverUsed(lot._id, { session });
    result.decision = everUsed ? "cancel" : "delete";
    result.delete = { deletable: !everUsed, everUsed, codes: rows.length };
    result.cancel = {
      voidCount: rows.filter((r) => r.status === "available").length,
      awaitingReturnOut: rows.filter((r) => r.status === "awaiting_return").length,
      // ยังถูกจองอยู่ — ยกเลิกล็อตไม่แตะ (ผู้เรียนรออยู่) · คืนเข้าคลังทีหลังจะถูก void เอง
      stillAssigned: rows.filter((r) => r.status === "assigned").length,
      handedOut: rows.filter((r) => r.status === "handed_out").length,
      alreadyVoid: counts.void,
    };
    // ล็อตที่ยกเลิกแล้วยังลบได้ถ้าไม่เคยใช้ · เคยใช้ = ยกเลิกซ้ำไม่ได้
    if (everUsed && lot.status === "cancelled") {
      errors.push({ field: "lot", code: "already_cancelled", message: "ล็อตนี้ถูกยกเลิกไปแล้ว" });
    }
  }

  result.inputs = inputs;
  result.errors = errors;
  result.warnings = warnings;
  result.blockers = blockers;
  result.ok = errors.length === 0 && blockers.length === 0;
  result.codes = rows;
  result.impactHash = hashImpact({
    lotId: idStr(lot._id),
    // delete กับ cancel เป็นคำขอเดียวกัน (server ตัดสินเอง) จึงใช้ key เดียวกัน
    action: action === "edit" ? "edit" : "remove",
    inputs,
    lot: { name: lot.name || "", expiresYMD: lot.expiresYMD, status: lot.status },
    codes: rows.map((r) => [r.codeId, r.status, r.bucket, r.staleAssigned, r.expiresYMD, r.importBatch]),
    decision: result.decision || "",
  });

  return result;
}

/* ---------------- write paths (R5-2) ---------------- */

export const AUDIT_ID_CAP = 200;

/** ตัด list id สำหรับ audit (ไม่ให้เอกสาร audit ใหญ่เกิน) */
export function capAuditIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  return { ids: list.slice(0, AUDIT_ID_CAP), total: list.length, truncated: list.length > AUDIT_ID_CAP };
}

/** error ของการเขียนล็อต — มี code + รายละเอียด (errors / blockers / impact) ให้หน้าจอแสดง */
export class LotWriteError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "LotWriteError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// 409 เมื่อชนกับสถานะ (ชื่อซ้ำ / ล็อตถูกยกเลิก) · 400 เมื่อ input ผิด
const CONFLICT_CODES = new Set(["name_taken", "lot_cancelled", "already_cancelled"]);

function assertImpact(impact, impactHash) {
  if (!impactHash || impactHash !== impact.impactHash) {
    throw new LotWriteError(409, "impact_changed", "ข้อมูลล็อตเปลี่ยนไปตั้งแต่ตรวจสอบ กรุณาตรวจสอบใหม่", { impact });
  }
  if (impact.errors.length) {
    const first = impact.errors[0];
    throw new LotWriteError(CONFLICT_CODES.has(first.code) ? 409 : 400, first.code, first.message, {
      errors: impact.errors,
    });
  }
  if (impact.blockers.length) {
    throw new LotWriteError(
      409,
      "expiry_blocked",
      `มี ${impact.blockers.length} รหัสที่ถูกจองให้วันอบรมหลังวันหมดอายุใหม่`,
      { blockers: impact.blockers },
    );
  }
}

async function inTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

/**
 * แก้ชื่อ/วันหมดอายุของล็อต
 *   ชื่อ       -> ล็อต + importBatch ของทุกใบ (รวมที่ใช้แล้ว)
 *   วันหมดอายุ -> ล็อต + รหัส bucket unused/void/active · used คงค่าเดิม
 * คืน { impact, before, after, changedCodeIds }
 */
export async function editLot({ lotId, newName, newExpiresYMD, impactHash }) {
  try {
    return await inTransaction(async (session) => {
      const impact = await computeLotImpact({ lotId, newName, newExpiresYMD, action: "edit", session });
      assertImpact(impact, impactHash);

      const lot = impact.lot;
      const set = {};
      const changed = new Set();

      if (impact.inputs.newName !== undefined) {
        const name = impact.inputs.newName;
        set.name = name;
        // updateOne ไม่ผ่าน pre("validate") -> ตั้ง nameKey เอง
        set.nameKey = lotNameKey(name);
        await CouponStockCode.updateMany({ lotId: lot._id }, { $set: { importBatch: name } }, { session });
        impact.codes.filter((r) => r.importBatch !== name).forEach((r) => changed.add(r.codeId));
      }

      if (impact.inputs.newExpiresYMD !== undefined) {
        const ymd = impact.inputs.newExpiresYMD;
        set.expiresYMD = ymd;
        const ids = impact.edit.expiryCodeIds;
        if (ids.length) {
          await CouponStockCode.updateMany({ _id: { $in: ids } }, { $set: { expiresYMD: ymd } }, { session });
        }
        const idSet = new Set(ids);
        impact.codes.filter((r) => idSet.has(r.codeId) && r.expiresYMD !== ymd).forEach((r) => changed.add(r.codeId));
      }

      await CouponStockLot.updateOne({ _id: lot._id }, { $set: set }, { session });

      return {
        impact,
        before: { name: lot.name, expiresYMD: lot.expiresYMD },
        after: { name: set.name ?? lot.name, expiresYMD: set.expiresYMD ?? lot.expiresYMD },
        changedCodeIds: [...changed],
      };
    });
  } catch (e) {
    // ชื่อซ้ำที่หลุดการตรวจเพราะมีคนบันทึกพร้อมกัน -> partial unique index จับได้
    if (e?.code === 11000 && /nameKey/.test(String(e?.message || ""))) {
      throw new LotWriteError(409, "name_taken", `ชื่อล็อต "${String(newName).trim()}" มีอยู่แล้วในร้านนี้`);
    }
    throw e;
  }
}

/**
 * ลบ หรือ ยกเลิกล็อต — server ตัดสินจาก isLotEverUsed (ใน transaction)
 *   delete : ไม่เคยใช้ -> ลบเอกสารล็อต + รหัสทั้งหมด
 *   cancel : เคยใช้   -> ล็อต cancelled + void รหัส available ทุกใบ (LOT_CANCELLED)
 *            รหัสที่ assigned ไม่แตะ (ผู้เรียนรออยู่) — คืนเข้าคลังทีหลังจะถูก void โดย returnCodeToStock
 */
export async function deleteOrCancelLot({ lotId, impactHash, reason = "", by = "" }) {
  return inTransaction(async (session) => {
    const impact = await computeLotImpact({ lotId, action: "delete", session });
    assertImpact(impact, impactHash);
    const lot = impact.lot;

    if (impact.decision === "delete") {
      const full = await CouponStockLot.findById(lot._id).session(session).lean();
      await CouponStockCode.deleteMany({ lotId: lot._id }, { session });
      await CouponStockLot.deleteOne({ _id: lot._id }, { session });
      return {
        decision: "delete",
        impact,
        lotBefore: full,
        codes: impact.codes.map((r) => ({ codeId: r.codeId, code: r.code, status: r.status, expiresYMD: r.expiresYMD })),
      };
    }

    const now = new Date();
    const ids = impact.codes.filter((r) => r.status === "available").map((r) => r.codeId);
    if (ids.length) {
      const res = await CouponStockCode.updateMany(
        { _id: { $in: ids }, status: "available" },
        { $set: { status: "void", voidedAt: now, voidReason: LOT_CANCELLED_REASON } },
        { session },
      );
      // hash ตรงแล้วแต่จำนวนไม่ตรง = snapshot ไม่ตรงกับที่เขียน (ไม่ควรเกิดใน transaction)
      if (res.modifiedCount !== ids.length) {
        throw new LotWriteError(409, "impact_changed", "ข้อมูลล็อตเปลี่ยนไประหว่างบันทึก กรุณาตรวจสอบใหม่");
      }
    }
    await CouponStockLot.updateOne(
      { _id: lot._id },
      {
        $set: {
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: String(by || ""),
          cancelReason: String(reason || "").trim(),
        },
      },
      { session },
    );

    return { decision: "cancel", impact, cancelledAt: now, voidedIds: ids };
  });
}

/**
 * กู้ล็อตที่ถูกยกเลิก — ได้เสมอ
 * คืนเฉพาะรหัสที่ void ด้วย LOT_CANCELLED หลังเวลายกเลิกล็อต (ยังเป็น void อยู่) -> available
 * (รวมรหัสที่ returnCodeToStock void ไว้ระหว่างที่ล็อตถูกยกเลิก) · รหัสที่ void ทีละใบด้วยเหตุผลอื่นคงเดิม
 * expiredWarning = วันหมดอายุของล็อตผ่านไปแล้ว (รหัสกลับมาแต่ assignCode จะไม่หยิบ)
 */
export async function restoreLot({ lotId }) {
  if (!lotId || !mongoose.isValidObjectId(lotId)) throw new LotWriteError(400, "bad_request", "lotId ไม่ถูกต้อง");

  return inTransaction(async (session) => {
    const lot = await CouponStockLot.findById(lotId).session(session).lean();
    if (!lot) throw new LotWriteError(404, "not_found", "ไม่พบล็อต");
    if (lot.status !== "cancelled") throw new LotWriteError(409, "not_cancelled", "ล็อตนี้ไม่ได้ถูกยกเลิก");

    const filter = { lotId: lot._id, status: "void", voidReason: LOT_CANCELLED_REASON };
    if (lot.cancelledAt) filter.voidedAt = { $gte: lot.cancelledAt };
    const ids = (await CouponStockCode.find(filter).select("_id").session(session).lean()).map((c) => idStr(c._id));

    if (ids.length) {
      await CouponStockCode.updateMany(
        { _id: { $in: ids }, status: "void" },
        {
          $set: {
            status: "available",
            voidedAt: null,
            voidReason: "",
            // ตรงกับ returnCodeToStock: รหัสที่กลับเข้าคลังได้ค่าล็อตล่าสุด
            expiresYMD: lot.expiresYMD,
            importBatch: lot.name || "",
            // R5-3e: รหัสในคลังไม่มีผู้ถือ
            handedOutAt: null,
          },
        },
        { session },
      );
    }

    await CouponStockLot.updateOne(
      { _id: lot._id },
      { $set: { status: "active", cancelledAt: null, cancelledBy: "", cancelReason: "" } },
      { session },
    );

    return {
      lot: { _id: idStr(lot._id), name: lot.name || "", expiresYMD: lot.expiresYMD, status: "active" },
      lotBefore: {
        status: lot.status,
        cancelledAt: lot.cancelledAt,
        cancelledBy: lot.cancelledBy,
        cancelReason: lot.cancelReason,
      },
      restoredIds: ids,
      expiredWarning: lot.expiresYMD < toBkkYMD(new Date()),
    };
  });
}

/** JSON error ของ endpoint ล็อต: { ok:false, error, code, ...extra (errors / blockers / impact) } */
export function lotErrorResponse(e) {
  return Response.json(
    { ok: false, error: e?.message || "Server error", code: e?.code || "", ...(e?.extra || {}) },
    { status: e?.status || 500 },
  );
}

/* ---------------- stale bookings (R5-3d) ---------------- */

/**
 * รับคืนคูปองกระดาษที่ "ค้างจอง" (assigned แต่วันเรียนผ่านไปแล้ว) เมื่อแอดมินได้กระดาษกลับมา
 * ไม่มีการคืนอัตโนมัติ — แอดมินเลือกเองทีละใบ / บางส่วนของล็อตได้ (ใบที่หายใช้ void รายใบตามเดิม)
 *
 * ทั้งหมดใน transaction เดียว: ทุกใบต้องยังเป็น assigned + ค้างจอง และอยู่ในล็อตนี้
 * ไม่ผ่านแม้ใบเดียว = 409 stale_changed (ไม่มีอะไรถูกเขียน) พร้อมรายการที่ไม่ผ่าน
 *
 * ต่อใบ: ออเดอร์ "ไม่แตะ" สถานะ / ทางเลือก / stockCodeId / couponCode (วันที่ผ่านไปแล้วแก้ไม่ได้ —
 *        รายงานอาหารของวันนั้นต้องเหมือนเดิม) แค่ประทับ couponNotCollectedAt/By
 *        แล้วรหัสกลับเข้าคลังผ่าน returnCodeToStock (ล็อตปกติ = available ตามค่าล็อต · ล็อตยกเลิก = void)
 * คืน { lot, results: [{ codeId, code, orderId, dayYMD, result }] }
 */
export async function releaseStaleCodes({ lotId, codeIds, by = "" }) {
  if (!lotId || !mongoose.isValidObjectId(lotId)) throw new LotWriteError(400, "bad_request", "lotId ไม่ถูกต้อง");
  const ids = [...new Set((Array.isArray(codeIds) ? codeIds : []).map(String))];
  if (ids.length === 0) throw new LotWriteError(400, "bad_request", "กรุณาเลือกรหัสที่จะรับคืน");
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new LotWriteError(400, "bad_request", "รหัสไม่ถูกต้อง");

  return inTransaction(async (session) => {
    const lot = await CouponStockLot.findById(lotId).session(session).lean();
    if (!lot) throw new LotWriteError(404, "not_found", "ไม่พบล็อต");

    const today = toBkkYMD(new Date());
    const codes = await CouponStockCode.find({ _id: { $in: ids } })
      .select("_id code status orderId lotId expiresYMD handedOutAt")
      .session(session)
      .lean();
    const info = await classifyStockCodes(codes, today, { session });

    const found = new Map(codes.map((c) => [idStr(c._id), c]));
    const offenders = [];
    for (const id of ids) {
      const c = found.get(id);
      const i = c ? info.get(id) : null;
      if (!c) offenders.push({ codeId: id, code: "", reason: "not_found" });
      else if (idStr(c.lotId) !== idStr(lot._id)) offenders.push({ codeId: id, code: c.code, reason: "other_lot" });
      else if (c.status !== "assigned") offenders.push({ codeId: id, code: c.code, reason: c.status });
      else if (!i?.staleAssigned) offenders.push({ codeId: id, code: c.code, reason: "not_stale" });
    }
    if (offenders.length) {
      throw new LotWriteError(
        409,
        "stale_changed",
        `มี ${offenders.length} รหัสที่ไม่ได้ค้างจองแล้ว (สถานะเปลี่ยนระหว่างนี้)`,
        { offenders },
      );
    }

    const now = new Date();
    const results = [];
    for (const c of codes) {
      const i = info.get(idStr(c._id));
      // ประทับเฉพาะออเดอร์ที่ยังอ้างรหัสนี้อยู่ — ไม่แตะ field อื่น
      // + เก็บสิ่งที่รายงานอาหารอ่านจากรหัสไว้ (สถานะ / handedOutAt) ให้รายงานวันนั้นคงเดิมตลอดไป
      const upd = await LunchOrder.updateOne(
        { _id: i.orderId, stockCodeId: c._id },
        {
          $set: {
            couponNotCollectedAt: now,
            couponNotCollectedBy: String(by || ""),
            couponNotCollectedStock: { status: c.status, handedOutAt: c.handedOutAt || null },
          },
        },
        { session },
      );
      if (upd.matchedCount !== 1) {
        throw new LotWriteError(409, "stale_changed", `ออเดอร์ของรหัส ${c.code} เปลี่ยนไปแล้ว`, {
          offenders: [{ codeId: idStr(c._id), code: c.code, reason: "order_changed" }],
        });
      }
      const doc = await returnCodeToStock(c._id, {
        fromStatus: "assigned",
        set: { orderId: null, assignedAt: null },
        session,
      });
      if (!doc) {
        throw new LotWriteError(409, "stale_changed", `รหัส ${c.code} เปลี่ยนสถานะไปแล้ว`, {
          offenders: [{ codeId: idStr(c._id), code: c.code, reason: "status_changed" }],
        });
      }
      results.push({ codeId: idStr(c._id), code: c.code, orderId: i.orderId, dayYMD: i.dayYMD, result: doc.status });
    }

    return {
      lot: { _id: idStr(lot._id), name: lot.name || "", status: lot.status, restaurant: idStr(lot.restaurant) },
      results,
    };
  });
}
