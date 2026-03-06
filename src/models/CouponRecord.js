// src/models/CouponRecord.js
import mongoose from "mongoose";

const CouponRecordSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },

    // QR ให้ร้านสแกน จะเป็น /m/redeem?c=...
    redeemCipher: { type: String, required: true }, // เก็บ cipher (ถอดได้เฉพาะ server)
    redeemTokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["issued", "redeemed", "void", "expired"],
      default: "issued",
      index: true,
    },

    billId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
      default: null,
    },
    billCode: { type: String, index: true, default: "" },
    billDayYMD: { type: String, index: true, default: "" },

    billTotal: { type: Number, default: 0 },
    billCouponTotal: { type: Number, default: 0 },
    billPayMore: { type: Number, default: 0 },
    billCouponCount: { type: Number, default: 0 },

    // ผูกกับคน/คลาส/วัน
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      index: true,
    },
    dayYMD: { type: String, index: true }, // "YYYY-MM-DD" BKK

    holderName: String,
    courseName: String,
    roomName: String,

    displayCode: { type: String, index: true }, // เช่น 9XP0000

    // ราคา / ยอดจริง
    couponPrice: { type: Number, default: 180 },
    spentAmount: { type: Number, default: 0 },
    diffAmount: { type: Number, default: 0 }, // spent - couponPrice

    // ผูกร้านตอน redeem (สำคัญมาก)
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
      index: true,
    },
    merchantUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MerchantUser",
      default: null,
      index: true,
    },
    redeemedAt: Date,

    expiresAt: { type: Date, index: true },

    // (optional) จำกัดร้านที่ใช้ได้ (รอบแรกใส่ 2 ร้านนี้)
    allowedRestaurantIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" },
    ],
  },
  { timestamps: true },
);

CouponRecordSchema.index(
  { classId: 1, studentId: 1, dayYMD: 1 },
  { unique: true },
);

export default mongoose.models.CouponRecord ||
  mongoose.model("CouponRecord", CouponRecordSchema);
