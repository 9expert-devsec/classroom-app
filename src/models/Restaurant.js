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
    // ✅ P2: เตือนเมื่อคูปองพร้อมใช้เหลือน้อยกว่าหรือเท่ากับค่านี้
    couponStockLowThreshold: { type: Number, default: 5, min: 0 },
    // ✅ ร้าน stock: คูปองกระดาษหมด (ไม่มีใบที่ยังไม่หมดอายุ) -> ออก e-coupon จากระบบแทน
    //    ใช้กระดาษก่อนเสมอ ตัดสินทีละออเดอร์ตอน submit · มีผลเฉพาะเมื่อ usesCouponStock
    stockFallbackToECoupon: { type: Boolean, default: false },
    // ✅ แสดงบาร์โค้ด Code 128 ของรหัส e-coupon บนหน้าผู้เรียน (เครื่องสแกน POS แบบ 1 มิติ)
    //    มีผลเฉพาะออเดอร์ e-coupon · อ่านค่าปัจจุบันของร้านทุกครั้งที่แสดงผล
    showCouponBarcode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Restaurant ||
  mongoose.model("Restaurant", RestaurantSchema);
