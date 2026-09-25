// src/models/LunchNotification.js
// เหตุการณ์อาหารกลางวันที่เด้งเป็น toast ในหน้าแอดมิน (ผ่าน /api/admin/notifications/poll)
//
// ระบบแจ้งเตือนเดิมอ่าน event ตรงจาก collection ต้นทาง (Checkin, FoodEditLog, …)
// แต่ lunch มี event ที่ไม่มีแถวต้นทางของตัวเอง (สต็อกใกล้หมด, 11:00 ยังไม่สั่ง)
// จึงเก็บเป็นแถวของตัวเอง — dedupeKey unique กันเด้งซ้ำ แม้หลาย instance จะยิงพร้อมกัน
import mongoose, { Schema } from "mongoose";

const LunchNotificationSchema = new Schema(
  {
    // submit | stock_low | stock_out | unordered
    kind: { type: String, required: true },
    // เช่น lunch.submit:<orderId>, lunch.stock_low:<restaurantId>:<dayYMD>
    dedupeKey: { type: String, required: true },
    message: { type: String, required: true },

    dayYMD: { type: String, default: "", index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "LunchOrder", default: null },
  },
  { timestamps: true, collection: "lunchnotifications" },
);

LunchNotificationSchema.index({ dedupeKey: 1 }, { unique: true });
// poll อ่านตามเวลาที่สร้าง
LunchNotificationSchema.index({ createdAt: -1 });

export default mongoose.models.LunchNotification ||
  mongoose.model("LunchNotification", LunchNotificationSchema);
