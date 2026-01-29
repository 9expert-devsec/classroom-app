// src/app/api/classroom/receive/lookup/route.js
import dbConnect from "@/lib/mongoose";
import DocumentReceipt from "@/models/DocumentReceipt";
import Student from "@/models/Student";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
}

// ✅ รองรับ inv-001, INV 001, INV - 001
function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();
  if (!s) return "";
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-"); // "INV - 001" -> "INV-001"

  // "INV 001" -> "INV-001"
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

// ✅ docId ตัวเลือก: INV-001, INV001 (เผื่อ data ใน DB ไม่เหมือนกัน)
function altDocIds(docId) {
  const a = new Set();
  const s = docId || "";
  if (!s) return [];

  a.add(s);

  if (s.includes("-")) {
    a.add(s.replace(/-/g, "")); // INV-001 -> INV001
  } else {
    // INV001 -> INV-001 (ถ้าเข้า pattern)
    a.add(s.replace(/^([A-Z]{2,10})([0-9]+)/, "$1-$2"));
  }

  return Array.from(a).filter(Boolean);
}

function pickStudentName(s = {}) {
  return clean(s.thaiName || s.name || s.engName || "");
}
function pickCompany(s = {}) {
  return clean(s.company || "");
}
function pickReceiveType(s = {}) {
  return clean(s.documentReceiveType || "");
}

async function buildReceiversFromStudents({ classId, docIds }) {
  const matched = await Student.find({
    classId,
    paymentRef: { $in: docIds },
  })
    .lean()
    .limit(500);

  return matched
    .map((s) => ({
      name: pickStudentName(s),
      company: pickCompany(s),
      documentReceiveType: pickReceiveType(s), // ✅ ส่ง type ไปให้ UI
    }))
    .filter((r) => r.name);
}

export async function POST(req) {
  await dbConnect();

  const body = await req.json().catch(() => ({}));
  const classId = clean(body?.classId);
  const docIdRaw = clean(body?.docId);

  if (!classId) {
    return Response.json(
      { ok: false, error: "missing classId" },
      { status: 400 },
    );
  }
  if (!docIdRaw) {
    return Response.json(
      { ok: false, error: "missing docId" },
      { status: 400 },
    );
  }

  const docId = normalizeDocId(docIdRaw);
  const docIds = altDocIds(docId);

  // 1) หา receipt ก่อน (docId แบบ normalized)
  let receipt = await DocumentReceipt.findOne({ classId, docId }).lean();

  // 2) ถ้าไม่เจอ ลอง docId แบบ alternate (กันเคสเคยสร้าง INV001)
  if (!receipt && docIds.length > 1) {
    receipt = await DocumentReceipt.findOne({
      classId,
      docId: { $in: docIds },
    }).lean();
  }

  // --- สร้างหรือ sync receivers ---
  if (!receipt) {
    const receivers = await buildReceiversFromStudents({ classId, docIds });

    if (!receivers.length) {
      return Response.json(
        { ok: false, error: `ไม่พบเลขที่ QT/IV/RP "${docIdRaw}" ในคลาสนี้` },
        { status: 404 },
      );
    }

    // สร้าง record (กัน unique race)
    try {
      const created = await DocumentReceipt.create({
        type: "customer_receive",
        classId,
        docId, // เก็บเป็น normalized หลัก
        receivers,
      });
      receipt = created.toObject();
    } catch (e) {
      // race ชน unique -> re-fetch
      receipt = await DocumentReceipt.findOne({ classId, docId }).lean();
      if (!receipt) {
        return Response.json(
          { ok: false, error: String(e?.message || e) },
          { status: 500 },
        );
      }
    }
  } else {
    // ✅ ถ้าเคยสร้างไว้แต่ receivers ว่าง หรือไม่มี documentReceiveType -> sync ใหม่จาก students
    const hasReceivers =
      Array.isArray(receipt.receivers) && receipt.receivers.length > 0;
    const hasType =
      hasReceivers &&
      receipt.receivers.some(
        (r) => (r && String(r.documentReceiveType || "").trim()) !== "",
      );

    if (!hasReceivers || !hasType) {
      const receivers = await buildReceiversFromStudents({ classId, docIds });

      if (receivers.length) {
        await DocumentReceipt.updateOne(
          { _id: receipt._id },
          {
            $set: {
              receivers,
              docId, // บังคับให้เป็น normalized ด้วย
            },
          },
        );
        receipt = await DocumentReceipt.findById(receipt._id).lean();
      }
    }
  }

  return Response.json({
    ok: true,
    item: {
      id: String(receipt._id),
      classId: String(receipt.classId),
      docId: receipt.docId,
      normalizedDocId: docId,
      receivers: (receipt.receivers || []).map((r, idx) => ({
        index: idx,
        name: r?.name || "",
        company: r?.company || "",
        documentReceiveType: r?.documentReceiveType || "", // ✅ ส่งไปให้ UI
        receiptSignedAt: r?.receiptSig?.signedAt || null,
      })),
    },
  });
}
