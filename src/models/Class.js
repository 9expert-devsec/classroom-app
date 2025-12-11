import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema(
  {
    // ชื่อ class ที่จะใช้แสดงใน admin และหน้าอื่น ๆ
    title: { type: String, required: true },

    // ผูกกับ course (รองรับ manual + จาก API)
    courseCode: String,     // code จาก public-courses เช่น "EXCEL-I"
    courseName: String,     // ชื่อคอร์ส

    // วันที่เรียนหลัก (day 1)
    date: { type: Date, required: true },

    // ช่วงเวลา + จำนวนวัน
    duration: {
      dayCount: { type: Number, default: 1 },
      startTime: { type: String, default: "09:00" }, // "HH:MM"
      endTime: { type: String, default: "16:00" },
    },

    room: String,

    // แหล่งที่มา: api schedule / manual
    source: {
      type: String,
      enum: ["api", "manual"],
      default: "manual",
    },
    externalScheduleId: String, // ไว้ map กับ /schedule ถ้าดึงจาก API

    instructors: [
      {
        name: String,
        email: String,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.Class || mongoose.model("Class", ClassSchema);
