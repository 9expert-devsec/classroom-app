// src/models/ExternalApiKey.js
import mongoose from "mongoose";

const ExternalApiKeySchema = new mongoose.Schema(
  {
    // Human label, e.g. "Partner: 9expert.com"
    name: { type: String, required: true },

    // Displayable prefix, e.g. "9xc_live_a1b2c3d4". Safe to show in the UI.
    keyPrefix: { type: String, required: true, index: true },

    // sha256 hex of the full key. The raw key is NEVER stored, logged or
    // returned after creation.
    keyHash: { type: String, required: true, index: true },

    scopes: { type: [String], default: ["classes.read"] },

    // Exact origins allowed for browser CORS. Empty = no browser CORS at all.
    allowedOrigins: { type: [String], default: [] },

    // Empty = any IP.
    allowedIps: { type: [String], default: [] },

    rateLimitPerMin: { type: Number, default: 60 },

    expiresAt: { type: Date, default: null, index: true },
    revokedAt: { type: Date, default: null, index: true },

    lastUsedAt: { type: Date, default: null },
    lastUsedIp: { type: String, default: "" },
    requestCount: { type: Number, default: 0 },

    note: { type: String, default: "" },

    createdBy: {
      userId: { type: String, default: "" },
      username: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export default mongoose.models.ExternalApiKey ||
  mongoose.model("ExternalApiKey", ExternalApiKeySchema);
