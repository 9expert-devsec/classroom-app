// src/lib/lunchOrderRows.server.js
//
// R2b: แถวของหน้า "ติดตามการสั่งอาหาร" — ย้ายออกมาจาก GET /api/admin/lunch/orders
// เพื่อให้การค้นหารหัสคูปองข้ามวัน (/api/admin/lunch/code-search) ได้แถวรูปเดียวกันทุกประการ
// (สถานะ / ปุ่ม / รหัส / ขั้น) ไม่มีตรรกะชุดที่สอง
//
// context = ออเดอร์ทุกใบของ (คลาส, ผู้เรียน, วัน) ที่แถวเหล่านั้นอยู่ — ใช้หา
//   ใบล่าสุด (isLatest) / เคยสั่งแล้ว (R-c) / เหตุผลยกเลิกล่าสุด
// key รวม dayYMD เสมอ จึงใช้ได้ทั้งแบบวันเดียวและข้ามวัน
import mongoose from "mongoose";

import Class from "@/models/Class";
import CouponStockCode from "@/models/CouponStockCode";
import Restaurant from "@/models/Restaurant";

import { computeStatus } from "@/lib/lunchOrders.server";
import { getOrderCouponSource } from "@/lib/lunchCouponSource";
import { reopenBlockedReason, cancelBlockedReason } from "@/lib/lunchAdmin.server";
import { toBkkYMD, finalCloseAt } from "@/lib/lunchConfig";
import { couponStageOf, couponStageLabel } from "@/lib/lunchStage";
import { bangkokHM } from "@/lib/classDates";
import { rowActions } from "@/lib/lunchActions.server";
import { classDayIndexOf } from "@/lib/lunchChoice";
import { getFoodChoicesForRange, foodChoiceKey } from "@/lib/foodChoice.server";
import { couponCodeStateOf } from "@/lib/lunchCodeState";
import { cancelReasonLabel } from "@/lib/lunchCancelReasons";

export const ORDER_ROW_FIELDS =
  "classId studentId dayYMD status deadlineAt holderName nickname courseName roomName restaurantName usesCouponStock couponCode couponSource couponVoidedAt stockCodeId itemsTotal overBudget reopenCount createdAt submittedAt redeemedAt cancelledAt cancelReason cancelledBy handedOutAt handedOutBy activeKey token";

export const CLASS_ROW_FIELDS =
  "title courseName customCourseName room date days dayCount duration.dayCount";

const keyOf = (o) => `${o.classId}:${o.studentId}:${o.dayYMD}`;

/**
 * R3-1: มีคูปองกระดาษรอรับคืน -> ปุ่ม returnCoupon (หนึ่งปุ่มต่อรหัส ตาม pendingReturns ของแถว)
 * รับคืนไม่ติดกติกา "วันนี้ / ก่อน 15:00" (ตามที่ตกลงไว้) · ปุ่ม return เดิมของใบที่ยกเลิก
 * ซ้ำกับรหัสเดียวกันใน pendingReturns จึงเอาออก
 */
function withReturnActions(actions, pendingReturns) {
  if (!pendingReturns.length) return actions;
  const { return: _legacyReturn, ...rest } = actions;
  return { ...rest, returnCoupon: { allowed: true, reason: null } };
}

/**
 * @param rows     ออเดอร์ที่จะทำเป็นแถว (lean, select ORDER_ROW_FIELDS)
 * @param context  ออเดอร์ทุกใบของกลุ่มเดียวกัน (เรียง createdAt จากเก่าไปใหม่)
 * @param classById (optional) Map id -> Class doc (select CLASS_ROW_FIELDS) ที่โหลดไว้แล้ว
 * คืนรายการแถว (รูปเดิมของ /orders)
 */
export async function buildOrderRows({ rows, context, now, classById = null }) {
  const latestByKey = new Map();
  for (const o of context) latestByKey.set(keyOf(o), o);
  const latestIds = new Set([...latestByKey.values()].map((o) => String(o._id)));

  // R-c: "เคยสั่งแล้ว" = ใบใดก็ได้ของคนนั้นในวันนั้นมี submittedAt (ไม่ใช่แค่ใบล่าสุด)
  const placedKeys = new Set(context.filter((o) => !!o.submittedAt).map(keyOf));

  // R2a: เหตุผลของใบที่ถูกยกเลิกล่าสุดของแต่ละคน (context เรียงตาม createdAt -> ใบหลังทับใบก่อน)
  const latestCancelReasonByKey = new Map();
  for (const o of context) {
    if (o.status === "cancelled") latestCancelReasonByKey.set(keyOf(o), o.cancelReason || "");
  }

  // สถานะรหัส stock (ไว้บอกผลของการยกเลิกในหน้าจอ)
  // R3-1: รวมรหัสของทุกใบในกลุ่ม (context) ด้วย — หาคูปองกระดาษที่ยังรอคืนจากใบเก่าของวันนั้น
  const stockIds = [
    ...new Set([...rows, ...context].map((o) => o.stockCodeId).filter(Boolean).map(String)),
  ];
  const stockDocs = stockIds.length
    ? await CouponStockCode.find({ _id: { $in: stockIds } }).select("status orderId code").lean()
    : [];
  const stockById = new Map(stockDocs.map((d) => [String(d._id), d]));

  // R3-1: คูปองกระดาษที่ยังต้องรับคืน (awaiting_return จากใบใดก็ได้ของผู้เรียนคนนั้นในวันนั้น)
  //       เช่น ส่งมอบแล้วถูกโยกร้าน / ยกเลิกเพื่อแก้ไข / ยกเลิกคูปอง — แถวแสดงใบใหม่ จึงต้องบอกแยก
  const pendingReturnsByKey = new Map();
  for (const o of context) {
    const code = o.stockCodeId ? stockById.get(String(o.stockCodeId)) : null;
    if (!code || code.status !== "awaiting_return" || String(code.orderId || "") !== String(o._id)) {
      continue;
    }
    const k = keyOf(o);
    if (!pendingReturnsByKey.has(k)) pendingReturnsByKey.set(k, []);
    pendingReturnsByKey.get(k).push({
      orderId: String(o._id),
      codeId: String(code._id),
      code: code.code || o.couponCode || "",
      restaurantName: o.restaurantName || "",
      reason: o.status === "cancelled" ? cancelReasonLabel(o.cancelReason, { byAdmin: true }) : "",
    });
  }
  // R2a-3: สถานะรหัสนับเฉพาะเมื่อรหัสยังผูกกับใบนี้ — รหัสที่คืนแล้วถูกจองให้ใบอื่น
  //        ต้องไม่ทำให้ใบที่ยกเลิกไปแล้วดูเหมือนยังถือรหัสนั้นอยู่
  const stockStatusOf = (o) => {
    const code = o.stockCodeId ? stockById.get(String(o.stockCodeId)) : null;
    return code && String(code.orderId || "") === String(o._id) ? code.status || "" : "";
  };

  let classes = classById;
  if (!classes) {
    const ids = [...new Set(rows.map((o) => String(o.classId)))];
    const docs = ids.length
      ? await Class.find({ _id: { $in: ids } }).select(CLASS_ROW_FIELDS).lean()
      : [];
    classes = new Map(docs.map((c) => [String(c._id), c]));
  }

  // R2a-2: ตัวเลือกอาหารของผู้เรียน ของคลาส/วันของแถว
  // R4-2: จาก FoodChoice — query เดียวครอบช่วงวันของทุกแถว (ผลค้นหารหัสคูปองอาจข้ามวัน)
  const rowYMDs = rows.map((o) => String(o.dayYMD || "")).filter(Boolean).sort();
  const choices = rowYMDs.length
    ? await getFoodChoicesForRange({
        classIds: [...new Set(rows.map((o) => String(o.classId)))],
        fromYMD: rowYMDs[0],
        toYMD: rowYMDs[rowYMDs.length - 1],
      })
    : new Map();
  const choiceOf = (o) => {
    const day = classDayIndexOf(classes.get(String(o.classId)), o.dayYMD);
    return day ? choices.get(foodChoiceKey(o.studentId, o.classId, day)) || null : null;
  };
  const setRestaurantIds = [
    ...new Set(
      [...choices.values()]
        .filter((c) => c.choiceType === "food")
        .map((c) => String(c.restaurantId || ""))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ];
  const restaurantDocs = setRestaurantIds.length
    ? await Restaurant.find({ _id: { $in: setRestaurantIds } }).select("name").lean()
    : [];
  const restaurantName = new Map(restaurantDocs.map((r) => [String(r._id), r.name || ""]));

  const today = toBkkYMD(now);
  return rows.map((o) => {
    const status = computeStatus(o, now);
    const isLatest = latestIds.has(String(o._id));
    // C1: ยกเลิก / ออก QR ใหม่ ได้เฉพาะใบที่เคยสั่งแล้ว และก่อน 15:00
    // R-c: เคยสั่ง = ใบใดก็ได้ของวันนั้น
    const placedToday = placedKeys.has(keyOf(o));
    const reissueable = status === "cancelled" && isLatest && o.dayYMD === today;
    const reissueBlocked = reissueable ? reopenBlockedReason(o, now, placedToday) : "";
    const cancelBlocked = cancelBlockedReason(o, now);
    const rowStockStatus = stockStatusOf(o);
    const codeDoc = stockById.get(String(o.stockCodeId || "")) || null;
    const codeState = couponCodeStateOf(o, codeDoc);
    const cur = choiceOf(o);
    const currentChoice = cur
      ? {
          choiceType: String(cur.choiceType || ""),
          restaurantName:
            cur.choiceType === "food" ? restaurantName.get(String(cur.restaurantId || "")) || "" : "",
        }
      : null;
    // R2b: ขั้นของคูปอง — ฟังก์ชันเดียวกับ Food Report (src/lib/lunchStage.js)
    const fc = finalCloseAt(o.dayYMD);
    const stage = couponStageOf({
      liveOrder: o.status !== "cancelled" ? o : null,
      latestOrder: o,
      finalClosed: !!fc && now.getTime() >= fc.getTime(),
    });
    const klass = classes.get(String(o.classId));

    return {
      orderId: String(o._id),
      classId: String(o.classId),
      studentId: String(o.studentId),
      dayYMD: o.dayYMD,
      name: o.holderName || "",
      nickname: o.nickname || "",
      // R2b: ชื่อคลาส/ห้อง (ผลค้นหาข้ามวันไม่มีหัวกลุ่มคลาสให้ดู)
      className: klass
        ? klass.customCourseName || klass.courseName || klass.title || ""
        : o.courseName || "",
      room: klass?.room || o.roomName || "",
      status,
      restaurantName: o.restaurantName || "",
      couponCode: o.couponCode || "",
      couponSource: o.couponCode ? getOrderCouponSource(o) : "",
      usesCouponStock: !!o.usesCouponStock,
      stockStatus: rowStockStatus,
      // R2a-3: held / awaiting_return / returned / released / voided (null = ไม่มีรหัส)
      couponCodeState: codeState,
      stage,
      stageLabel: couponStageLabel(stage, codeState),
      // P4b: ส่งมอบ / รับคืน
      stockCodeId: o.stockCodeId ? String(o.stockCodeId) : "",
      handedOutHM: o.handedOutAt ? bangkokHM(o.handedOutAt) : "",
      handedOutBy: o.handedOutBy || "",
      couponVoided: !!o.couponVoidedAt,
      // C2: ร้านใช้คูปองแล้ว
      redeemedHM: o.redeemedAt ? bangkokHM(o.redeemedAt) : "",
      itemsTotal: o.itemsTotal || 0,
      overBudget: o.overBudget || 0,
      deadlineHM: o.deadlineAt ? bangkokHM(o.deadlineAt) : "",
      reopenCount: o.reopenCount || 0,
      cancelReason: o.cancelReason || "",
      // R2a-2: ยกเลิกโดยแอดมิน (ไว้ทำป้าย "ยกเลิกโดยผู้ดูแล" ของใบที่ไม่มีเหตุผล)
      cancelledByAdmin:
        o.status === "cancelled" && !!o.cancelledBy && o.cancelledBy !== "learner",
      isLatest,
      // R2a: ธงของแถว (ไม่ส่ง token ออกไปในรายการเด็ดขาด — ดู QR ผ่าน POST /qr)
      latestCancelReason: latestCancelReasonByKey.get(keyOf(o)) ?? "",
      placedToday,
      hasLiveToken: o.status !== "cancelled" && !!o.activeKey && !!o.token,
      // R2a-2: ตัวเลือกปัจจุบัน + ปุ่มของแถว (ที่เดียวที่ตัดสิน — UI แค่วาดตามนี้)
      currentChoice,
      actions: withReturnActions(
        rowActions({ order: o, status, stockStatus: rowStockStatus, currentChoice, now }),
        pendingReturnsByKey.get(keyOf(o)) || [],
      ),
      // R3-1: คูปองกระดาษที่ต้องรับคืน (ทุกใบของวันนั้น) — [{ orderId, codeId, code, restaurantName, reason }]
      pendingReturns: pendingReturnsByKey.get(keyOf(o)) || [],
      // ใบล่าสุดของวันนี้ถูกยกเลิก + เคยสั่งแล้ว + ก่อน 15:00 -> ออก QR ใหม่ได้
      canReissue: reissueable && !reissueBlocked,
      reissueBlockedReason: reissueBlocked,
      // null = ไม่แสดงปุ่มยกเลิก, "" = กดได้, ข้อความ = แสดงแต่กดไม่ได้
      canCancel: cancelBlocked === "",
      cancelBlockedReason: cancelBlocked || "",
    };
  });
}
