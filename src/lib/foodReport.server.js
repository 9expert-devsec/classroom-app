// src/lib/foodReport.server.js
// C5b: Food Report — สถานะอาหาร 1 แถวต่อผู้เรียนต่อวัน (server only)
//
// R4-2: แถวของวัน = (คลาสที่วันนั้นเป็นวันเรียน — ไม่รวม Masterclass) × ผู้เรียนของคลาส (ไม่รวมยกเลิก/เลื่อน)
//       + ออเดอร์คูปองที่ไม่อยู่ในชุดนั้น (เหมือนเดิม) · ตัวเลือกอาหารของวันนั้น = แถว FoodChoice ของวันนั้น
//
// ลำดับการตัดสิน (rulings C5):
//   (a) มี LunchOrder ที่ยังไม่ยกเลิก (class + learner + day) → coupon, couponState = status / forfeited
//       ถ้า FoodChoice ของวันนั้นไม่ใช่คูปอง (หรือไม่มี) → flag "mismatch"
//   (b) FoodChoice บอก coupon แต่ไม่มีออเดอร์ → coupon, ขั้นตาม couponStageOf
//   (c) FoodChoice บอก food → set (ร้าน/เมนู/add-on/เครื่องดื่ม/หมายเหตุ)
//   (d) FoodChoice บอก noFood → none
//   (e) ไม่มีแถว FoodChoice → ยังไม่มีผล: วันนี้/อนาคต = "not_chosen" (ยังไม่เลือก), วันที่ผ่านมา = "no_data"
//       ไม่นับในยอดใด ๆ (ร้าน / ประเภท / ไม่รับอาหาร / KPI) — นับแยกใน totals.notChosen / totals.noData
// R4-3: ใครอยู่ในรายงาน (ต่อผู้เรียนต่อวัน)
//   - มีแถว FoodChoice / มีออเดอร์คูปอง -> แสดงเสมอ (ข้อมูลจริง แม้เป็นผู้เรียนออนไลน์)
//   - ออนไลน์ (live ในวันนั้น) และไม่มีแถว -> ไม่แสดง
//   - ในห้อง ไม่มีแถว: วันนี้ = ยังไม่เลือก · วันที่ผ่านมา = ไม่มีข้อมูล เฉพาะคนที่เช็คอินวันนั้น (ไม่เช็คอิน = ไม่แสดง)
//   - R4-4: วันเรียนในอนาคต (นาฬิกา lunch) ไม่มีใครเลือกล่วงหน้าได้ -> ไม่มีแถว = ไม่แสดง
//           (แสดงเฉพาะที่มีแถว FoodChoice / ออเดอร์ — ปกติไม่มี หัวข้อวันนั้นจึงหายไป)
//   "เช็คอินแล้ว" = มี Checkin ของ (ผู้เรียน, คลาส, วันเรียนนั้น) — query เดียว
// ออเดอร์ที่ไม่มี Checkin วันนั้น → flag "no_checkin" (เฉพาะแถวที่มีออเดอร์ เหมือนเดิม)
// ไม่มีราคา/ยอดเงินใน output ใด ๆ
import mongoose from "mongoose";

import Checkin from "@/models/Checkin";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Restaurant from "@/models/Restaurant";
import FoodMenu from "@/models/FoodMenu";
import LunchOrder from "@/models/LunchOrder";
import CouponStockCode from "@/models/CouponStockCode";

import { getOrderCouponSource } from "@/lib/lunchCouponSource";
import { lunchNow } from "@/lib/lunchClock.server";
import { toBkkYMD, finalCloseAt } from "@/lib/lunchConfig";
import { couponStageOf, couponStageLabel } from "@/lib/lunchStage";
import { couponCodeStateOf } from "@/lib/lunchCodeState";
import { computeDayIndexToday } from "@/lib/classDates";
import { getFoodChoicesForRange, foodChoiceKey } from "@/lib/foodChoice.server";

const CLASS_FIELDS = "title courseCode room roomName date startDate days dayCount duration.dayCount duration.startTime classKind";
const STUDENT_FIELDS = "name thaiName engName company classId studentStatus type typeTimeline";

/**
 * R4-3: ประเภทผู้เรียน (classroom | live) ของวันเรียนที่ day — กติกาเดียวกับตารางผู้เรียนของคลาส
 * (getLearnTypeForDay ใน classes/[id]/StudentsTable.jsx): Student.type เป็นค่าตั้งต้น แล้ว
 * typeTimeline ที่ effectiveDay <= day ทับตามลำดับ
 */
function learnTypeOnDay(stu, day) {
  const norm = (t) => (String(t || "").toLowerCase() === "live" ? "live" : "classroom");
  let cur = norm(stu?.type);
  const tl = (Array.isArray(stu?.typeTimeline) ? stu.typeTimeline : [])
    .map((x) => ({ effectiveDay: Number(x?.effectiveDay ?? 1) || 1, type: norm(x?.type) }))
    .sort((a, b) => a.effectiveDay - b.effectiveDay);
  for (const it of tl) if (it.effectiveDay <= Number(day)) cur = it.type;
  return cur;
}

const ORDER_FIELDS =
  "classId studentId dayYMD day status restaurantId restaurantName usesCouponStock " +
  "couponSource couponCode eCouponCode stockCodeId handedOutAt redeemedAt redeemedVia couponVoidedAt couponNotCollectedAt couponNotCollectedStock " +
  "lines.name lines.qty lines.options.choiceName lines.options.groupName lines.note nickname holderName roomName " +
  "submittedAt createdAt";

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
    // R5-5: เรียงกลุ่มคลาสในใบสั่งร้าน ("HH:mm" หรือ "")
    classStartTime: c.duration?.startTime || "",
    // R4-3: จำนวนวันเรียนทั้งหมดของคลาส (หัวข้อ "วันเรียนที่ n/N")
    classDayCount:
      Array.isArray(c.days) && c.days.length
        ? c.days.length
        : Number(c.dayCount || c.duration?.dayCount || 0) || null,
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

// R4-2: อ่านแถว FoodChoice ของวันนั้น — choiceType ตัดสินอย่างเดียว · ไม่มีแถว / ไม่มี choiceType = kind null
function readFoodSource(choice, menuMap, restaurantMap) {
  const f = choice || {};
  const choiceType = cleanLower(f.choiceType);
  const kind =
    choiceType === "coupon" ? "coupon" : choiceType === "nofood" ? "none" : choiceType === "food" ? "set" : null;

  const menuInfo = f.menuId ? menuMap.get(String(f.menuId)) : null;
  const restaurantName =
    (f.restaurantId && restaurantMap.get(String(f.restaurantId))) ||
    (menuInfo?.restaurantId && restaurantMap.get(menuInfo.restaurantId)) ||
    "";

  return {
    kind,
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
    // r2b: เพิ่มชื่อกลุ่มคู่กับค่า (options เดิมคงไว้เหมือนเดิม — export / ตาราง / พิมพ์รายคลาสใช้อยู่)
    // บรรทัดเก่าที่ไม่มีชื่อกลุ่ม -> groupName ""
    optionDetails: (l.options || [])
      .filter((o) => o?.choiceName)
      .map((o) => ({ groupName: o.groupName || "", choiceName: o.choiceName })),
    note: l.note || "",
  }));
}

function sourceOf(order) {
  if (!order.couponSource && !order.restaurantId) return "";
  return getOrderCouponSource(order);
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
  const todayYMD = toBkkYMD(now);

  // R4-2: คลาสที่วันนั้นเป็นวันเรียน (days[] หรือ date + dayCount) — Masterclass ไม่มีขั้นตอนอาหาร
  const classQuery = {
    classKind: { $ne: "masterclass" },
    $or: [
      { days: dateYMD },
      { date: { $gte: new Date(start.getTime() - 60 * 24 * 60 * 60 * 1000), $lt: end } },
    ],
  };
  if (classFilter) classQuery._id = classFilter;
  const dayClasses = (await Class.find(classQuery).select(CLASS_FIELDS).lean())
    .map((c) => ({ c, day: computeDayIndexToday(c, dateYMD) }))
    .filter((x) => x.day);
  const dayByClass = new Map(dayClasses.map((x) => [idStr(x.c._id), x.day]));
  const dayClassIds = dayClasses.map((x) => x.c._id);

  const orderMatch = { dayYMD: dateYMD };
  if (classFilter) orderMatch.classId = classFilter;

  // R4-3: เช็คอินของวันนั้น = Checkin ของ (คลาส, วันเรียนนั้น) — query เดียว
  //        (+ เช็คอินตามเวลาในวันนั้น สำหรับออเดอร์ของคลาสที่ไม่อยู่ในรายชื่อวันเรียน เหมือนเดิม)
  const timeMatch = { time: { $gte: start, $lt: end } };
  if (classFilter) timeMatch.classId = classFilter;
  const ciMatch = {
    $or: [...dayClasses.map((x) => ({ classId: x.c._id, day: x.day })), timeMatch],
  };

  const [classStudents, checkins, allOrders, choices] = await Promise.all([
    dayClassIds.length
      ? Student.find({
          classId: { $in: dayClassIds },
          studentStatus: { $nin: ["cancelled", "postponed"] },
        })
          .select(STUDENT_FIELDS)
          .lean()
      : [],
    Checkin.find(ciMatch).select("classId studentId day time").lean(),
    LunchOrder.find(orderMatch).select(ORDER_FIELDS).lean(),
    getFoodChoicesForRange({
      classIds: classFilter ? [classFilter] : null,
      fromYMD: dateYMD,
      toYMD: dateYMD,
    }),
  ]);

  const liveOrders = allOrders.filter((o) => o.status !== "cancelled");
  const keyOf = (cId, sId) => `${idStr(cId)}:${idStr(sId)}`;
  const liveByKey = new Map();
  for (const o of liveOrders) liveByKey.set(keyOf(o.classId, o.studentId), o); // activeKey: ≤1 ใบ

  // R2b: ใบล่าสุดของแต่ละคน (รวมใบที่ยกเลิก) — บอกขั้นของคนที่เลือกคูปองแต่ไม่มีใบ live
  const latestByKey = new Map();
  for (const o of [...allOrders].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  )) {
    latestByKey.set(keyOf(o.classId, o.studentId), o);
  }
  // เวลาปิดของวันนั้น (finalCloseAt ตาม lunchTimes — เวลาทดสอบใช้ได้)
  const finalCloseTs = finalCloseAt(dateYMD);
  const dayClosed = !!finalCloseTs && now.getTime() >= finalCloseTs.getTime();

  // เช็คอินของวันนั้น (เวลาแรกของแต่ละคน) — คลาสที่วันนั้นเป็นวันเรียน: ต้องเป็น Checkin ของวันเรียนนั้น
  const checkinAt = new Map();
  for (const ch of checkins) {
    const d = dayByClass.get(idStr(ch.classId));
    if (d && Number(ch.day) !== d) continue;
    const k = keyOf(ch.classId, ch.studentId);
    if (!checkinAt.has(k)) checkinAt.set(k, ch.time || null);
  }
  // ผู้เรียนของวันนั้น (คลาส × ผู้เรียน) — ออเดอร์ที่ไม่อยู่ในชุดนี้ยังเป็นแถวเหมือนเดิม (ดึง Student/Class เพิ่ม)
  const rosterKeys = new Set(classStudents.map((s) => keyOf(s.classId, s._id)));
  const orphanOrders = liveOrders.filter((o) => !rosterKeys.has(keyOf(o.classId, o.studentId)));

  const stockIds = [...new Set(allOrders.map((o) => idStr(o.stockCodeId)).filter(Boolean))];
  const [orphanStudents, orphanClasses, stockDocs] = await Promise.all([
    orphanOrders.length
      ? Student.find({ _id: { $in: orphanOrders.map((o) => o.studentId) } }).select(STUDENT_FIELDS).lean()
      : [],
    orphanOrders.length
      ? Class.find({ _id: { $in: orphanOrders.map((o) => o.classId) } }).select(CLASS_FIELDS).lean()
      : [],
    stockIds.length
      ? CouponStockCode.find({ _id: { $in: stockIds } }).select("code status handedOutAt orderId").lean()
      : [],
  ]);
  const studentById = new Map(orphanStudents.map((s) => [idStr(s._id), s]));
  const classById = new Map([
    ...orphanClasses.map((c) => [idStr(c._id), c]),
    ...dayClasses.map((x) => [idStr(x.c._id), x.c]),
  ]);
  for (const c of orphanClasses) {
    if (!dayByClass.has(idStr(c._id))) {
      const d = computeDayIndexToday(c, dateYMD);
      if (d) dayByClass.set(idStr(c._id), d);
    }
  }
  // แถว FoodChoice ของ (ผู้เรียน, คลาส) ในวันนั้น
  const choiceOf = (cId, sId) => {
    const d = dayByClass.get(idStr(cId));
    return d ? choices.get(foodChoiceKey(idStr(sId), idStr(cId), d)) || null : null;
  };
  const stockById = new Map(stockDocs.map((s) => [idStr(s._id), s]));

  // ชื่อร้าน/เมนูของ set (จาก FoodChoice ของวันนั้น)
  const allStudentFoods = [...choices.values()];
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

  function buildRow({ id, date, cls, stu, order, latest = null, hasCheckin }) {
    const choice = choiceOf(cls?._id, stu?._id);
    const src = readFoodSource(choice, menuMap, restaurantMap);
    const flags = [];
    let type;
    let coupon = null;

    if (order) {
      type = "coupon";
      if (src.kind !== "coupon") flags.push("mismatch");
      const couponSource = sourceOf(order);
      const linkedStock = order.stockCodeId ? stockById.get(idStr(order.stockCodeId)) : null;
      // R5-3d: ผู้เรียนไม่มารับคูปอง แอดมินรับรหัสคืนเข้าคลังแล้ว — รายงานของวันนั้นต้องเหมือนเดิม
      //        ใช้ค่าของรหัส ณ ตอนรับคืน (couponNotCollectedStock) ไม่ใช่ค่าปัจจุบันที่อาจเป็นของใบอื่นแล้ว
      const snap = order.couponNotCollectedAt ? order.couponNotCollectedStock : null;
      // R5-3e: สถานะของรหัสนับเฉพาะเมื่อรหัสยังผูกกับใบนี้ (รหัสที่ไปอยู่กับใบอื่นแล้วไม่ใช่ของใบนี้)
      const ownStock =
        linkedStock && idStr(linkedStock.orderId) === idStr(order._id) ? linkedStock : null;
      const stock =
        snap && linkedStock
          ? { ...linkedStock, status: snap.status || "assigned", handedOutAt: snap.handedOutAt || null, orderId: order._id }
          : ownStock;
      // R2b: ขั้นเดียวกับหน้าติดตามการสั่งอาหาร (pending / forfeited / ordered / at_shop)
      const state = couponStageOf({ liveOrder: order, latestOrder: order, finalClosed: dayClosed });
      if (
        couponSource === "stock" &&
        (state === "ordered" || state === "at_shop") &&
        !order.stockCodeId
      ) {
        flags.push("missing_code");
      }
      coupon = {
        couponState: state,
        couponStageLabel: couponStageLabel(state),
        couponCodeState: couponCodeStateOf(order, stock),
        orderId: idStr(order._id),
        couponShopId: idStr(order.restaurantId),
        couponShopName: order.restaurantName || "",
        // ร้าน stock หรือไม่ (snapshot ตอนสั่ง) — ร้าน stock มีได้ทั้งกระดาษและ e-coupon แทน
        couponShopUsesStock: !!order.usesCouponStock,
        couponSource,
        code:
          couponSource === "stock"
            ? stock?.code || linkedStock?.code || order.couponCode || ""
            : order.eCouponCode || order.couponCode || "",
        stockCodeStatus: stock?.status || "",
        // R5-3e: การส่งมอบเป็นของออเดอร์ (order.handedOutAt) — ไม่อ่านจากรหัส (เคยรั่วจากผู้ถือคนก่อน)
        //        ใบที่ประทับ "ไม่มารับ" (R5-3d) ยังอ่านจาก snapshot ตามเดิม
        handedOutAt: snap
          ? order.handedOutAt || stock?.handedOutAt || null
          : order.handedOutAt || null,
        redeemedAt: order.redeemedAt || null,
        lines: orderLines(order),
        // C5d: ใบสั่งร้าน
        orderedAt: order.submittedAt || order.createdAt || null,
        nickname: order.nickname || "",
        orderRoomName: order.roomName || "",
      };
    } else if (src.kind === "coupon") {
      type = "coupon";
      // R2b: แทน "ไม่มีออเดอร์" ด้วยขั้นที่แม่นขึ้น — ยังไม่ได้รับ QR / ยกเลิก รอออก QR ใหม่ / ตัดสิทธิ์
      //      ใบล่าสุดที่ยกเลิกไปแล้วยังบอกได้ว่ารหัส stock รอคืนอยู่ไหม (couponCodeState)
      const stage = couponStageOf({ liveOrder: null, latestOrder: latest, finalClosed: dayClosed });
      const latestStock = latest?.stockCodeId ? stockById.get(idStr(latest.stockCodeId)) : null;
      const codeState = latest ? couponCodeStateOf(latest, latestStock) : null;
      coupon = {
        couponState: stage,
        couponStageLabel: couponStageLabel(stage, codeState),
        couponCodeState: codeState,
        orderId: "",
        couponShopId: "",
        couponShopName: "",
        couponSource: "",
        code: "",
        stockCodeStatus: "",
        handedOutAt: null,
        redeemedAt: null,
        lines: [],
        orderedAt: null,
        nickname: "",
        orderRoomName: "",
      };
    } else if (src.kind) {
      type = src.kind; // set | none
    } else {
      // R4-2: ไม่มีแถว FoodChoice — วันนี้/อนาคต = ยังไม่เลือก, วันที่ผ่านมา = ไม่มีข้อมูล
      type = dateYMD >= todayYMD ? "not_chosen" : "no_data";
    }
    // เช็คอินไม่พบ: แจ้งเฉพาะแถวที่มีออเดอร์คูปอง (เหมือนเดิม)
    if (!hasCheckin && order) flags.push("no_checkin");

    const isCoupon = type === "coupon";
    const isNoFood = type === "none";
    const isSet = type === "set";
    const legacyChoice = isCoupon ? "coupon" : isNoFood ? "noFood" : isSet ? "food" : "";

    return {
      id,
      _id: id,
      date,
      // R4-2: วันเรียนที่เท่าไรของคลาส (หัวกลุ่มวันในรายงาน)
      day: dayByClass.get(idStr(cls?._id)) || null,
      ...classFields(cls),
      ...studentFields(stu),

      // C5b
      type,
      ...(coupon || {
        couponState: "",
        couponStageLabel: "",
        couponCodeState: null,
        orderId: "",
        couponShopId: "",
        couponShopName: "",
        couponSource: "",
        code: "",
        stockCodeStatus: "",
        handedOutAt: null,
        redeemedAt: null,
        lines: [],
        orderedAt: null,
        nickname: "",
        orderRoomName: "",
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

  // R4-3: ใครอยู่ในรายงาน (ดูหัวไฟล์) — แถวที่ไม่มีทั้งแถว FoodChoice และออเดอร์
  const isPastDay = dateYMD < todayYMD;
  const isFutureDay = dateYMD > todayYMD;
  const listed = (stu) => {
    const k = keyOf(stu.classId, stu._id);
    if (choiceOf(stu.classId, stu._id) || liveByKey.has(k)) return true;
    const day = dayByClass.get(idStr(stu.classId));
    if (learnTypeOnDay(stu, day) === "live") return false;
    if (isFutureDay) return false;
    return isPastDay ? checkinAt.has(k) : true;
  };

  // R4-2: id ของแถว = คลาส:ผู้เรียน:วัน (ไม่ซ้ำข้ามวันในช่วง)
  let rows = [
    ...classStudents.filter(listed).map((stu) => {
      const k = keyOf(stu.classId, stu._id);
      return buildRow({
        id: `${idStr(stu.classId)}:${idStr(stu._id)}:${dateYMD}`,
        date: checkinAt.get(k) || null,
        cls: classById.get(idStr(stu.classId)) || { _id: stu.classId },
        stu,
        order: liveByKey.get(k) || null,
        latest: latestByKey.get(k) || null,
        hasCheckin: checkinAt.has(k),
      });
    }),
    ...orphanOrders.map((o) =>
      buildRow({
        id: `lo:${idStr(o._id)}`,
        date: checkinAt.get(keyOf(o.classId, o.studentId)) || null,
        cls: classById.get(idStr(o.classId)) || { _id: o.classId },
        stu: studentById.get(idStr(o.studentId)) || {
          _id: o.studentId,
          name: o.holderName || o.nickname || "",
        },
        order: o,
        hasCheckin: checkinAt.has(keyOf(o.classId, o.studentId)),
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
        r.type === "not_chosen" ? "ยังไม่เลือก" : "",
        r.type === "no_data" ? "ไม่มีข้อมูล" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(ql),
    );
  }

  const summary = summarize(rows, allOrders, stockById);

  // C5d: โลโก้ร้านสำหรับใบสั่งร้าน
  if (summary.shops.length) {
    const logos = await Restaurant.find({ _id: { $in: summary.shops.map((x) => x.id) } })
      .select("logoUrl")
      .lean();
    const logoById = new Map(logos.map((r) => [idStr(r._id), r.logoUrl || ""]));
    for (const shop of summary.shops) shop.logoUrl = logoById.get(shop.id) || "";
  }
  const finalClose = finalCloseAt(dateYMD);

  return {
    rows,
    summary,
    pastDayNote: dateYMD < todayYMD,
    finalClosed: !!finalClose && now.getTime() >= finalClose.getTime(),
  };
}

function emptyTotals() {
  return {
    set: 0,
    none: 0,
    couponActive: 0,
    couponPending: 0,
    forfeited: 0,
    couponNoOrder: 0,
    total: 0,
    // R4-2: ยังไม่มีผล — นับแยก ไม่อยู่ใน total
    notChosen: 0,
    noData: 0,
  };
}

function addToTotals(t, r) {
  if (r.type === "not_chosen") {
    t.notChosen += 1;
    return;
  }
  if (r.type === "no_data") {
    t.noData += 1;
    return;
  }
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
      // R2b: no_qr / cancelled_wait_qr แทน no_order เดิม (นับรวมช่องเดิม)
      else if (["no_qr", "cancelled_wait_qr", "no_order"].includes(r.couponState)) {
        cls.noShopYet.noOrder += 1;
      }
      continue;
    }
    if (!active) continue; // pending/forfeited ที่เลือกร้านแล้วนับใน totals เท่านั้น

    const shopSource = r.couponShopUsesStock || r.couponSource === "stock" ? "stock" : "ecoupon";
    const shop = ensureShop(shops, r.couponShopId, r.couponShopName, shopSource);
    if (shop.source === "stock" && r.couponSource === "ecoupon") {
      // ร้าน stock ที่ออก e-coupon แทนเพราะกระดาษหมด — นับแยกจากกระดาษ
      shop.ecouponIssued += 1;
      if (r.redeemedAt) shop.ecouponRedeemed += 1;
    } else if (shop.source === "stock") {
      shop.orders += 1;
      // R5-3e: ส่งมอบแล้ว = ออเดอร์บันทึกการส่งมอบ (แหล่งเดียวกับ handedOutAt ของแถว)
      if (r.handedOutAt) shop.handedOut += 1;
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
    const stock = stockById.get(sid);
    // R5-3e: นับให้ใบที่รหัสรอคืนจากใบนั้นจริง (รหัสเดียวอาจเคยผ่านหลายใบในวันเดียว)
    if (stock?.status !== "awaiting_return" || idStr(stock.orderId) !== idStr(o._id) || !o.restaurantId) continue;
    seenCodes.add(sid);
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
        ? { id, name, source: "stock", orders: 0, handedOut: 0, assignedNotHandedOut: 0, awaitingReturn: 0, missingCode: 0, ecouponIssued: 0, ecouponRedeemed: 0 }
        : { id, name, source: "ecoupon", issued: 0, redeemed: 0, notRedeemed: 0 },
    );
  }
  const s = shops.get(id);
  if (!s.name && name) s.name = name;
  return s;
}

/**
 * R2b: รหัสคูปองกระดาษที่ "รอคืนอยู่ตอนนี้" ต่อร้าน (ไม่ขึ้นกับช่วงวันที่ที่เลือก)
 * = CouponStockCode.status "awaiting_return" ทั้งหมด — ร้านโผล่ในสรุปตามร้านค้าแม้ไม่มีแถวในช่วงนั้น
 * คืน [{ shopId, shopName, count }]
 */
export async function awaitingReturnByShop() {
  const grouped = await CouponStockCode.aggregate([
    { $match: { status: "awaiting_return" } },
    { $group: { _id: "$restaurant", count: { $sum: 1 } } },
  ]);
  const ids = grouped.map((g) => g._id).filter(Boolean);
  const shops = ids.length
    ? await Restaurant.find({ _id: { $in: ids } }).select("name").lean()
    : [];
  const nameById = new Map(shops.map((r) => [idStr(r._id), r.name || ""]));
  return grouped
    .filter((g) => g._id)
    .map((g) => ({ shopId: idStr(g._id), shopName: nameById.get(idStr(g._id)) || "", count: g.count }))
    .sort((a, b) => a.shopName.localeCompare(b.shopName, "th"));
}
