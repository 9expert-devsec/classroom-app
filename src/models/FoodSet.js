// models/FoodSet.js
import mongoose, { Schema } from "mongoose";

const FoodSetSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // เช่น "Set A", "Set B"
      trim: true,
    },
    // เมนูในเซ็ตนี้ (เลือกจาก FoodMenu ของร้านเดียวกัน)
    menuIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "FoodMenu",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.models.FoodSet ||
  mongoose.model("FoodSet", FoodSetSchema);
