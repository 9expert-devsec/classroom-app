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

  const senderSignatureDataUrl = body?.senderSignatureDataUrl;
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
  if (!senderSignatureDataUrl) {
    return Response.json(
      { ok: false, error: "missing senderSignatureDataUrl" },
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

  // ✅ upload 2 signatures (ยังทำก่อน upsert ได้ตามเดิม)
  const senderUploaded = await uploadSignatureDataUrl(senderSignatureDataUrl, {
    folder,
    publicId: "sender",
  });

  const staffUploaded = await uploadSignatureDataUrl(staffSignatureDataUrl, {
    folder,
    publicId: "staff",
  });

  const now = new Date();

  const updateDoc = {
    type: "staff_receive",
    docType: "",
    receivers: [], // staff_receive ไม่ใช้ receivers (คงไว้เพื่อ schema)
    staffReceiveItems: { check, withholding, other },
    customerSig: {
      url: senderUploaded.url,
      publicId: senderUploaded.publicId,
      signedAt: now,
      signerName: senderName,
      signerRole: "customer",
    },
    staffSig: {
      url: staffUploaded.url,
      publicId: staffUploaded.publicId,
      signedAt: now,
      signerName: "",
      signerRole: "staff",
    },
  };

  // ✅ 핵: ใช้ upsert atomic กัน dup key
  try {
    const receipt = await DocumentReceipt.findOneAndUpdate(
      { classId, docId }, // classId+docId unique
      { $set: updateDoc, $setOnInsert: { classId, docId } },
      { new: true, upsert: true },
    ).lean();

    return Response.json({
      ok: true,
      item: {
        id: String(receipt._id),
        classId: String(receipt.classId),
        docId: receipt.docId,
        signedAt: now,
        senderSigUrl: senderUploaded.url,
        staffSigUrl: staffUploaded.url,
        staffReceiveItems: receipt.staffReceiveItems,
        senderName,
        senderCompany,
      },
    });
  } catch (err) {
    // ✅ กันเคส race แบบ “หลุด” จริงๆ: ถ้า dup key ให้ retry update อีกรอบ
    if (isDupKey(err)) {
      const receipt = await DocumentReceipt.findOneAndUpdate(
        { classId, docId },
        { $set: updateDoc },
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
            senderSigUrl: senderUploaded.url,
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
