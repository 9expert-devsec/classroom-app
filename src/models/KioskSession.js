// src/models/KioskSession.js
// A /classroom tablet opened as a kiosk by an admin (L2a).
// The cookie carries a signed { typ: "kiosk", sid }; this row is what makes it
// revocable and tells us who opened which device.
import mongoose, { Schema } from "mongoose";

const KioskSessionSchema = new Schema(
  {
    // random, >= 128-bit, base64url
    sid: { type: String, required: true },
    // device label typed when opening, e.g. "iPad ห้อง 3"
    label: { type: String, required: true, trim: true },

    openedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    openedByName: { type: String, default: "" },
    openedAt: { type: Date, default: () => new Date() },
    // 23:59:59 Asia/Bangkok of the day it was opened
    expiresAt: { type: Date, required: true },

    revokedAt: { type: Date, default: null },
    // null when closed on the device itself
    revokedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    revokedByName: { type: String, default: "" },
    revokeReason: { type: String, default: "" },

    // L2b: staff step-up (edit-user, receive/staff, lunch-qr). Unlocked while
    // staffUnlockUntil > now; every staff API call slides it forward.
    staffUnlockBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
    staffUnlockByName: { type: String, default: "" },
    staffUnlockUntil: { type: Date, default: null },

    lastSeenAt: { type: Date, default: null },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, collection: "kiosksessions" },
);

KioskSessionSchema.index({ sid: 1 }, { unique: true });
KioskSessionSchema.index({ expiresAt: 1 });

export default mongoose.models.KioskSession ||
  mongoose.model("KioskSession", KioskSessionSchema);
