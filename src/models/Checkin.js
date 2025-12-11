// src/models/Checkin.js
import mongoose from "mongoose";

const CheckinSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
    day: { type: Number, default: 1 }, // Day 1 / Day 2 ...

    time: Date,
    isLate: { type: Boolean, default: false },

    // เก็บรายละเอียดอาหารตอนเช็คอิน เพื่อใช้ทำ report ตาม class
    food: {
      restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        default: null,
      },
      menu: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FoodMenu",
        default: null,
      },
      addons: { type: [String], default: [] },
      drink: { type: String, default: "" },
      note: { type: String, default: "" },
    },

    // เก็บลิงก์ลายเซ็นเพื่อใช้แสดง thumbnail / popup
    signatureUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Checkin ||
  mongoose.model("Checkin", CheckinSchema);
