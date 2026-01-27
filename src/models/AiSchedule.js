import mongoose from "mongoose";

const AiScheduleSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },

    // สำหรับ query ช่วงวันแบบเร็ว ๆ
    startAt: { type: Date, index: true },
    endAt: { type: Date, index: true },

    // เก็บ data ที่ใช้บ่อย (optional แต่ช่วย)
    type: { type: String, default: "" }, // classroom | hybrid
    room: { type: String, default: "" },
    courseCode: { type: String, default: "" },
    courseName: { type: String, default: "" },
    dates: { type: [String], default: [] },

    raw: { type: mongoose.Schema.Types.Mixed },
    syncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

AiScheduleSchema.index({ startAt: 1, endAt: 1 });

export default mongoose.models.AiSchedule ||
  mongoose.model("AiSchedule", AiScheduleSchema);
