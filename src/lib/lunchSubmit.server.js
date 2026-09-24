// src/lib/lunchSubmit.server.js
//
// ตรรกะการยืนยันออเดอร์อาหารกลางวัน แยกออกจาก route เพื่อให้อ่าน/ทดสอบง่าย
//
// หลักการ:
//   - ราคาคิดที่ server ล้วน ๆ ไม่แตะตัวเลขที่ client ส่งมาเลย
//   - การตัดคูปอง (stock หรือ e-coupon) กับการเปลี่ยนสถานะ ต้องอยู่ใน
//     transaction เดียวกัน ไม่งั้นคูปองหลุดไปโดยออเดอร์ไม่เปลี่ยนสถานะ
//   - การเปลี่ยนสถานะเป็น conditional update ถ้าไม่ match แปลว่ามีคนยิงพร้อมกัน
//     แล้วชนะไปก่อน -> abort แล้วไปใช้กติกา replay

import mongoose from "mongoose";
import crypto from "node:crypto";

import LunchOrder from "@/models/LunchOrder";
import FoodMenu from "@/models/FoodMenu";
import Restaurant from "@/models/Restaurant";

import { LUNCH_BUDGET_THB, isValidNickname } from "@/lib/lunchConfig";
import { getDaySet, getCouponAvailability } from "@/lib/couponAvailability.server";
import { assignCode } from "@/lib/couponStock.server";

/* ---------------- limits ---------------- */

export const MAX_LINES = 30;
export const MAX_QTY = 20;
export const MAX_NOTE = 200;
const ECOUPON_ATTEMPTS = 5;

// ตัด 0 O 1 I L ออก เพราะอ่านจากกระดาษแล้วสับสน
const ECOUPON_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateECouponCode() {
  let out = "";
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i += 1) {
    out += ECOUPON_ALPHABET[bytes[i] % ECOUPON_ALPHABET.length];
  }
  return `9XP-${out}`;
}

/* ---------------- errors ---------------- */

export class SubmitError extends Error {
  constructor({ status, reason, message, field, lineIndex, extra }) {
    super(message);
    this.name = "SubmitError";
    this.status = status;
    this.reason = reason;
    this.field = field;
    this.lineIndex = lineIndex;
    this.extra = extra || null;
  }
}

function fail(status, reason, message, extra = {}) {
  throw new SubmitError({ status, reason, message, ...extra });
}

/* ---------------- validation + pricing ---------------- */

function asInt(x) {
  const n = Number(x);
  return Number.isInteger(n) ? n : NaN;
}

/**
 * ตรวจ lines + คิดราคาใหม่ทั้งหมดจากข้อมูลใน DB
 * ราคา/ชื่อ ที่ client ส่งมาถูกทิ้งทั้งหมดโดยตั้งใจ
 */
export async function buildLines({ rawLines, restaurantId, daySet }) {
  const lines = Array.isArray(rawLines) ? rawLines : [];

  if (lines.length < 1 || lines.length > MAX_LINES) {
    fail(422, "lines_count", `จำนวนรายการต้องอยู่ระหว่าง 1 ถึง ${MAX_LINES}`);
  }

  const entry = (daySet?.entries || []).find(
    (e) => String(e.restaurant) === String(restaurantId),
  );
  const soldOut = new Set((entry?.soldOutMenuIds || []).map((x) => String(x)));

  const menuIds = lines.map((l) => String(l?.menuId || ""));
  const menus = await FoodMenu.find({
    _id: { $in: menuIds.filter((x) => mongoose.Types.ObjectId.isValid(x)) },
    restaurant: restaurantId,
    isActive: { $ne: false },
  }).lean();
  const menuById = new Map(menus.map((m) => [String(m._id), m]));

  const out = [];
  let itemsTotal = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] || {};
    const at = { lineIndex: i };

    const menu = menuById.get(String(raw.menuId || ""));
    if (!menu) {
      fail(422, "menu_not_found", "เมนูนี้ไม่มีอยู่ในร้านที่เลือก", at);
    }
    if (soldOut.has(String(menu._id))) {
      fail(422, "menu_sold_out", `เมนู "${menu.name}" วันนี้หมดแล้ว`, at);
    }
    if (menu.price === null || menu.price === undefined) {
      fail(422, "menu_no_price", `เมนู "${menu.name}" ยังไม่ได้ตั้งราคา`, at);
    }

    const qty = asInt(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      fail(422, "qty", `จำนวนต้องเป็นตัวเลข 1 ถึง ${MAX_QTY}`, at);
    }

    const note = String(raw.note || "").trim();
    if (note.length > MAX_NOTE) {
      fail(422, "note_too_long", `หมายเหตุยาวเกิน ${MAX_NOTE} ตัวอักษร`, at);
    }

    // ---- options ----
    const sentByGroup = new Map();
    for (const c of Array.isArray(raw.choices) ? raw.choices : []) {
      const gid = String(c?.groupId || "");
      const ids = (Array.isArray(c?.choiceIds) ? c.choiceIds : []).map(String);
      if (gid) sentByGroup.set(gid, ids);
    }

    const chosen = [];
    let optionDelta = 0;

    for (const group of menu.optionGroups || []) {
      const gid = String(group._id);
      const ids = sentByGroup.get(gid) || [];
      const activeChoices = (group.choices || []).filter(
        (ch) => ch?.isActive !== false,
      );

      if (group.required && ids.length < 1) {
        fail(422, "option_required", `กรุณาเลือก "${group.name}"`, at);
      }
      if (group.selectType !== "multi" && ids.length > 1) {
        fail(
          422,
          "option_single_only",
          `"${group.name}" เลือกได้ข้อเดียว`,
          at,
        );
      }

      for (const cid of ids) {
        const choice = activeChoices.find((ch) => String(ch._id) === cid);
        if (!choice) {
          fail(
            422,
            "option_invalid",
            `ตัวเลือกใน "${group.name}" ไม่ถูกต้อง`,
            at,
          );
        }
        const delta = Number(choice.priceDelta) || 0;
        optionDelta += delta;
        chosen.push({
          groupId: group._id,
          groupName: group.name || "",
          choiceId: choice._id,
          choiceName: choice.name || "",
          priceDelta: delta,
        });
      }

      // กลุ่มบังคับที่ไม่มีตัวเลือกเปิดใช้งานเลย = ตั้งค่าเมนูผิด
      if (group.required && activeChoices.length === 0) {
        fail(
          422,
          "option_group_empty",
          `"${group.name}" ยังไม่มีตัวเลือกให้เลือก`,
          at,
        );
      }
    }

    const unitPrice = Number(menu.price) + optionDelta;
    const lineTotal = unitPrice * qty;
    itemsTotal += lineTotal;

    out.push({
      menuId: menu._id,
      name: menu.name || "",
      imageUrl: menu.imageUrl || "",
      unitPrice,
      qty,
      options: chosen,
      note,
      lineTotal,
    });
  }

  return { lines: out, itemsTotal };
}

/* ---------------- the submit ---------------- */

/**
 * คืน { replay: true, order } เมื่อเป็นการยิงซ้ำด้วย requestId เดิม
 * หรือ { order } เมื่อสำเร็จ
 * ปัญหาอื่น ๆ โยน SubmitError ออกไปให้ route แปลงเป็น response
 */
export async function submitLunchOrder({ order, body, now = new Date() }) {
  const requestId = String(body?.requestId || "").trim();
  if (!requestId) {
    fail(422, "request_id", "ข้อมูลไม่ครบ (requestId)", { field: "requestId" });
  }

  // --- 2) replay / already ordered ---
  if (order.status === "ordered" || order.status === "at_shop") {
    if (order.submitRequestId && order.submitRequestId === requestId) {
      return { replay: true, order };
    }
    fail(409, "already_ordered", "รายการนี้ถูกยืนยันไปแล้ว");
  }

  // --- 3) window (server clock only) ---
  const deadline = order.deadlineAt ? new Date(order.deadlineAt) : null;
  if (deadline && new Date(now).getTime() >= deadline.getTime()) {
    fail(403, "closed", "ปิดรับออเดอร์แล้ว กรุณาติดต่อเจ้าหน้าที่ที่ Counter");
  }

  // --- 4) nickname ---
  const nickname = String(body?.nickname || "").trim();
  if (!isValidNickname(nickname)) {
    fail(
      422,
      "nickname",
      "ชื่อเล่นต้องเป็นภาษาอังกฤษ 1-20 ตัวอักษร",
      { field: "nickname" },
    );
  }

  const mode = String(body?.mode || "").trim();
  if (mode !== "order" && mode !== "at_shop") {
    fail(422, "mode", "โหมดการสั่งไม่ถูกต้อง", { field: "mode" });
  }

  // --- 5) restaurant must be coupon mode that day, and usable ---
  const restaurantId = String(body?.restaurantId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    fail(422, "restaurant", "กรุณาเลือกร้าน", { field: "restaurantId" });
  }

  const daySet = await getDaySet(order.dayYMD);
  const avail = await getCouponAvailability({
    classDoc: { disableCoupon: false },
    dayYMD: order.dayYMD,
    daySet,
  });

  const picked = (avail.couponRestaurants || []).find(
    (r) => r.restaurantId === restaurantId,
  );
  if (!picked) {
    fail(409, "restaurant_unavailable", "ร้านนี้ไม่เปิดรับคูปองในวันนี้");
  }

  const restaurant = await Restaurant.findById(restaurantId)
    .select("name logoUrl usesCouponStock")
    .lean();
  if (!restaurant) {
    fail(409, "restaurant_unavailable", "ร้านนี้ไม่เปิดรับคูปองในวันนี้");
  }

  // --- 6/7) lines + pricing ---
  let lines = [];
  let itemsTotal = 0;

  if (mode === "at_shop") {
    const sent = Array.isArray(body?.lines) ? body.lines : [];
    if (sent.length > 0) {
      fail(422, "lines_not_allowed", "โหมดไปสั่งเองที่ร้านต้องไม่มีรายการอาหาร");
    }
  } else {
    const built = await buildLines({
      rawLines: body?.lines,
      restaurantId,
      daySet,
    });
    lines = built.lines;
    itemsTotal = built.itemsTotal;
  }

  const budget = LUNCH_BUDGET_THB;
  const overBudget = itemsTotal > budget ? itemsTotal - budget : 0;

  // --- 8) coupon + status change, in ONE transaction ---
  const usesCouponStock = !!restaurant.usesCouponStock;
  const nextStatus = mode === "at_shop" ? "at_shop" : "ordered";
  const at = new Date(now);

  const session = await mongoose.startSession();
  let updated = null;
  let raced = false;

  try {
    await session.withTransaction(async () => {
      let couponCode = "";
      let couponSource = "";
      let stockCodeId = null;
      let eCouponCode;

      if (usesCouponStock) {
        const code = await assignCode({
          restaurantId,
          dayYMD: order.dayYMD,
          orderId: order._id,
          session,
        });
        if (!code) {
          // ทั้ง transaction ถูกยกเลิก ออเดอร์ยังเป็น pending เหมือนเดิม
          fail(409, "sold_out", "คูปองร้านนี้หมดแล้ว กรุณาเลือกร้านอื่น");
        }
        couponCode = code.code;
        couponSource = "stock";
        stockCodeId = code._id;
      } else {
        couponSource = "ecoupon";
      }

      const base = {
        status: nextStatus,
        nickname,
        restaurantId: restaurant._id,
        restaurantName: restaurant.name || "",
        usesCouponStock,
        lines,
        itemsTotal,
        budget,
        overBudget,
        couponSource,
        stockCodeId,
        submitRequestId: requestId,
        submittedAt: at,
      };

      // เงื่อนไขสำคัญ: ต้องยังเป็น pending และ activeKey ยังอยู่
      const filter = {
        _id: order._id,
        status: "pending",
        activeKey: { $exists: true },
      };

      if (usesCouponStock) {
        updated = await LunchOrder.findOneAndUpdate(
          filter,
          { $set: { ...base, couponCode } },
          { new: true, session },
        ).lean();
      } else {
        // e-coupon: ลองจนกว่าจะไม่ชนรหัสซ้ำ
        let lastErr = null;
        for (let i = 0; i < ECOUPON_ATTEMPTS; i += 1) {
          eCouponCode = generateECouponCode();
          try {
            updated = await LunchOrder.findOneAndUpdate(
              filter,
              { $set: { ...base, couponCode: eCouponCode, eCouponCode } },
              { new: true, session },
            ).lean();
            lastErr = null;
            break;
          } catch (err) {
            if (err?.code === 11000) {
              lastErr = err;
              continue;
            }
            throw err;
          }
        }
        if (lastErr) throw lastErr;
      }

      if (!updated) {
        // มีคนยิงพร้อมกันแล้วชนะไปก่อน -> ยกเลิกทั้งก้อน
        // (คูปอง stock ที่เพิ่งจองก็ถูก rollback ไปด้วย)
        raced = true;
        throw new SubmitError({
          status: 409,
          reason: "__raced__",
          message: "raced",
        });
      }
    });
  } catch (err) {
    if (raced || err?.reason === "__raced__") {
      // อ่านใหม่แล้วใช้กติกา replay เดียวกับข้อ 2
      const fresh = await LunchOrder.findById(order._id).lean();
      if (
        fresh &&
        (fresh.status === "ordered" || fresh.status === "at_shop") &&
        fresh.submitRequestId === requestId
      ) {
        return { replay: true, order: fresh };
      }
      fail(409, "already_ordered", "รายการนี้ถูกยืนยันไปแล้ว");
    }
    throw err;
  } finally {
    await session.endSession();
  }

  return { order: updated };
}
