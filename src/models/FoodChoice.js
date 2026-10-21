// src/models/FoodChoice.js
// R4-1: ตัวเลือกอาหารรายวัน — 1 แถวต่อ (ผู้เรียน, คลาส, วันเรียน)
//
// Student.food เก็บค่าเดียวต่อผู้เรียนต่อคลาส (ถูกเขียนทับทุกวัน) จึงดูย้อนหลังไม่ได้
// collection นี้เก็บแยกรายวัน · ไม่มีแถว = วันนั้นยังไม่ได้เลือก (ไม่มีการยกของวันก่อนมา)
// R4-1: เขียนคู่กับ Student.food (mirror ของ "วันนี้") ใน transaction เดียว — ยังไม่มีใครอ่าน (R4-2)
// food fields รูปเดียวกับ Student.food ทุกตัว
import mongoose from "mongoose";

const FoodChoiceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    // วันเรียนที่เท่าไรของคลาส (ความหมายเดียวกับ Student.food.day)
    day: { type: Number, required: true },
    // "YYYY-MM-DD" เวลาไทย ของวันเรียนนั้น (จาก days[] ของคลาส)
    dayYMD: { type: String, default: "" },

    /* ---------------- food (รูปเดียวกับ Student.food) ---------------- */
    // food = เลือกอาหาร Set · noFood = ไม่รับอาหาร · coupon = Cash Coupon
    choiceType: { type: String, enum: ["food", "noFood", "coupon", ""], default: "" },
    noFood: { type: Boolean, default: true }, // legacy flag
    restaurantId: { type: String, default: "" },
    menuId: { type: String, default: "" },
    addons: { type: [String], default: [] },
    drink: { type: String, default: "" },
    addonIds: { type: [String], default: [] },
    drinkId: { type: String, default: "" },
    note: { type: String, default: "" },

    /* ---------------- trace ---------------- */
    source: {
      type: String,
      enum: ["kiosk", "admin", "reassign", "system", "backfill"],
      default: "system",
    },
    // เฉพาะ source = backfill: มาจากอะไร
    backfillFrom: { type: String, enum: ["", "food_edit_log", "student_food"], default: "" },
    // ผู้บันทึกล่าสุด (username / ชื่อแท็บเล็ต / "backfill")
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "food_choices" },
);

FoodChoiceSchema.index({ studentId: 1, classId: 1, day: 1 }, { unique: true });
FoodChoiceSchema.index({ classId: 1, dayYMD: 1 });
FoodChoiceSchema.index({ dayYMD: 1 });

// ลงทะเบียน model ใหม่ทุกครั้งที่ไฟล์นี้ถูกโหลด (แบบเดียวกับ LunchOrder / AuditLog)
// dev server (hot reload) จะได้ schema ล่าสุด · production โหลดครั้งเดียวต่อ process จึงเหมือนเดิม
if (mongoose.models.FoodChoice) mongoose.deleteModel("FoodChoice");

export default mongoose.model("FoodChoice", FoodChoiceSchema);
