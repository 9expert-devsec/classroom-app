// src/models/FoodMenuCategory.js
// หมวดหมู่เมนูของแต่ละร้าน ใช้จัดกลุ่มเมนูในหน้าสั่งอาหารของผู้เรียน
import mongoose, { Schema } from "mongoose";

const FoodMenuCategorySchema = new Schema(
  {
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    // shown as the orange "แนะนำ" chip in admin. No default on purpose:
    // absent = fall back to the name rule (contains "แนะนำ" / "recommend")
    highlight: { type: Boolean },
  },
  { timestamps: true },
);

FoodMenuCategorySchema.index({ restaurant: 1, sortOrder: 1 });

export default mongoose.models.FoodMenuCategory ||
  mongoose.model("FoodMenuCategory", FoodMenuCategorySchema);
