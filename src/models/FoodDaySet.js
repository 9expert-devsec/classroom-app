// models/FoodDaySet.js
import mongoose from "mongoose";

const FoodDayEntrySchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    // ไว้ใช้ในอนาคตสำหรับผูกกับ FoodSet (ตอนนี้ยังไม่บังคับ)
    set: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodSet",
      default: null,
    },
    // ✅ โหมดของร้านนี้ "ในวันนั้น" — 1 ร้าน 1 โหมดต่อวัน
    //    set    = flow set-menu เดิม
    //    coupon = ร้านคูปอง (pre-order)
    //    closed = ปิดรับวันนั้น
    mode: { type: String, enum: ["set", "coupon", "closed"], default: "set" },
    // ✅ เมนูที่ร้านแจ้งว่าหมดเฉพาะวันนั้น
    soldOutMenuIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "FoodMenu" }],
      default: [],
    },
  },
  { _id: false }
);

const FoodDaySetSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // 1 วันมี 1 config
    },
    entries: [FoodDayEntrySchema], // [{ restaurant, set, mode, soldOutMenuIds }]
  },
  { timestamps: true }
);

FoodDaySetSchema.index({ date: 1 });

export default mongoose.models.FoodDaySet ||
  mongoose.model("FoodDaySet", FoodDaySetSchema);
