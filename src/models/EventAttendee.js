import mongoose from "mongoose";

const EventAttendeeSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },

    sourceChannel: { type: String, default: "", trim: true }, // ช่องที่ทราบข่าว
    gender: { type: String, default: "", trim: true },
    age: { type: Number, default: null },
    workStatus: { type: String, default: "", trim: true }, // สถานภาพการทำงาน

    // สถานะผู้เข้าร่วม
    status: {
      type: String,
      default: "registered",
      enum: ["registered", "cancelled"],
    },

    // เช็คอินงาน + ลายเซ็น
    checkedInAt: { type: Date, default: null },
    signatureUrl: { type: String, default: "" },
    signaturePublicId: { type: String, default: "" },
    signedAt: { type: Date, default: null },

    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

EventAttendeeSchema.index({ eventId: 1, fullName: 1 });
EventAttendeeSchema.index({ eventId: 1, phone: 1 });
EventAttendeeSchema.index({ eventId: 1, email: 1 });

export default mongoose.models.EventAttendee ||
  mongoose.model("EventAttendee", EventAttendeeSchema);
