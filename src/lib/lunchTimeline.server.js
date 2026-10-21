// src/lib/lunchTimeline.server.js
//
// R2a-2: ประวัติของผู้เรียน 1 คน / 1 คลาส / 1 วัน สำหรับ drawer หน้า "ติดตามการสั่งอาหาร"
// สร้างจากข้อมูลที่มีอยู่แล้ว (ไม่เขียนอะไรเพิ่ม):
//   - LunchOrder ทุกใบของวันนั้น: ออก QR / สั่ง / ส่งมอบ / ร้านใช้ / ยกเลิก / void
//   - AuditLog lunch.* ของใบเหล่านั้น + food update ของผู้เรียนคนนั้นในช่วงวันนั้น (เวลาไทย)
// เหตุการณ์เดียวกันที่มีทั้งจาก field ของออเดอร์และจาก audit (orderId + kind ตรงกัน)
// รวมเป็นรายการเดียว: ใช้ข้อความ/เวลาจากออเดอร์ และชื่อผู้ทำจาก audit
import mongoose from "mongoose";

import LunchOrder from "@/models/LunchOrder";
import AuditLog from "@/models/AuditLog";
import CouponStockCode from "@/models/CouponStockCode";

import { bangkokHM } from "@/lib/classDates";
import { cancelReasonLabel } from "@/lib/lunchCancelReasons";

const CHOICE_LABELS = { food: "Set", noFood: "ไม่รับอาหาร", coupon: "Cash Coupon" };

// audit action -> kind ของเหตุการณ์
const AUDIT_KIND = {
  "lunch.issue": "issued",
  "lunch.reopen": "issued",
  "lunch.submit": "submitted",
  "lunch.handout": "handed_out",
  "lunch.redeem": "redeemed",
  "lunch.cancel": "cancelled",
  "lunch.cancel_choice_changed": "cancelled",
  "lunch.cancel_coupon": "cancelled",
  "lunch.cancel_for_edit": "cancelled",
  "lunch.regenerate": "cancelled",
  "lunch.return": "returned",
  "lunch.view_qr": "view_qr",
  "lunch.special_open": "special_open",
};

const COUPON_EFFECT_LABELS = {
  released: "รหัสคูปองคืนเข้าคลัง",
  awaiting_return: "ต้องรับคูปองกระดาษคืน",
  voided: "e-coupon ถูกยกเลิก",
};

function dayRange(dayYMD) {
  const start = new Date(`${dayYMD}T00:00:00.000+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function joinDetail(parts) {
  return parts.map((s) => String(s || "").trim()).filter(Boolean).join(" · ") || null;
}

function actorNameOf(audit) {
  const name = String(audit?.actor?.name || "").trim();
  const username = String(audit?.actor?.username || "").trim();
  if (username === "learner") return name ? `ผู้เรียน (${name})` : "ผู้เรียน";
  const shown = name || username;
  if (shown.startsWith("merchant:")) return `ร้าน ${shown.slice("merchant:".length)}`;
  return shown || null;
}

// ordered / at_shop ของใบที่ยกเลิกไปแล้ว: สั่งแบบเต็มมีรายการอาหาร แบบย่อไม่มี
function placedMode(order) {
  if (order.status === "at_shop") return "at_shop";
  if (order.status === "ordered") return "order";
  return (order.lines || []).length > 0 ? "order" : "at_shop";
}

/** เหตุการณ์จาก field ของออเดอร์ (ยังไม่มีชื่อผู้ทำ ยกเว้นที่ออเดอร์เก็บไว้เอง) */
function orderEvents(order, stockById) {
  const id = String(order._id);
  const ev = [];
  const push = (e) => ev.push({ orderId: id, actorName: null, ...e });

  push({
    at: order.tokenIssuedAt || order.createdAt,
    kind: "issued",
    label: order.reopenCount > 0 ? "ออก QR ใหม่" : "ออก QR",
    detail: order.deadlineAt ? `ส่งก่อน ${bangkokHM(order.deadlineAt)}` : null,
  });

  if (order.submittedAt) {
    const mode = placedMode(order);
    push({
      at: order.submittedAt,
      kind: "submitted",
      label: mode === "at_shop" ? "ยืนยันไปสั่งที่ร้าน" : "สั่งอาหาร",
      actorName: order.nickname ? `ผู้เรียน (${order.nickname})` : "ผู้เรียน",
      detail: joinDetail([order.restaurantName, order.couponCode]),
    });
  }

  if (order.handedOutAt) {
    push({
      at: order.handedOutAt,
      kind: "handed_out",
      label: "ส่งมอบคูปองกระดาษ",
      actorName: order.handedOutBy || null,
      detail: joinDetail([order.couponCode]),
    });
  }

  if (order.redeemedAt) {
    push({
      at: order.redeemedAt,
      kind: "redeemed",
      label: "ร้านใช้คูปองแล้ว",
      actorName: order.restaurantName ? `ร้าน ${order.restaurantName}` : null,
      detail: joinDetail([order.couponCode, order.redeemedVia === "scan" ? "สแกน" : order.redeemedVia === "typed" ? "พิมพ์รหัส" : ""]),
    });
  }

  if (order.cancelledAt || order.status === "cancelled") {
    const byAdmin = !!order.cancelledBy && order.cancelledBy !== "learner";
    const code = order.stockCodeId ? stockById.get(String(order.stockCodeId)) : null;
    // รหัสยังรอคืนจากใบนี้จริง (รหัสที่คืนแล้วถูกจองให้ใบอื่นไม่นับ)
    const awaitingReturn =
      code?.status === "awaiting_return" && String(code.orderId || "") === id;
    push({
      at: order.cancelledAt || order.updatedAt,
      kind: "cancelled",
      label: `ยกเลิก: ${cancelReasonLabel(order.cancelReason, { byAdmin })}`,
      actorName: order.cancelledBy === "learner" ? "ผู้เรียน" : byAdmin ? "ผู้ดูแล" : null,
      detail: joinDetail([order.restaurantName, order.couponCode]),
      ...(awaitingReturn ? { awaitingReturn: true, stockCodeId: String(code._id) } : {}),
    });
  }

  if (order.couponVoidedAt) {
    push({
      at: order.couponVoidedAt,
      kind: "voided",
      label: "e-coupon ถูกยกเลิก (ร้านรับไม่ได้)",
      detail: joinDetail([order.couponCode]),
    });
  }

  return ev;
}

function auditEvent(a) {
  const isFood = a.entityType === "food";
  const kind = isFood ? "food_choice" : AUDIT_KIND[a.action];
  if (!kind) return null;

  const meta = a.meta || {};
  const base = {
    at: a.createdAt,
    kind,
    orderId: isFood ? null : String(a.entityId || meta.orderId || "") || null,
    actorName: actorNameOf(a),
  };

  if (isFood) {
    const diff = (a.diffs || []).find((d) => d.path === "choiceType");
    const after = diff ? CHOICE_LABELS[diff.after] || diff.after : "";
    return {
      ...base,
      label: after ? `เปลี่ยนตัวเลือกอาหารเป็น ${after}` : "บันทึกตัวเลือกอาหาร",
      detail: joinDetail([meta.day ? `Day ${meta.day}` : ""]),
    };
  }

  const labels = {
    issued: a.action === "lunch.reopen" ? "ออก QR ใหม่" : "ออก QR",
    submitted: "สั่งอาหาร",
    handed_out: "ส่งมอบคูปองกระดาษ",
    redeemed: "ร้านใช้คูปองแล้ว",
    cancelled: `ยกเลิก: ${cancelReasonLabel(meta.reason, { byAdmin: true })}`,
    returned: "รับคูปองคืนแล้ว",
    view_qr: "เปิดดู QR",
    special_open: "เปิดเวลาพิเศษ",
  };
  return {
    ...base,
    label: labels[kind],
    detail: joinDetail([
      meta.couponCode,
      COUPON_EFFECT_LABELS[meta.couponEffect] || "",
    ]),
  };
}

/**
 * คืน { events: [{ at, kind, label, actorName, detail, orderId, awaitingReturn?, stockCodeId? }] }
 * เรียงตามเวลา (เก่า -> ใหม่)
 */
export async function buildLunchTimeline({ classId, studentId, dayYMD }) {
  const cid = new mongoose.Types.ObjectId(String(classId));
  const sid = new mongoose.Types.ObjectId(String(studentId));
  const ymd = String(dayYMD);

  const orders = await LunchOrder.find({ classId: cid, studentId: sid, dayYMD: ymd })
    .select(
      "status tokenIssuedAt createdAt updatedAt deadlineAt reopenCount submittedAt restaurantName couponCode nickname lines.name handedOutAt handedOutBy redeemedAt redeemedVia cancelledAt cancelledBy cancelReason couponVoidedAt stockCodeId",
    )
    .sort({ createdAt: 1 })
    .lean();
  const orderIds = orders.map((o) => String(o._id));

  const stockIds = orders.map((o) => o.stockCodeId).filter(Boolean);
  const { start, end } = dayRange(ymd);

  const [stockDocs, audits] = await Promise.all([
    stockIds.length
      ? CouponStockCode.find({ _id: { $in: stockIds } }).select("status orderId").lean()
      : [],
    AuditLog.find({
      createdAt: { $gte: start, $lt: end },
      $or: [
        ...(orderIds.length ? [{ entityType: "LunchOrder", entityId: { $in: orderIds } }] : []),
        { entityType: "food", "meta.studentId": String(studentId), "meta.classId": String(classId) },
      ],
    })
      .select("action entityType entityId actor diffs meta createdAt")
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const stockById = new Map(stockDocs.map((d) => [String(d._id), d]));

  // ตั้งต้นจาก field ของออเดอร์ แล้วเอาชื่อผู้ทำจาก audit ที่เป็นเหตุการณ์เดียวกันมาทับ
  const byKey = new Map();
  const events = [];
  for (const o of orders) {
    for (const e of orderEvents(o, stockById)) {
      byKey.set(`${e.orderId}:${e.kind}`, e);
      events.push(e);
    }
  }

  for (const a of audits) {
    const e = auditEvent(a);
    if (!e) continue;
    const twin = e.orderId ? byKey.get(`${e.orderId}:${e.kind}`) : null;
    if (twin && !twin.mergedAudit) {
      twin.mergedAudit = true;
      if (e.actorName) twin.actorName = e.actorName;
      if (e.kind === "cancelled" && e.detail) twin.detail = joinDetail([twin.detail, e.detail]);
      continue;
    }
    events.push(e);
  }

  events.sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());

  return {
    events: events.map(({ mergedAudit, ...e }) => ({
      ...e,
      at: e.at ? new Date(e.at).toISOString() : null,
      hm: e.at ? bangkokHM(e.at) : "",
    })),
  };
}
