// src/models/AdminUser.js
import mongoose from "mongoose";

const AvatarSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

const AdminUserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    }, // store lowercase
    name: { type: String, default: "", trim: true },
    roleCode: {
      type: String,
      enum: ["SA", "OPS", "EVT"],
      default: "OPS",
      index: true,
    },

    passwordHash: { type: String, required: true },

    avatar: { type: AvatarSchema, default: () => ({}) },

    extraPerms: { type: [String], default: [] }, // optional future
    isActive: { type: Boolean, default: true, index: true },

    lastLoginAt: { type: Date, default: null },

    // PIN-P1: kiosk PIN (src/lib/kioskPin.server.js) — never in toPublic / lists / audits
    kioskPinHmac: { type: String, default: null, select: false },
    kioskPinEnc: { type: String, default: null, select: false },
    kioskPinSetAt: { type: Date, default: null },
    kioskPinSetBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true },
);

AdminUserSchema.index(
  { kioskPinHmac: 1 },
  {
    unique: true,
    name: "kioskPinHmac_unique",
    partialFilterExpression: { kioskPinHmac: { $type: "string" } },
  },
);

AdminUserSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    username: this.username,
    name: this.name,
    roleCode: this.roleCode,
    avatarUrl: this.avatar?.url || "",
    isActive: !!this.isActive,
    lastLoginAt: this.lastLoginAt,
    hasKioskPin: !!this.kioskPinSetAt,
    kioskPinSetAt: this.kioskPinSetAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export default mongoose.models.AdminUser ||
  mongoose.model("AdminUser", AdminUserSchema);
