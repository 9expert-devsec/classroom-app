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

    // available       = ว่าง รอจ่าย
    // assigned        = ผูกกับออเดอร์แล้ว
    // handed_out      = ส่งถึงมือผู้เรียนแล้ว
    // awaiting_return = ยกเลิกหลังจ่ายไปแล้ว รอเก็บคืน
    status: {
      type: String,
      enum: ["available", "assigned", "handed_out", "awaiting_return"],
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

    importBatch: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

// รหัสห้ามซ้ำภายในร้านเดียวกัน
CouponStockCodeSchema.index({ restaurant: 1, code: 1 }, { unique: true });
// ใช้หยิบใบว่างของร้านตอน confirm
CouponStockCodeSchema.index({ restaurant: 1, status: 1 });

export default mongoose.models.CouponStockCode ||
  mongoose.model("CouponStockCode", CouponStockCodeSchema);
