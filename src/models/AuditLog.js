import mongoose from "mongoose";

const ActorSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    roleCode: { type: String, default: "" },
  },
  { _id: false },
);

const DiffItemSchema = new mongoose.Schema(
  {
    path: { type: String, default: "" },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: ActorSchema, default: () => ({}) },

    action: {
      type: String,
      enum: ["create", "update", "delete", "login", "logout", "custom"],
      default: "custom",
      index: true,
    },

    entityType: { type: String, default: "", index: true }, // account/class/event/...
    entityId: { type: String, default: "", index: true },
    entityLabel: { type: String, default: "", index: true },

    diffs: { type: [DiffItemSchema], default: [] },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", AuditLogSchema);
