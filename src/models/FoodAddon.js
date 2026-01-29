import mongoose, { Schema } from "mongoose";

const FoodAddonSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },

    // ✅ NEW: image
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

FoodAddonSchema.index({ restaurant: 1, name: 1 }, { unique: true });

export default mongoose.models.FoodAddon ||
  mongoose.model("FoodAddon", FoodAddonSchema);
