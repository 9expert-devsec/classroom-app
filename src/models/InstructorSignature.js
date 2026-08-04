// src/models/InstructorSignature.js
import mongoose from "mongoose";

const InstructorSignatureSchema = new mongoose.Schema(
  {
    // Primary lookup key. Normalized: lowercased email > lowercased code >
    // normalized name. See normalizeInstructorKey() in
    // src/lib/instructorSignature.server.js
    instructorKey: { type: String, required: true, unique: true, index: true },

    // Normalized name, ALWAYS populated regardless of what instructorKey
    // resolved to. Class.instructors[] carries almost no email (1/127 classes
    // as of 2026-08), so the name is the only reliable join path from a class
    // back to a signature record keyed by email.
    nameKey: { type: String, default: "", index: true },

    name: { type: String, default: "" },
    email: { type: String, default: "", index: true },
    code: { type: String, default: "" },

    // AiInstructor.externalId when known
    externalId: { type: String, default: "", index: true },

    signature: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },

    isActive: { type: Boolean, default: true, index: true },

    uploadedBy: {
      userId: { type: String, default: "" },
      username: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export default mongoose.models.InstructorSignature ||
  mongoose.model("InstructorSignature", InstructorSignatureSchema);
