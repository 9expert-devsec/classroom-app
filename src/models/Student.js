// src/models/Student.js
import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },

    // ✅ new: ใช้ชื่อเดียว
    name: { type: String, default: "" },

    // legacy (ยังคงไว้เพื่อ backward compat / migrate ทีหลัง)
    thaiName: { type: String, default: "" },
    engName: { type: String, default: "" },

    company: { type: String, default: "" },

    // QT/IV/RP
    paymentRef: { type: String, default: "" },

    // การรับเอกสาร (ช่องทาง)
    documentReceiveType: {
      type: String,
      enum: ["ems", "on_class"],
      default: "ems",
    },
    documentReceivedAt: { type: Date, default: null },

    // ลายเซ็นรับเอกสาร (denormalized for admin/report)
    documentReceiptSigUrl: { type: String, default: "" },
    documentReceiptSigPublicId: { type: String, default: "" },
    documentReceiptSignedAt: { type: Date, default: null },

    // สถานะเช็คอินในแต่ละวัน
    checkinStatus: {
      day1: { type: Boolean, default: false },
      day2: { type: Boolean, default: false },
      day3: { type: Boolean, default: false },
    },

    // ✅ สถานะผู้เรียน
    studentStatus: {
      type: String,
      enum: ["active", "cancelled", "postponed"],
      default: "active",
      index: true,
    },

    // ✅ เมนูอาหาร
    food: {
      // แยกประเภทให้ชัดเจน
      // food = เลือกอาหารจริง
      // noFood = ไม่รับอาหาร
      // coupon = ใช้คูปอง (ไปเซ็นได้เลย)
      choiceType: {
        type: String,
        enum: ["food", "noFood", "coupon", ""],
        default: "",
        index: true,
      },

      noFood: { type: Boolean, default: true }, // legacy flag

      restaurantId: { type: String, default: "" },
      menuId: { type: String, default: "" },

      // legacy strings (report เดิม)
      addons: { type: [String], default: [] },
      drink: { type: String, default: "" },

      // ✅ new ids (validate รายเมนู + แสดงรูปได้)
      addonIds: { type: [String], default: [] },
      drinkId: { type: String, default: "" },

      note: { type: String, default: "" },

      // optional (ไว้รองรับ trace)
      classId: { type: String, default: "" },
      day: { type: Number, default: null },
    },

    isLate: { type: Boolean, default: false },

    signatureUrl: { type: String, default: "" },
    lastCheckinAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ✅ สำคัญ: กัน schema เก่าค้างตอน dev/hot-reload
if (process.env.NODE_ENV !== "production") {
  if (mongoose.models.Student) {
    delete mongoose.models.Student;
  }
}

export default mongoose.model("Student", StudentSchema);
