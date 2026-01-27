import mongoose from "mongoose";

const AiInstructorSchema = new mongoose.Schema(
  {
    externalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    code: { type: String, default: "" },

    // เก็บ payload ดิบไว้เพื่อ compat กับ UI เดิม
    raw: { type: mongoose.Schema.Types.Mixed },
    syncedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export default mongoose.models.AiInstructor ||
  mongoose.model("AiInstructor", AiInstructorSchema);
