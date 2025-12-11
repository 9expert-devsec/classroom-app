// models/FoodDaySet.js
import mongoose from "mongoose";

const FoodDayEntrySchema = new mongoose.Schema(
  {
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    // ไว้ใช้ในอนาคตสำหรับผูกกับ FoodSet (ตอนนี้ยังไม่บังคับ)
    set: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodSet",
      default: null,
    },
  },
  { _id: false }
);

const FoodDaySetSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // 1 วันมี 1 config
    },
    entries: [FoodDayEntrySchema], // [{ restaurant, set }]
  },
  { timestamps: true }
);

FoodDaySetSchema.index({ date: 1 });

export default mongoose.models.FoodDaySet ||
  mongoose.model("FoodDaySet", FoodDaySetSchema);
