// src/models/FoodMenu.js
import mongoose, { Schema } from "mongoose";

// ตัวเลือกย่อยของ option group เช่น "เผ็ดน้อย" / "เพิ่มไข่ดาว (+10)"
const ChoiceSchema = new Schema({
  name: { type: String, required: true, trim: true },
  // ส่วนต่างราคาที่บวกเพิ่มจากราคาเมนู (บวกอย่างเดียว)
  priceDelta: { type: Number, default: 0, min: 0 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },

  // ✅ OS-1: ตัวเลือกที่มาจากชุด (FoodOptionSet) — null = ตัวเลือกของเมนูเอง
  //    priceDelta / isActive ด้านบนเป็นค่าที่มีผลจริงเสมอ (isActive = ชุดเปิด && !hidden)
  sourceChoiceId: { type: Schema.Types.ObjectId, default: null },
  // ซ่อนตัวเลือกนี้เฉพาะเมนูนี้
  hidden: { type: Boolean, default: false },
  // key ที่ไม่มี = ใช้ค่าของชุด
  overrides: {
    type: new Schema({ priceDelta: { type: Number, min: 0 } }, { _id: false }),
    default: undefined,
  },
});

// กลุ่มตัวเลือกของเมนู เช่น "ระดับความเผ็ด" (single) / "เพิ่มท็อปปิ้ง" (multi)
const OptionGroupSchema = new Schema({
  name: { type: String, required: true, trim: true },
  required: { type: Boolean, default: false },
  selectType: { type: String, enum: ["single", "multi"], default: "single" },
  sortOrder: { type: Number, default: 0 },
  choices: { type: [ChoiceSchema], default: [] },

  // ✅ OS-1 (additive ทั้งหมด): null = ไม่จำกัด
  minSelect: { type: Number, default: null, min: 0 },
  maxSelect: { type: Number, default: null, min: 1 },
  // null = กลุ่มของเมนูเอง (แบบเดิม) · มีค่า = สำเนาของชุด ค่าทุกช่องด้านบนคือค่าที่มีผลจริง
  sourceSetId: { type: Schema.Types.ObjectId, default: null },
  // key ที่ไม่มี = ใช้ค่าของชุด
  overrides: {
    type: new Schema(
      {
        required: { type: Boolean },
        minSelect: { type: Number, min: 0 },
        maxSelect: { type: Number, min: 1 },
      },
      { _id: false },
    ),
    default: undefined,
  },
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

    // ✅ lunch pre-order (P1a, ปรับใน P1b-2)
    // 1 เมนูอยู่ได้หลายหมวดของร้านเดียวกัน (เช่น Espresso อยู่ทั้ง "Hot Coffee" และ "แนะนำ")
    // ลำดับใช้ sortOrder ตัวเดียวร่วมกันทุกหมวด
    categoryIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "FoodMenuCategory" }],
      default: [],
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
