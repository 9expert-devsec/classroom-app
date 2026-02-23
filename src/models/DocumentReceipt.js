// src/models/DocumentReceipt.js
import mongoose from "mongoose";

/** ใช้กับช่อง sig เก่า/อื่น ๆ (customerSig/staffSig/withholdingSig) */
const SigSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    signedAt: { type: Date, default: null },

    signerName: { type: String, default: "" },
    signerRole: { type: String, default: "" }, // "customer" | "staff"
  },
  { _id: false },
);

/** ✅ ช่องลายเซ็นรับเอกสารหลัก (receiptSig) + เก็บตัวแทนคนเซ็น */
const ReceiptSigSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    signedAt: { type: Date, default: null },
    signerRole: { type: String, default: "" },

    // ✅ เพิ่มใหม่
    signerStudentId: { type: String, default: "" },
    signerName: { type: String, default: "" },
    signerCompany: { type: String, default: "" },
  },
  { _id: false },
);

const ReceiverSchema = new mongoose.Schema(
  {
    receiverId: { type: String, default: "" }, // optional
    name: { type: String, default: "" },
    company: { type: String, default: "" },

    // ✅ ช่องทางรับเอกสารจาก Student.documentReceiveType
    documentReceiveType: { type: String, default: "" },

    // ✅ ใช้ receiptSig เป็น "ลายเซ็นรับเอกสาร" ช่องเดียว
    receiptSig: {
      type: ReceiptSigSchema,
      default: () => ({ signerRole: "customer" }),
    },

    // เผื่ออนาคตอยากกลับมาใช้ 2 ช่อง (ยังเก็บไว้ได้ ไม่กระทบ)
    withholdingSig: {
      type: SigSchema,
      default: () => ({ signerRole: "customer" }),
    },
  },
  { _id: false },
);

const DocumentReceiptSchema = new mongoose.Schema(
  {
    sender: {
      studentId: { type: String, default: "" },
      name: { type: String, default: "" },
      company: { type: String, default: "" },
    },

    type: {
      type: String,
      enum: ["customer_receive", "staff_receive"],
      required: true,
      index: true,
      default: "customer_receive",
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    // เลขเอกสาร เช่น INV-001 / RP000232 / QUO-xxx
    docId: { type: String, required: true, index: true },

    docType: { type: String, default: "" },

    // รายชื่อผู้รับ
    receivers: { type: [ReceiverSchema], default: [] },

    // สำหรับ 3.2 เผื่ออนาคต
    staffReceiveItems: {
      check: { type: Boolean, default: false },
      withholding: { type: Boolean, default: false },
      other: { type: String, default: "" },
    },

    // legacy/optional
    customerSig: { type: SigSchema, default: null },
    staffSig: { type: SigSchema, default: null },
  },
  { timestamps: true },
);

// 1 คลาส + 1 docId + type ต้องไม่ซ้ำ
DocumentReceiptSchema.index(
  { classId: 1, docId: 1, type: 1 },
  { unique: true },
);

export default mongoose.models.DocumentReceipt ||
  mongoose.model("DocumentReceipt", DocumentReceiptSchema);
