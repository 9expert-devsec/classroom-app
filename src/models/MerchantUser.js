// src/models/MerchantUser.js
import mongoose from "mongoose";

const MerchantUserSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    username: { type: String, required: true, unique: true, index: true }, // lower-case
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export default mongoose.models.MerchantUser ||
  mongoose.model("MerchantUser", MerchantUserSchema);
