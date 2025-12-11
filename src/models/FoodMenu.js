import mongoose from "mongoose";

const FoodMenuSchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true },
    imageUrl: String,
    addons: [String],
    drinks: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.FoodMenu ||
  mongoose.model("FoodMenu", FoodMenuSchema);
