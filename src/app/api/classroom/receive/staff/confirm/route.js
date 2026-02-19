// src/app/api/classroom/receive/staff/confirm/route.js
import dbConnect from "@/lib/mongoose";
import DocumentReceipt from "@/models/DocumentReceipt";
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

function isDupKey(err) {
  return (
    err &&
    (err.code === 11000 ||
      err?.errorResponse?.code === 11000 ||
      String(err?.message || "").includes("E11000 duplicate key"))
  );
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));

  const classId = clean(body?.classId);
  const docId = normalizeDocId(body?.docId);

  const sender = body?.sender || {};
  const senderName = clean(sender?.name);
  const senderCompany = clean(sender?.company);

  const staffReceiveItems = body?.staffReceiveItems || {};
  const check = !!staffReceiveItems?.check;
  const withholding = !!staffReceiveItems?.withholding;
  const other = clean(staffReceiveItems?.other);

  const staffSignatureDataUrl = body?.staffSignatureDataUrl;

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

  const hasAny = check || withholding || !!other;
  if (!hasAny) {
    return Response.json(
      { ok: false, error: "missing staffReceiveItems" },
      { status: 400 },
    );
  }

  if (!staffSignatureDataUrl) {
    return Response.json(
      { ok: false, error: "missing staffSignatureDataUrl" },
      { status: 400 },
    );
  }

  const folder = `classroom/receive/staff/${classId}/${docId}`;

  // ✅ upload เฉพาะ staff
  let staffUploaded;
  try {
    staffUploaded = await uploadSignatureDataUrl(staffSignatureDataUrl, {
      folder,
      publicId: "staff",
    });
  } catch (e) {
    console.error("upload staff signature failed", e);
    return Response.json(
      { ok: false, error: "อัปโหลดลายเซ็นไม่สำเร็จ" },
      { status: 500 },
    );
  }

  const now = new Date();

  const updateDoc = {
    docType: "",
    receivers: [],
    staffReceiveItems: { check, withholding, other },
    staffSig: {
      url: staffUploaded.url,
      publicId: staffUploaded.publicId,
      signedAt: now,
      signerName: "",
      signerRole: "staff",
    },
    sender: {
      studentId: clean(sender?.studentId),
      name: senderName,
      company: senderCompany,
    },
  };

  try {
    const receipt = await DocumentReceipt.findOneAndUpdate(
      { classId, docId, type: "staff_receive" },
      {
        $set: updateDoc,
        $unset: { customerSig: "" }, // ✅ ให้แน่ใจว่าไม่มีลายเซ็นลูกค้าใน staff_receive
        $setOnInsert: { classId, docId, type: "staff_receive" },
      },
      { new: true, upsert: true },
    ).lean();

    return Response.json({
      ok: true,
      item: {
        id: String(receipt._id),
        classId: String(receipt.classId),
        docId: receipt.docId,
        signedAt: now,
        staffSigUrl: staffUploaded.url,
        staffReceiveItems: receipt.staffReceiveItems,
        senderName,
        senderCompany,
      },
    });
  } catch (err) {
    if (isDupKey(err)) {
      const receipt = await DocumentReceipt.findOneAndUpdate(
        { classId, docId, type: "staff_receive" },
        { $set: updateDoc, $unset: { customerSig: "" } },
        { new: true },
      ).lean();

      if (receipt) {
        return Response.json({
          ok: true,
          item: {
            id: String(receipt._id),
            classId: String(receipt.classId),
            docId: receipt.docId,
            signedAt: now,
            staffSigUrl: staffUploaded.url,
            staffReceiveItems: receipt.staffReceiveItems,
            senderName,
            senderCompany,
          },
        });
      }
    }

    console.error("POST /api/classroom/receive/staff/confirm error", err);
    return Response.json(
      { ok: false, error: "บันทึกไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
