import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },

    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },

    // ✅ NEW: cover image (เหมือน media ของเดิม)
    coverImageUrl: { type: String, default: "" },
    coverImagePublicId: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export default mongoose.models.Event || mongoose.model("Event", EventSchema);
