// src/models/CouponStockLot.js
// R5-1: ล็อตของคูปองกระดาษ (stock) — 1 ครั้งที่ import "ล็อตใหม่" = 1 เอกสาร
// CouponStockCode.lotId ชี้มาที่นี่ (รหัสยังเก็บ expiresYMD / importBatch ของตัวเองไว้เหมือนเดิม
// เพราะ assignCode + index ใช้ code.expiresYMD และรหัสที่ใช้ไปแล้วต้องคงค่าเดิม)
import mongoose, { Schema } from "mongoose";

/** key สำหรับกันชื่อล็อตซ้ำในร้านเดียวกัน: ตัดช่องว่างหัวท้าย + ตัวเล็ก ("" = ไม่ระบุล็อต) */
export function lotNameKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

const CouponStockLotSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, default: "", trim: true },
    // เขียนจาก name เสมอ (pre-validate) — ใช้กับ unique index ด้านล่าง
    nameKey: { type: String, default: "" },

    // "YYYY-MM-DD" ตาม CouponStockCode.expiresYMD — ค่าปัจจุบันของล็อต
    expiresYMD: { type: String, required: true },
    note: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    cancelReason: { type: String, default: "" },

    createdBy: { type: String, default: "" },

    // R5-2: เวลาที่มีรหัสคืนเข้าคลังล่าสุด — returnCodeToStock เขียนทุกครั้งใน transaction เดียวกับรหัส
    // เพื่อให้ชน (write conflict) กับการแก้/ยกเลิกล็อตที่เกิดพร้อมกัน แทนที่จะคืนรหัสด้วยค่าล็อตเก่า
    lastReturnedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CouponStockLotSchema.pre("validate", function setNameKey() {
  this.nameKey = lotNameKey(this.name);
});

// ชื่อล็อตห้ามซ้ำในร้านเดียวกัน (ไม่สนตัวพิมพ์) — เฉพาะล็อตที่มีชื่อ
// ล็อต "ไม่ระบุ" (nameKey "") มีได้หลายล็อต จึงต้องเป็น partial index
CouponStockLotSchema.index(
  { restaurant: 1, nameKey: 1 },
  {
    unique: true,
    partialFilterExpression: { nameKey: { $gt: "" } },
    name: "restaurant_nameKey_unique_named",
  },
);

// ลงทะเบียน model ใหม่ทุกครั้งที่ไฟล์นี้ถูกโหลด (แบบเดียวกับ LunchOrder / AuditLog)
if (mongoose.models.CouponStockLot) mongoose.deleteModel("CouponStockLot");

export default mongoose.model("CouponStockLot", CouponStockLotSchema);
