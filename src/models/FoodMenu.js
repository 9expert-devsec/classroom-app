// src/models/FoodMenu.js
import mongoose, { Schema } from "mongoose";

const FoodMenuSchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },

    // legacy (ยังใช้ในหน้าเช็คอิน / today)
    addons: { type: [String], default: [] }, // ชื่อ add-on
    drinks: { type: [String], default: [] }, // ชื่อ drink

    // ✅ new (ใช้ id จริง)
    addonIds: [{ type: Schema.Types.ObjectId, ref: "FoodAddon" }],
    drinkIds: [{ type: Schema.Types.ObjectId, ref: "FoodDrink" }],

    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// (optional) กันชื่อเมนูซ้ำในร้านเดียวกัน
FoodMenuSchema.index({ restaurant: 1, name: 1 }, { unique: false });

export default mongoose.models.FoodMenu ||
  mongoose.model("FoodMenu", FoodMenuSchema);
