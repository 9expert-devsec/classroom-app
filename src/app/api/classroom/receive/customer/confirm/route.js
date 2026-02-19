// src/app/api/classroom/receive/customer/confirm/route.js
import dbConnect from "@/lib/mongoose";
import DocumentReceipt from "@/models/DocumentReceipt";
import Student from "@/models/Student";
import { uploadSignatureDataUrl } from "@/lib/cloudinaryUpload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */
function clean(x) {
  return String(x || "").trim();
}

function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();

  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");

  let m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  m = s.match(/^([A-Z]{2,10})([0-9]{1,20})$/);
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

  const receiverIndex = Number(body?.receiverIndex ?? 0);
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

  // 1) หา “กลุ่มนักเรียนในคลาสนี้” ที่ paymentRef normalize ตรงกับ docId
  //    (เพื่อรองรับ INV/QT/RP ซ้ำหลายคน)
  const studentsInClass = await Student.find({ classId })
    .select("_id name thaiName engName company paymentRef documentReceiveType")
    .lean();

  const group = (studentsInClass || []).filter((s) => {
    const pr = clean(s?.paymentRef);
    if (!pr) return false;
    return normalizeDocId(pr) === docId;
  });

  if (!group.length) {
    return Response.json(
      { ok: false, error: "ไม่พบผู้เรียนที่มีเลขเอกสารนี้ในคลาสนี้" },
      { status: 400 },
    );
  }

  // 2) upload signature
  const folder = `classroom/receive/customer/${classId}/${docId}`;
  const uploaded = await uploadSignatureDataUrl(signatureDataUrl, {
    folder,
    publicId: "receipt", // ช่องเดียว
  });

  const now = new Date();

  const sigObj = {
    url: uploaded.url,
    publicId: uploaded.publicId,
    signedAt: now,
    signerName: "", // ถ้าจะใส่ชื่อคนเซ็นจริง ค่อยเติมจาก receiverIndex ได้
    signerRole: "customer",
  };

  // 3) ensure receipt (customer_receive เท่านั้น)
  const baseQuery = { classId, docId, type: "customer_receive" };

  // สร้าง receivers list จาก group
  // (จัด order ให้คงที่ เพื่อรองรับ receiverIndex)
  const receivers = group
    .map((s) => {
      const nm = clean(s.name) || clean(s.thaiName) || clean(s.engName) || "-";
      return {
        receiverId: String(s._id),
        name: nm,
        company: clean(s.company),
        documentReceiveType: clean(s.documentReceiveType),
        // receiptSig จะถูก set ด้านล่าง
      };
    })
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));

  try {
    // ✅ upsert แบบไม่ชน operator: ใส่ type เฉพาะใน query + $setOnInsert เท่านั้น
    await DocumentReceipt.updateOne(
      baseQuery,
      {
        $setOnInsert: {
          classId,
          docId,
          type: "customer_receive",
          receivers,
        },
      },
      { upsert: true },
    );

    // ถ้ามีอยู่แล้วแต่ receivers ว่าง (เช่นเคยไปโดน staff doc ก่อนในอดีต/ข้อมูลเก่า)
    const existing = await DocumentReceipt.findOne(baseQuery)
      .select("_id receivers")
      .lean();

    if (
      !existing ||
      !Array.isArray(existing.receivers) ||
      existing.receivers.length === 0
    ) {
      await DocumentReceipt.updateOne(baseQuery, { $set: { receivers } });
    }

    // 4) เซ็น: ตาม requirement “INV เดียวถือว่าเซ็น/รับเอกสารให้ทั้งกลุ่ม”
    //    เลย set ให้ทุก receivers (ไม่งั้นจะเกิดเคส ‘อีกคนไม่ขึ้นเขียว’)
    await DocumentReceipt.updateOne(baseQuery, {
      $set: {
        "receivers.$[].receiptSig": sigObj,
      },
    });

    // 5) sync กลับไปที่ Student ให้ทั้งกลุ่ม “ขึ้นเขียว”
    const groupIds = group.map((s) => s._id);

    await Student.updateMany(
      { _id: { $in: groupIds } },
      {
        $set: {
          documentReceiptSigUrl: uploaded.url,
          documentReceiptSignedAt: now,
          documentReceivedAt: now, // ✅ ทำให้ทุกคนขึ้น “รับเอกสารแล้ว”
        },
      },
    );

    // ถ้าจะเก็บว่า “คนไหนเป็นคนกดเซ็น” ก็หา receiver ตาม receiverIndex แล้วใส่ signerName ได้
    // (optional) ไม่จำเป็นต่อการแก้ 400

    return Response.json({
      ok: true,
      item: {
        classId,
        docId,
        signedAt: now,
        signedUrl: uploaded.url,
        receiverIndex: Number.isFinite(receiverIndex) ? receiverIndex : 0,
        groupCount: group.length,
      },
    });
  } catch (err) {
    if (isDupKey(err)) {
      // กัน race: ลอง update ต่ออีกรอบ
      try {
        await DocumentReceipt.updateOne(
          baseQuery,
          { $set: { receivers } },
          { upsert: true },
        );
        await DocumentReceipt.updateOne(baseQuery, {
          $set: { "receivers.$[].receiptSig": sigObj },
        });
        await Student.updateMany(
          { _id: { $in: group.map((s) => s._id) } },
          {
            $set: {
              documentReceiptSigUrl: uploaded.url,
              documentReceiptSignedAt: now,
              documentReceivedAt: now,
            },
          },
        );
        return Response.json({ ok: true });
      } catch (e2) {
        console.error("customer/confirm retry error", e2);
      }
    }

    console.error("POST /api/classroom/receive/customer/confirm error", err);
    return Response.json(
      { ok: false, error: "บันทึกไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
