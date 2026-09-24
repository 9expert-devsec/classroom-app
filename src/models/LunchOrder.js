// src/models/LunchOrder.js
// ออเดอร์อาหารกลางวันของผู้เรียน 1 คน ต่อ 1 คลาส ต่อ 1 วัน
import mongoose, { Schema } from "mongoose";
// relative + นามสกุลเต็ม เพื่อให้ import ได้ทั้งใน Next และ Node ตรง ๆ
import { LUNCH_BUDGET_THB } from "../lib/lunchConfig.js";

// ตัวเลือกที่ผู้เรียนเลือกจริงในบรรทัดนั้น (snapshot ทั้งชื่อและราคา)
const LunchOrderOptionSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, default: null },
    groupName: { type: String, default: "" },
    choiceId: { type: Schema.Types.ObjectId, default: null },
    choiceName: { type: String, default: "" },
    priceDelta: { type: Number, default: 0 },
  },
  { _id: false },
);

const LunchOrderLineSchema = new Schema(
  {
    menuId: { type: Schema.Types.ObjectId, ref: "FoodMenu", default: null },
    // snapshot ชื่อเมนู ณ เวลาสั่ง เผื่อเมนูถูกแก้/ลบภายหลัง
    name: { type: String, default: "" },
    // ✅ P3c: snapshot รูปด้วย เพื่อให้หน้าสรุป/ใบสั่งพิมพ์ย้อนหลังได้เหมือนเดิม
    imageUrl: { type: String, default: "" },
    // ราคาต่อหน่วย = ราคาเมนู + priceDelta ของตัวเลือกที่เลือก
    unitPrice: { type: Number, default: 0 },
    qty: { type: Number, default: 1, min: 1 },
    options: { type: [LunchOrderOptionSchema], default: [] },
    note: { type: String, default: "" },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const LunchOrderSchema = new Schema(
  {
    /* ---------------- identity ---------------- */
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    dayYMD: { type: String, required: true, index: true }, // "YYYY-MM-DD" BKK
    day: { type: Number, default: 1 },

    // `${classId}:${studentId}:${dayYMD}` ระหว่างที่ออเดอร์ยัง live
    // และต้อง $unset เมื่อ cancelled
    // unique + sparse = 1 ออเดอร์ที่ยังใช้งานได้ต่อคนต่อคลาสต่อวัน
    // โดยไม่ต้องพึ่ง partial index
    activeKey: { type: String, unique: true, sparse: true },

    /* ---------------- access ---------------- */
    // ✅ P3a: เก็บ token ดิบ เพราะ P4 ต้องพิมพ์ QR ใบเดิมซ้ำได้
    //    (tokenHash ด้านล่างเป็นของเดิมจาก P1a ที่ยังไม่มีใครเขียน — คงไว้เฉย ๆ)
    //    token เป็นความลับเพียงอย่างเดียวที่ใช้เปิดหน้าสั่งอาหาร
    token: { type: String, unique: true, sparse: true },
    tokenHash: { type: String, unique: true, sparse: true },
    // เวลาที่ออก token ใบนี้ (P3a ใช้ field นี้เป็น issuedAt)
    tokenIssuedAt: { type: Date, default: null },
    // หมดเวลาสั่งของออเดอร์นี้ (ปกติ = hard close ของวันนั้น)
    deadlineAt: { type: Date, default: null },
    reopenCount: { type: Number, default: 0 },

    /* ---------------- status ---------------- */
    // "unassigned" ไม่ได้เก็บใน DB — derive เอาจาก pending + เลย deadlineAt
    status: {
      type: String,
      enum: ["pending", "ordered", "at_shop", "cancelled"],
      default: "pending",
      index: true,
    },

    /* ---------------- learner snapshot ---------------- */
    nickname: { type: String, default: "" },
    holderName: { type: String, default: "" },
    courseName: { type: String, default: "" },
    roomName: { type: String, default: "" },

    /* ---------------- restaurant ---------------- */
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    restaurantName: { type: String, default: "" },
    usesCouponStock: { type: Boolean, default: false },

    /* ---------------- lines ---------------- */
    lines: { type: [LunchOrderLineSchema], default: [] },

    /* ---------------- money ---------------- */
    itemsTotal: { type: Number, default: 0 },
    budget: { type: Number, default: LUNCH_BUDGET_THB },
    // ส่วนที่เกินงบ ผู้เรียนจ่ายเองที่ร้าน
    overBudget: { type: Number, default: 0 },

    /* ---------------- coupon ---------------- */
    couponCode: { type: String, default: "" },
    couponSource: {
      type: String,
      // P3d: "ecoupon" คือชื่อที่ lunchSubmit ใช้จริง — "generated" คงไว้เพราะ
      // เป็นชื่อเดิมจาก P1a และเป็นการเพิ่มค่า enum เท่านั้น (additive)
      enum: ["", "generated", "ecoupon", "stock"],
      default: "",
    },
    // เฉพาะรหัสที่ระบบ generate (9XP-XXXX) — ห้ามนำกลับมาใช้ซ้ำ
    eCouponCode: { type: String, unique: true, sparse: true },
    stockCodeId: {
      type: Schema.Types.ObjectId,
      ref: "CouponStockCode",
      default: null,
    },

    /* ---------------- lifecycle ---------------- */
    // ✅ P3c: requestId ของการกดยืนยันครั้งที่สำเร็จ ใช้ตัดสินว่าเป็นการยิงซ้ำ
    //    ของคำขอเดิม (replay) หรือเป็นคำขอใหม่ที่มาช้าไป (already_ordered)
    submitRequestId: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "" },
    printedAt: { type: Date, default: null },
    printedCouponCode: { type: String, default: "" },
  },
  { timestamps: true, collection: "lunchorders" },
);

// หน้า admin: ดูออเดอร์ของคลาสในวันนั้นแยกตามสถานะ
LunchOrderSchema.index({ classId: 1, dayYMD: 1, status: 1 });

export default mongoose.models.LunchOrder ||
  mongoose.model("LunchOrder", LunchOrderSchema);
