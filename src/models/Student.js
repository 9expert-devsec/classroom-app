import mongoose from "mongoose";
import { noSSR } from "next/dynamic";

const StudentSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },

    thaiName: String,
    engName: String,
    company: String,
    paymentRef: String,

    // การรับเอกสาร
    documentReceiveType: {
      type: String,
      enum: ["ems", "on_class"], // on_class = มารับ ณ วันอบรม
      default: "ems",
    },
    documentReceivedAt: Date,

    // สถานะเช็คอินในแต่ละวัน
    checkinStatus: {
      day1: { type: Boolean, default: false },
      day2: { type: Boolean, default: false },
      day3: { type: Boolean, default: false },
    },

    // เมนูอาหาร
    food: {
      restaurantId: String,
      menuId: String,
      addons: [String],
      drink: String,
      note: String,
    },

    isLate: { type: Boolean, default: false },
    signatureUrl: String,
    lastCheckinAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.Student ||
  mongoose.model("Student", StudentSchema);
