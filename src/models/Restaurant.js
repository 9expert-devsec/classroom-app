import mongoose from "mongoose";

const RestaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logoUrl: String,
    isActive: { type: Boolean, default: true },

    // ✅ ร้านนี้เข้าร่วมระบบคูปองได้หรือไม่
    couponEnabled: { type: Boolean, default: false },
    // ✅ ร้านที่ใช้คูปองกระดาษจาก stock ที่ import เข้ามา
    //    (false = ใช้ e-coupon ที่ระบบ generate ให้)
    usesCouponStock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Restaurant ||
  mongoose.model("Restaurant", RestaurantSchema);
