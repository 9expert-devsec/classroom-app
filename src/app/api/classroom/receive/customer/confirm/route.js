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

function pickName(stu) {
  return clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.engName) || "-";
}

async function buildReceiversFromStudents({ classId, docId }) {
  const students = await Student.find({ classId })
    .select("_id name thaiName engName company paymentRef documentReceiveType")
    .lean();

  const matched = (students || []).filter((s) => {
    const pay = normalizeDocId(clean(s?.paymentRef));
    return !!pay && pay === docId;
  });

  matched.sort((a, b) => pickName(a).localeCompare(pickName(b), "th"));

  return matched.map((s) => ({
    receiverId: String(s._id),
    name: pickName(s),
    company: clean(s.company),
    documentReceiveType: clean(s.documentReceiveType),
    receiptSig: { signerRole: "customer" }, // default
  }));
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const classId = clean(body?.classId);
  const docId = normalizeDocId(body?.docId);
  const receiverIndex = Number(body?.receiverIndex || 0);
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

  // ✅ 1) หา receipt แบบ “ล็อก type customer_receive” เท่านั้น
  let receipt = await DocumentReceipt.findOne({
    classId,
    docId,
    type: "customer_receive",
  })
    .select("_id classId docId type receivers updatedAt")
    .lean();

  // ✅ 2) ถ้าไม่เจอ หรือ receivers ว่าง → rebuild จาก Student.paymentRef
  if (
    !receipt ||
    !Array.isArray(receipt.receivers) ||
    receipt.receivers.length === 0
  ) {
    const receivers = await buildReceiversFromStudents({ classId, docId });
    if (!receivers.length) {
      return Response.json(
        { ok: false, error: "no receivers in receipt" },
        { status: 400 },
      );
    }

    if (!receipt) {
      // create ใหม่
      const created = await DocumentReceipt.create({
        type: "customer_receive",
        classId,
        docId,
        receivers,
      });
      receipt = {
        _id: created._id,
        classId: created.classId,
        docId: created.docId,
        type: created.type,
        receivers: created.receivers,
      };
    } else {
      // มี doc แต่ receivers ว่าง → set receivers ให้ถูกต้อง
      await DocumentReceipt.updateOne(
        { _id: receipt._id },
        { $set: { receivers } },
      );
      receipt.receivers = receivers;
    }
  }

  // ✅ 3) upload ลายเซ็น (ใช้ publicId เดียวเพื่อ “ทับ” ได้)
  const folder = `classroom/receive/customer/${classId}/${docId}`;
  const uploaded = await uploadSignatureDataUrl(signatureDataUrl, {
    folder,
    publicId: "receipt", // overwrite
  });

  const now = new Date();

  // signerName: ใช้คนที่เลือกใน receiverIndex (ถ้าเกิน range ก็ fallback คนแรก)
  const idx =
    receiverIndex >= 0 && receiverIndex < receipt.receivers.length
      ? receiverIndex
      : 0;

  const signerName = clean(receipt.receivers[idx]?.name);

  const sigObj = {
    url: uploaded.url,
    publicId: uploaded.publicId,
    signedAt: now,
    signerName,
    signerRole: "customer",
  };

  // ✅ 4) ตาม policy “INV เดียวหลายคน” → เซ็นครั้งเดียว = apply ให้ทุก receiver
  const updated = await DocumentReceipt.findOneAndUpdate(
    { classId, docId, type: "customer_receive" },
    { $set: { "receivers.$[].receiptSig": sigObj } },
    { new: true },
  ).lean();

  return Response.json({
    ok: true,
    item: {
      id: String(updated?._id || receipt._id),
      classId: String(updated?.classId || classId),
      docId,
      signedAt: now,
      signedUrl: uploaded.url,
      signerName,
      receiverCount: Array.isArray(updated?.receivers)
        ? updated.receivers.length
        : 0,
    },
  });
}
