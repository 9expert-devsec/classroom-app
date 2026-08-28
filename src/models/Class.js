// src/models/Class.js
import mongoose from "mongoose";

const ClassSchema = new mongoose.Schema(
  {
    // ชื่อ class (ใช้เป็น code หลัก) เช่น CR-PUB-MSE-L6-23-02-69-1
    title: { type: String, required: true, unique: true, index: true },

    publicCourseId: { type: String, index: true },

    courseCode: String,
    courseName: String,

    customCourseName: { type: String, default: "" },
    classImageUrl: { type: String, default: "" },

    // วันที่เรียนหลัก (day 1)
    date: { type: Date, required: true, index: true },
    days: { type: [String], default: [] },

    duration: {
      dayCount: { type: Number, default: 1 },
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "16:00" },
    },

    program: {
      programObjectId: String,
      program_id: String,
      program_name: String,
      programcolor: String,
      programiconurl: String,
    },

    room: String,

    // แยกประเภท class: ปกติ vs Masterclass
    // (ห้ามใช้ชื่อ classType เพราะ POST /api/admin/classes อ่าน body.classType
    //  ไปเลือก prefix CR/H ของชื่อ class)
    classKind: {
      type: String,
      enum: ["normal", "masterclass"],
      default: "normal",
      index: true,
    },
    masterclassCourseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterclassCourse",
      default: null,
      index: true,
    },

    // hide "Cash Coupon" choice on the learner-facing food step
    disableCoupon: { type: Boolean, default: false },

    source: {
      type: String,
      enum: ["api", "manual", "sync"],
      default: "manual",
      index: true,
    },

    // map กับ schedule
    externalScheduleId: { type: String, index: true, default: "" },

    // เก็บประเภทเพื่อ trace (optional)
    trainingType: { type: String, default: "" }, // "classroom" | "hybrid"
    channel: { type: String, default: "" }, // "PUB" ...

    instructors: [
      {
        name: String,
        email: String,
      },
    ],
  },
  { timestamps: true },
);

export default mongoose.models.Class || mongoose.model("Class", ClassSchema);
