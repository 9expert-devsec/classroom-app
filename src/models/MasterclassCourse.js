// src/models/MasterclassCourse.js
import mongoose from "mongoose";

const MasterclassCourseSchema = new mongoose.Schema(
  {
    // Course id ที่ใช้ประกอบชื่อ Class (เช่น "MCLASS-AI")
    // uppercase A-Z, 0-9 และ "-" เท่านั้น (ตรวจซ้ำฝั่ง API ด้วย)
    courseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },

    coverImageUrl: { type: String, default: "" },
    coverImagePublicId: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.MasterclassCourse ||
  mongoose.model("MasterclassCourse", MasterclassCourseSchema);
