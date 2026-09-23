// src/models/FoodMenu.js
import mongoose, { Schema } from "mongoose";

// ตัวเลือกย่อยของ option group เช่น "เผ็ดน้อย" / "เพิ่มไข่ดาว (+10)"
const ChoiceSchema = new Schema({
  name: { type: String, required: true, trim: true },
  // ส่วนต่างราคาที่บวกเพิ่มจากราคาเมนู (บวกอย่างเดียว)
  priceDelta: { type: Number, default: 0, min: 0 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

// กลุ่มตัวเลือกของเมนู เช่น "ระดับความเผ็ด" (single) / "เพิ่มท็อปปิ้ง" (multi)
const OptionGroupSchema = new Schema({
  name: { type: String, required: true, trim: true },
  required: { type: Boolean, default: false },
  selectType: { type: String, enum: ["single", "multi"], default: "single" },
  sortOrder: { type: Number, default: 0 },
  choices: { type: [ChoiceSchema], default: [] },
});

const FoodMenuSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },

    // legacy (ยังใช้ในหน้าเช็คอิน / today)
    addons: { type: [String], default: [] }, // ชื่อ add-on
    drinks: { type: [String], default: [] }, // ชื่อ drink

    // ✅ new (ใช้ id จริง)
    addonIds: [{ type: Schema.Types.ObjectId, ref: "FoodAddon" }],
    drinkIds: [{ type: Schema.Types.ObjectId, ref: "FoodDrink" }],

    isActive: { type: Boolean, default: true, index: true },

    // ✅ lunch pre-order (P1a)
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "FoodMenuCategory",
      default: null,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    // null = ยังไม่กำหนดราคา (เมนูเดิมของ flow set-menu ไม่ต้องมีราคา)
    price: { type: Number, default: null, min: 0 },
    description: { type: String, default: "" },
    optionGroups: { type: [OptionGroupSchema], default: [] },
  },
  { timestamps: true },
);

// (optional) กันชื่อเมนูซ้ำในร้านเดียวกัน
FoodMenuSchema.index({ restaurant: 1, name: 1 }, { unique: false });

export default mongoose.models.FoodMenu ||
  mongoose.model("FoodMenu", FoodMenuSchema);
