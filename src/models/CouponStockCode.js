// src/models/CouponStockCode.js
// คูปองกระดาษของร้านที่ import เข้ามาเป็น stock
// ผูกกับออเดอร์ตอน confirm และคืนเข้า stock เมื่อยกเลิก
import mongoose, { Schema } from "mongoose";

const CouponStockCodeSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },

    // ✅ P2: วันหมดอายุที่พิมพ์อยู่บนคูปองของล็อตนั้น (ทั้งล็อตใช้วันเดียวกัน)
    //    เก็บเป็น "YYYY-MM-DD" ไม่ใช่ Date เพื่อไม่ให้เพี้ยนตาม timezone
    expiresYMD: { type: String, required: true, index: true },

    // available       = ว่าง รอจ่าย
    // assigned        = ผูกกับออเดอร์แล้ว
    // handed_out      = ส่งถึงมือผู้เรียนแล้ว
    // awaiting_return = ยกเลิกหลังจ่ายไปแล้ว รอเก็บคืน
    // void            = ตัดออกจากคลัง (พิมพ์ผิด/หาย/ชำรุด)
    status: {
      type: String,
      enum: ["available", "assigned", "handed_out", "awaiting_return", "void"],
      default: "available",
    },

    orderId: {
      type: Schema.Types.ObjectId,
      ref: "LunchOrder",
      default: null,
    },

    assignedAt: { type: Date, default: null },
    handedOutAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },

    // ✅ P2
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: "" },

    importBatch: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

// รหัสห้ามซ้ำภายในร้านเดียวกัน
CouponStockCodeSchema.index({ restaurant: 1, code: 1 }, { unique: true });
// ใช้หยิบใบว่างของร้านตอน confirm
CouponStockCodeSchema.index({ restaurant: 1, status: 1 });
// ✅ P2: หยิบใบว่างที่ยังไม่หมดอายุ เรียงตามวันหมดอายุ (ใช้ก่อนหมดก่อน)
CouponStockCodeSchema.index({ restaurant: 1, status: 1, expiresYMD: 1 });

export default mongoose.models.CouponStockCode ||
  mongoose.model("CouponStockCode", CouponStockCodeSchema);
