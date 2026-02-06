// src/models/FoodEditLog.js
import mongoose from "mongoose";

const FoodEditLogSchema = new mongoose.Schema(
  {
    studentId: { type: String, default: "", index: true },
    classId: { type: String, default: "", index: true },
    day: { type: Number, default: null },

    // food | noFood | coupon
    choiceType: { type: String, default: "" },

    restaurantId: { type: String, default: "" },
    menuId: { type: String, default: "" },
    addonIds: { type: [String], default: [] },
    drinkId: { type: String, default: "" },

    note: { type: String, default: "" },

    // snapshot เพื่อทำ noti โดยไม่ต้อง join เยอะ
    studentName: { type: String, default: "" },
    studentCompany: { type: String, default: "" },

    // เผื่ออนาคต: checkin | edit-user | admin
    source: { type: String, default: "" },
  },
  { timestamps: true },
);

FoodEditLogSchema.index({ createdAt: -1 });

export default mongoose.models.FoodEditLog ||
  mongoose.model("FoodEditLog", FoodEditLogSchema);
