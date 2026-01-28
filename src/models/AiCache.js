import mongoose from "mongoose";

const AiCacheSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true }, // เช่น "public-courses" | "program"
    key: { type: String, required: true }, // เช่น "__list__" | "id:xxxx" | "qs:..."
    data: { type: mongoose.Schema.Types.Mixed, default: null },

    syncedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true }, // TTL

    upstreamUrl: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

AiCacheSchema.index({ endpoint: 1, key: 1 }, { unique: true });
// ✅ Mongo TTL index: ลบอัตโนมัติเมื่อ expiresAt < now
AiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AiCache ||
  mongoose.model("AiCache", AiCacheSchema);
