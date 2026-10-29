import mongoose from "mongoose";

const ActorSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    username: { type: String, default: "" },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    roleCode: { type: String, default: "" },
  },
  { _id: false },
);

const DiffItemSchema = new mongoose.Schema(
  {
    path: { type: String, default: "" },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const AuditLogSchema = new mongoose.Schema(
  {
    actor: { type: ActorSchema, default: () => ({}) },

    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "login",
        "logout",
        "custom",
        // ✅ P4a: วงจรชีวิตออเดอร์อาหารกลางวัน (additive)
        "lunch.cancel",
        "lunch.cancel_choice_changed",
        "lunch.reopen",
        "lunch.special_open",
        // ✅ P4b: Counter
        "lunch.handout",
        "lunch.return",
        // ✅ L2a: kiosk /classroom
        "kiosk.open",
        "kiosk.close",
        // ✅ L2b: staff step-up + admin revoke
        "kiosk.staff_unlock",
        "kiosk.staff_lock",
        "kiosk.revoke",
        // ✅ PIN-P1: kiosk PIN (สร้าง/สร้างใหม่ · ดู PIN ตัวเอง · ลบ)
        "kiosk.pin_regenerate",
        "kiosk.pin_reveal",
        "kiosk.pin_clear",
        // ✅ PIN-P2b: PIN ผิดที่ kiosk / ล็อกหลังผิดครบ
        "kiosk.pin_fail",
        "kiosk.pin_lockout",
        // ✅ C3: Merchant กดใช้ e-coupon
        "lunch.redeem",
        // ✅ R2a: ออก QR / ผู้เรียนยืนยัน / action ใหม่ของแอดมิน
        "lunch.issue",
        "lunch.submit",
        "lunch.regenerate",
        "lunch.cancel_coupon",
        "lunch.cancel_for_edit",
        "lunch.view_qr",
        // ✅ R3: โยกไปร้านอื่น
        "lunch.reassign",
        // ✅ OS-1: ชุดตัวเลือกเมนู (create/update/delete ใช้ action มาตรฐาน)
        "food.option_set_attach",
        "food.option_set_detach",
        "food.option_set_promote",
      ],
      default: "custom",
      index: true,
    },

    entityType: { type: String, default: "", index: true }, // account/class/event/...
    entityId: { type: String, default: "", index: true },
    entityLabel: { type: String, default: "", index: true },

    diffs: { type: [DiffItemSchema], default: [] },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });

// R2a-3: ลงทะเบียน model ใหม่ทุกครั้งที่ไฟล์นี้ถูกโหลด
// `mongoose.models.AuditLog || ...` ทำให้ dev server (hot reload) ใช้ model ที่ compile ไว้ก่อน
// ที่ enum ของ action จะเพิ่ม — action ใหม่ (lunch.issue / lunch.submit / lunch.cancel_coupon …)
// จึงไม่ผ่าน validation และ audit แบบ best-effort ทิ้งไปเงียบ ๆ
// production โหลดไฟล์นี้ครั้งเดียวต่อ process จึงเหมือนเดิม
if (mongoose.models.AuditLog) mongoose.deleteModel("AuditLog");

export default mongoose.model("AuditLog", AuditLogSchema);
