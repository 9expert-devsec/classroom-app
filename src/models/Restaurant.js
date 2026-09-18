import mongoose from "mongoose";

const RestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logoUrl: String,
    isActive: { type: Boolean, default: true },

    // ✅ Coupon capability (Layer 1): ร้านนี้ "สามารถ" ทำหน้าที่เป็นคูปองได้
    // การใช้งานจริงต่อวันอยู่ที่ FoodDaySet.entries[].mode = "coupon"
    couponEnabled: { type: Boolean, default: false },
    couponLabel: { type: String, default: "Cash Coupon" },
    couponAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Restaurant ||
  mongoose.model("Restaurant", RestaurantSchema);
