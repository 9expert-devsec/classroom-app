// src/lib/foodReport.server.js
// C5b: Food Report — สถานะอาหาร 1 แถวต่อผู้เรียนต่อวัน (server only)
//
// ลำดับการตัดสิน (rulings C5):
//   (a) มี LunchOrder ที่ยังไม่ยกเลิก (class + learner + day) → coupon, couponState = status / forfeited
//       ถ้า Student.food บอกอย่างอื่น → flag "mismatch"
//   (b) Student.food บอก coupon แต่ไม่มีออเดอร์ → coupon, couponState "no_order"
//   (c) Student.food บอก food → set (ร้าน/เมนู/add-on/เครื่องดื่ม/หมายเหตุ เหมือนเดิม)
//   (d) นอกนั้น → none
// ออเดอร์ที่ไม่มี Checkin วันนั้น → ยังเป็นแถว + flag "no_checkin"
//
// แหล่งข้อมูล set/none = Student.food (ค่าปัจจุบัน) — Checkin.food ไม่ได้เก็บ choice/เมนูจริง
// (สถานะ choice/restaurantId/menuId ถูก strict schema ตัดทิ้งตอน /api/checkin/complete
//  และ /api/checkin/food ไม่ได้เขียน Checkin) จึงส่ง pastDayNote เมื่อดูวันที่ผ่านมาแล้ว
// ไม่มีราคา/ยอดเงินใน output ใด ๆ
import mongoose from "mongoose";

import Checkin from "@/models/Checkin";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import LunchOrder from "@/models/LunchOrder";
import CouponStockCode from "@/models/CouponStockCode";

import { computeStatus } from "@/lib/lunchOrders.server";
import { lunchNow } from "@/lib/lunchClock.server";
import { toBkkYMD, finalCloseAt } from "@/lib/lunchConfig";

const ORDER_FIELDS =
  "classId studentId dayYMD day status restaurantId restaurantName usesCouponStock " +
  "couponSource couponCode eCouponCode stockCodeId handedOutAt redeemedAt redeemedVia " +
  "lines.name lines.qty lines.options.choiceName nickname holderName";

function cleanLower(x) {
  return String(x || "")
    .trim()
    .toLowerCase();
}

function idStr(x) {
  return x ? String(x._id || x) : "";
}

function startOfDayBKK(ymd) {
  return new Date(`${ymd}T00:00:00.000+07:00`);
}

function classFields(cls) {
  const c = cls || {};
  return {
    classId: idStr(c._id),
    className: c.title || c.className || "",
    classTitle: c.title || "",
    courseCode: c.courseCode || "",
    roomName: c.roomName || c.room || "",
    classDate: c.date || c.startDate || null,
  };
}

function studentFields(stu) {
  const s = stu || {};
  return {
    studentId: idStr(s._id),
    studentName: s.name || s.thaiName || s.engName || "",
    studentThaiName: s.thaiName || "",
    studentEngName: s.engName || "",
    company: s.company || "",
  };
}

// อ่าน Student.food แบบเดียวกับ report เดิม (note มีคำว่า coupon ก็นับเป็น coupon)
function readFoodSource(stuFood, menuMap, restaurantMap) {
  const f = stuFood || {};
  const choiceType = cleanLower(f.choiceType);
  const isCoupon = choiceType === "coupon" || cleanLower(f.note).includes("coupon");
  const hasSelection =
    !!f.menuId || !!f.restaurantId || !!f.drink || (Array.isArray(f.addons) && f.addons.length > 0);
  const isNoFood = !isCoupon && (choiceType === "nofood" || f.noFood === true || !hasSelection);

  const menuInfo = f.menuId ? menuMap.get(String(f.menuId)) : null;
  const restaurantName =
    (f.restaurantId && restaurantMap.get(String(f.restaurantId))) ||
    (menuInfo?.restaurantId && restaurantMap.get(menuInfo.restaurantId)) ||
    "";

  return {
    kind: isCoupon ? "coupon" : isNoFood ? "none" : "set",
    restaurantId: f.restaurantId ? String(f.restaurantId) : "",
    menuId: f.menuId ? String(f.menuId) : "",
    restaurantName,
    menuName: menuInfo?.name || "",
    addons: Array.isArray(f.addons) ? f.addons : [],
    drink: f.drink || "",
    note: f.note || "",
  };
}

function orderLines(order) {
  return (order?.lines || []).map((l) => ({
    name: l.name || "",
    qty: Number(l.qty) || 1,
    options: (l.options || []).map((o) => o.choiceName).filter(Boolean),
  }));
}

function sourceOf(order) {
  if (order.couponSource === "stock" || order.couponSource === "ecoupon") return order.couponSource;
  if (!order.restaurantId) return "";
  return order.usesCouponStock ? "stock" : "ecoupon";
}

/**
 * @param {{ dateYMD: string, classId?: string, q?: string }} args
 */
export async function resolveFoodDay({ dateYMD, classId = "", q = "" }) {
  const now = lunchNow();
  const classFilter =
    classId && classId !== "all" && mongoose.Types.ObjectId.isValid(classId)
      ? new mongoose.Types.ObjectId(classId)
      : null;

  const start = startOfDayBKK(dateYMD);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const ciMatch = { time: { $gte: start, $lt: end } };
  if (classFilter) ciMatch.classId = classFilter;

  const orderMatch = { dayYMD: dateYMD };
  if (classFilter) orderMatch.classId = classFilter;

  const [checkins, allOrders] = await Promise.all([
    Checkin.find(ciMatch)
      .populate({ path: "classId", model: Class })
      .populate({ path: "studentId", model: Student })
      .lean(),
    LunchOrder.find(orderMatch).select(ORDER_FIELDS).lean(),
  ]);

  const liveOrders = allOrders.filter((o) => o.status !== "cancelled");
  const keyOf = (cId, sId) => `${idStr(cId)}:${idStr(sId)}`;
  const liveByKey = new Map();
  for (const o of liveOrders) liveByKey.set(keyOf(o.classId, o.studentId), o); // activeKey: ≤1 ใบ

  // ออเดอร์ที่ไม่มี Checkin วันนั้น — ต้องดึง Student/Class เพิ่ม
  const ciKeys = new Set(checkins.map((ch) => keyOf(ch.classId, ch.studentId)));
  const orphanOrders = liveOrders.filter((o) => !ciKeys.has(keyOf(o.classId, o.studentId)));

  const stockIds = [...new Set(allOrders.map((o) => idStr(o.stockCodeId)).filter(Boolean))];
  const [orphanStudents, orphanClasses, stockDocs] = await Promise.all([
    orphanOrders.length
      ? Student.find({ _id: { $in: orphanOrders.map((o) => o.studentId) } }).lean()
      : [],
    orphanOrders.length
      ? Class.find({ _id: { $in: orphanOrders.map((o) => o.classId) } }).lean()
      : [],
    stockIds.length
      ? CouponStockCode.find({ _id: { $in: stockIds } }).select("code status handedOutAt").lean()
      : [],
  ]);
  const studentById = new Map(orphanStudents.map((s) => [idStr(s._id), s]));
  const classById = new Map(orphanClasses.map((c) => [idStr(c._id), c]));
  const stockById = new Map(stockDocs.map((s) => [idStr(s._id), s]));

  // ชื่อร้าน/เมนูของ set (จาก Student.food)
  const allStudentFoods = [
    ...checkins.map((ch) => ch.studentId?.food),
    ...orphanStudents.map((s) => s.food),
  ].filter(Boolean);
  const restaurantIds = new Set();
  const menuIds = new Set();
  for (const f of allStudentFoods) {
    if (f.restaurantId && mongoose.Types.ObjectId.isValid(String(f.restaurantId))) restaurantIds.add(String(f.restaurantId));
    if (f.menuId && mongoose.Types.ObjectId.isValid(String(f.menuId))) menuIds.add(String(f.menuId));
  }
  const menuDocs = menuIds.size
    ? await FoodMenu.find({ _id: { $in: [...menuIds] } }).select("name restaurant").lean()
    : [];
  for (const m of menuDocs) if (m.restaurant) restaurantIds.add(String(m.restaurant));
  const restaurantDocs = restaurantIds.size
    ? await Restaurant.find({ _id: { $in: [...restaurantIds] } }).select("name").lean()
    : [];
  const restaurantMap = new Map(restaurantDocs.map((r) => [idStr(r._id), r.name || ""]));
  const menuMap = new Map(
    menuDocs.map((m) => [idStr(m._id), { name: m.name || "", restaurantId: idStr(m.restaurant) }]),
  );

  function buildRow({ id, date, cls, stu, order, hasCheckin }) {
    const src = readFoodSource(stu?.food, menuMap, restaurantMap);
    const flags = [];
    let type;
    let coupon = null;

    if (order) {
      type = "coupon";
      if (src.kind !== "coupon") flags.push("mismatch");
      const couponSource = sourceOf(order);
      const stock = order.stockCodeId ? stockById.get(idStr(order.stockCodeId)) : null;
      const state = computeStatus(order, now);
      if (
        couponSource === "stock" &&
        (state === "ordered" || state === "at_shop") &&
        !order.stockCodeId
      ) {
        flags.push("missing_code");
      }
      coupon = {
        couponState: state,
        orderId: idStr(order._id),
        couponShopId: idStr(order.restaurantId),
        couponShopName: order.restaurantName || "",
        couponSource,
        code:
          couponSource === "stock"
            ? stock?.code || order.couponCode || ""
            : order.eCouponCode || order.couponCode || "",
        stockCodeStatus: stock?.status || "",
        handedOutAt: order.handedOutAt || stock?.handedOutAt || null,
        redeemedAt: order.redeemedAt || null,
        lines: orderLines(order),
      };
    } else if (src.kind === "coupon") {
      type = "coupon";
      coupon = {
        couponState: "no_order",
        orderId: "",
        couponShopId: "",
        couponShopName: "",
        couponSource: "",
        code: "",
        stockCodeStatus: "",
        handedOutAt: null,
        redeemedAt: null,
        lines: [],
      };
    } else {
      type = src.kind; // set | none
    }
    if (!hasCheckin) flags.push("no_checkin");

    const isCoupon = type === "coupon";
    const isNoFood = type === "none";
    const legacyChoice = isCoupon ? "coupon" : isNoFood ? "noFood" : "food";
    const isSet = type === "set";

    return {
      id,
      _id: id,
      date,
      ...classFields(cls),
      ...studentFields(stu),

      // C5b
      type,
      ...(coupon || {
        couponState: "",
        orderId: "",
        couponShopId: "",
        couponShopName: "",
        couponSource: "",
        code: "",
        stockCodeStatus: "",
        handedOutAt: null,
        redeemedAt: null,
        lines: [],
      }),
      flags,
      hasCheckin,

      // fields เดิม (คงไว้ให้ client เดิมใช้ได้)
      choiceType: legacyChoice,
      isCoupon,
      isNoFood,
      restaurantId: src.restaurantId,
      menuId: src.menuId,
      restaurantName: isSet ? src.restaurantName : "",
      menuName: isSet ? src.menuName : "",
      food: {
        choiceType: legacyChoice,
        coupon: isCoupon,
        noFood: isNoFood,
        restaurantId: src.restaurantId,
        menuId: src.menuId,
        addons: src.addons,
        drink: src.drink,
        note: src.note,
      },
      addons: src.addons,
      drink: src.drink,
      note: src.note,
    };
  }

  let rows = [
    ...checkins.map((ch) =>
      buildRow({
        id: idStr(ch._id),
        date: ch.time,
        cls: ch.classId,
        stu: ch.studentId,
        order: liveByKey.get(keyOf(ch.classId, ch.studentId)) || null,
        hasCheckin: true,
      }),
    ),
    ...orphanOrders.map((o) =>
      buildRow({
        id: `lo:${idStr(o._id)}`,
        date: null,
        cls: classById.get(idStr(o.classId)) || { _id: o.classId },
        stu: studentById.get(idStr(o.studentId)) || {
          _id: o.studentId,
          name: o.holderName || o.nickname || "",
        },
        order: o,
        hasCheckin: false,
      }),
    ),
  ];

  const ql = cleanLower(q);
  if (ql) {
    rows = rows.filter((r) =>
      [
        r.studentName,
        r.studentThaiName,
        r.studentEngName,
        r.company,
        r.className,
        r.courseCode,
        r.roomName,
        r.restaurantName,
        r.menuName,
        r.addons.join(" "),
        r.drink,
        r.note,
        r.couponShopName,
        r.code,
        r.isNoFood ? "ไม่รับอาหาร" : "",
        r.isCoupon ? "coupon" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(ql),
    );
  }

  const summary = summarize(rows, allOrders, stockById);
  const finalClose = finalCloseAt(dateYMD);

  return {
    rows,
    summary,
    pastDayNote: dateYMD < toBkkYMD(now),
    finalClosed: !!finalClose && now.getTime() >= finalClose.getTime(),
  };
}

function emptyTotals() {
  return { set: 0, none: 0, couponActive: 0, couponPending: 0, forfeited: 0, couponNoOrder: 0, total: 0 };
}

function addToTotals(t, r) {
  t.total += 1;
  if (r.type === "set") t.set += 1;
  else if (r.type === "none") t.none += 1;
  else if (r.couponState === "ordered" || r.couponState === "at_shop") t.couponActive += 1;
  else if (r.couponState === "pending") t.couponPending += 1;
  else if (r.couponState === "forfeited") t.forfeited += 1;
  else t.couponNoOrder += 1; // no_order
}

function summarize(rows, allOrders, stockById) {
  const totals = emptyTotals();
  const byClass = new Map();
  const shops = new Map();
  const setCounter = new Map();

  for (const r of rows) {
    addToTotals(totals, r);

    if (!byClass.has(r.classId)) {
      byClass.set(r.classId, {
        classId: r.classId,
        className: r.className,
        totals: emptyTotals(),
        noShopYet: { pending: 0, forfeited: 0, noOrder: 0 },
      });
    }
    const cls = byClass.get(r.classId);
    addToTotals(cls.totals, r);

    if (r.type === "set") {
      const label = r.menuName
        ? r.restaurantName
          ? `${r.restaurantName} — ${r.menuName}`
          : r.menuName
        : r.restaurantName || "-";
      setCounter.set(label, (setCounter.get(label) || 0) + 1);
      continue;
    }
    if (r.type !== "coupon") continue;

    const active = r.couponState === "ordered" || r.couponState === "at_shop";
    if (!r.couponShopId) {
      if (r.couponState === "pending") cls.noShopYet.pending += 1;
      else if (r.couponState === "forfeited") cls.noShopYet.forfeited += 1;
      else if (r.couponState === "no_order") cls.noShopYet.noOrder += 1;
      continue;
    }
    if (!active) continue; // pending/forfeited ที่เลือกร้านแล้วนับใน totals เท่านั้น

    const shop = ensureShop(shops, r.couponShopId, r.couponShopName, r.couponSource);
    if (shop.source === "stock") {
      shop.orders += 1;
      if (r.handedOutAt || r.stockCodeStatus === "handed_out") shop.handedOut += 1;
      else if (r.stockCodeStatus === "assigned") shop.assignedNotHandedOut += 1;
      if (r.flags.includes("missing_code")) shop.missingCode += 1;
    } else {
      shop.issued += 1;
      if (r.redeemedAt) shop.redeemed += 1;
      else shop.notRedeemed += 1;
    }
  }

  // awaiting_return เกิดจากออเดอร์ที่ถูกยกเลิกหลังรับคูปองไปแล้ว — ไล่จากออเดอร์ทั้งวัน
  const seenCodes = new Set();
  for (const o of allOrders) {
    const sid = idStr(o.stockCodeId);
    if (!sid || seenCodes.has(sid)) continue;
    seenCodes.add(sid);
    const stock = stockById.get(sid);
    if (stock?.status !== "awaiting_return" || !o.restaurantId) continue;
    ensureShop(shops, idStr(o.restaurantId), o.restaurantName || "", "stock").awaitingReturn += 1;
  }

  const setMenuCounts = [...setCounter.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));

  const shopList = [...shops.values()].sort(
    (a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, "th"),
  );

  return {
    totals,
    byClass: [...byClass.values()],
    shops: shopList,
    setMenuCounts,
  };
}

function ensureShop(shops, id, name, source) {
  if (!shops.has(id)) {
    shops.set(
      id,
      source === "stock"
        ? { id, name, source: "stock", orders: 0, handedOut: 0, assignedNotHandedOut: 0, awaitingReturn: 0, missingCode: 0 }
        : { id, name, source: "ecoupon", issued: 0, redeemed: 0, notRedeemed: 0 },
    );
  }
  const s = shops.get(id);
  if (!s.name && name) s.name = name;
  return s;
}
