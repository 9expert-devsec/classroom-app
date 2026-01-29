// src/app/api/classroom/receive/customer/confirm/route.js
import dbConnect from "@/lib/mongoose";
import DocumentReceipt from "@/models/DocumentReceipt";
import Student from "@/models/Student";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
}

function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return s;
}

function getStudentName(stu) {
  return clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.engName) || "-";
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const classId = clean(body?.classId);
  const docId = normalizeDocId(body?.docId);
  const signatureDataUrl = body?.signatureDataUrl;

  if (!classId) {
    return Response.json(
      { ok: false, error: "missing classId" },
      { status: 400 },
    );
  }
  if (!docId) {
    return Response.json(
      { ok: false, error: "missing docId" },
      { status: 400 },
    );
  }
  if (!signatureDataUrl) {
    return Response.json(
      { ok: false, error: "missing signatureDataUrl" },
      { status: 400 },
    );
  }

  // 1) หา receipt ก่อน
  let receipt = await DocumentReceipt.findOne({ classId, docId });

  // 2) ✅ ถ้าไม่มี -> สร้าง receipt อัตโนมัติจาก Student (บริษัทจ่ายใบเดียวหลายคน)
  if (!receipt) {
    const students = await Student.find({ classId })
      .select(
        "_id name thaiName engName company paymentRef documentReceiveType",
      )
      .lean();

    const matched = (students || []).filter((s) => {
      const pay = clean(s?.paymentRef);
      return normalizeDocId(pay) === docId || pay.toUpperCase() === docId;
    });

    if (!matched.length) {
      return Response.json(
        { ok: false, error: "receipt not found" },
        { status: 404 },
      );
    }

    const receivers = matched.map((s) => ({
      receiverId: String(s._id),
      name: getStudentName(s),
      company: clean(s.company),
      documentReceiveType: clean(s.documentReceiveType) || "",
      receiptSig: {
        url: "",
        publicId: "",
        signedAt: null,
        signerName: "",
        signerRole: "customer",
      },
      withholdingSig: {
        url: "",
        publicId: "",
        signedAt: null,
        signerName: "",
        signerRole: "customer",
      },
    }));

    // NOTE: ฟิลด์อื่น ๆ (docType, staffReceiveItems, customerSig, staffSig)
    // ถ้า schema มีอยู่จะถูกเก็บ, ถ้าไม่มีจะถูก ignore ตาม strict ของ schema
    receipt = await DocumentReceipt.create({
      type: "customer_receive",
      classId,
      docId,
      docType: "",
      receivers,
      staffReceiveItems: { check: false, withholding: false, other: "" },
      customerSig: null,
      staffSig: null,
    });
  }

  const receivers = Array.isArray(receipt.receivers) ? receipt.receivers : [];
  if (!receivers.length) {
    return Response.json(
      { ok: false, error: "no receivers in receipt" },
      { status: 400 },
    );
  }

  // 3) upload signature "ครั้งเดียว" ต่อใบ
  const folder = `classroom/receive/${classId}/${docId}`;
  const publicId = `receive-all`; // ต่อ docId

  const uploaded = await uploadSignatureDataUrl(signatureDataUrl, {
    folder,
    publicId,
  });

  const now = new Date();

  // 4) เซฟลง receiptSig ให้ทุก receiver (ทุกคนในใบนี้ = รับเอกสารแล้ว)
  for (let i = 0; i < receivers.length; i++) {
    receipt.receivers[i].receiptSig = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      signedAt: now,
      signerName: "",
      signerRole: "customer",
    };
  }

  await receipt.save();

  // 5) ✅ Sync ไป Student ทุกคนในใบนี้
  const receiverIds = receivers
    .map((r) => clean(r?.receiverId))
    .filter(Boolean);

  if (receiverIds.length) {
    await Student.updateMany(
      { _id: { $in: receiverIds } },
      {
        $set: {
          documentReceiptSigUrl: uploaded.url,
          documentReceiptSignedAt: now,
        },
      },
    ).catch(() => {});
  }

  // 6) ✅ (ตาม requirement) ทำให้ทั้งใบ = รับเอกสารแล้ว
  if (receiverIds.length) {
    await Student.updateMany(
      { _id: { $in: receiverIds }, documentReceivedAt: null },
      { $set: { documentReceivedAt: now } },
    ).catch(() => {});
  }

  return Response.json({
    ok: true,
    item: {
      id: String(receipt._id),
      classId: String(receipt.classId),
      docId: receipt.docId,
      signedAt: now,
      url: uploaded.url,
      appliedReceivers: receivers.length,
    },
  });
}
