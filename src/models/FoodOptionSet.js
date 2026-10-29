// src/models/FoodOptionSet.js
// OS-1: ชุดตัวเลือกของร้าน (template) เช่น "ระดับความหวาน" สร้างครั้งเดียวแล้วผูกกับหลายเมนู
// เมนูที่ผูกจะได้สำเนาแบบ embedded ใน FoodMenu.optionGroups[] (sourceSetId = ชุดนี้)
// แก้ชุดแล้ว sync สำเนาทุกเมนูใหม่ โดยคง override ของแต่ละเมนูไว้ — ดู lib/foodOptionSets.server.js
import mongoose, { Schema } from "mongoose";
// relative + นามสกุลเต็ม เพื่อให้ import ได้ทั้งใน Next และ Node ตรง ๆ
import { groupLimitsError } from "../lib/optionGroupRules.js";

const SetChoiceSchema = new Schema({
  name: { type: String, required: true, trim: true },
  // ราคาเริ่มต้น (เมนูแต่ละเมนู override ได้)
  priceDelta: { type: Number, default: 0, min: 0 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const FoodOptionSetSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    selectType: { type: String, enum: ["single", "multi"], default: "single" },
    required: { type: Boolean, default: false },
    // null = ไม่จำกัด
    minSelect: { type: Number, default: null, min: 0 },
    maxSelect: { type: Number, default: null, min: 1 },
    sortOrder: { type: Number, default: 0 },
    choices: { type: [SetChoiceSchema], default: [] },
  },
  { timestamps: true, collection: "foodoptionsets" },
);

FoodOptionSetSchema.index({ restaurant: 1, name: 1 }, { unique: true });

// ไม่รับ next (mongoose รุ่นนี้ไม่ส่ง next ให้ hook) — throw = validation ไม่ผ่าน
FoodOptionSetSchema.pre("validate", function checkRules() {
  const msg = groupLimitsError(this);
  if (msg) throw new Error(msg);
  if (this.required && !(this.choices || []).some((c) => c.isActive !== false)) {
    throw new Error(`ชุด "${this.name}" บังคับเลือก — ต้องมีตัวเลือกที่เปิดใช้งานอย่างน้อย 1 รายการ`);
  }
});

export default mongoose.models.FoodOptionSet ||
  mongoose.model("FoodOptionSet", FoodOptionSetSchema);
