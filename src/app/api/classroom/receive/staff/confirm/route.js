// src/app/api/classroom/receive/staff/confirm/route.js
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

  // "INV 001" -> "INV-001"
  let m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  // ✅ "INV001" / "RP2026020071" -> "INV-001" / "RP-2026020071"
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

  // ✅ รับ senderStudentId แบบเดียวกับ 3.1 (fallback ไป sender.studentId)
  const senderStudentIdReq =
    clean(body?.senderStudentId) || clean(body?.sender?.studentId);

  // (fallback) เผื่อ client ส่งชื่อ/บริษัทมา แต่เราจะใช้ต่อเมื่อ lookup ไม่เจอ
  const senderFromClient = body?.sender || {};
  const senderNameClient = clean(senderFromClient?.name);
  const senderCompanyClient = clean(senderFromClient?.company);

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

  // ✅ resolve sender จาก Student ในคลาส (กัน spoof + ได้ข้อมูลถูก)
  let senderObj = { studentId: "", name: "", company: "" };

  if (senderStudentIdReq) {
    const senderStu = await Student.findOne({
      _id: senderStudentIdReq,
      classId,
    })
      .select("_id name thaiName engName company paymentRef")
      .lean();

    if (senderStu) {
      // (optional) ถ้าต้องการบังคับว่า sender ต้องอยู่ในกลุ่มเลข doc เดียวกันจริง
      // ถ้าอยาก strict ให้เปิด if นี้
      // const prNorm = normalizeDocId(senderStu.paymentRef);
      // if (prNorm && prNorm !== docId) {
      //   return Response.json(
      //     { ok: false, error: "senderStudentId ไม่อยู่ในกลุ่มเลขเอกสารนี้" },
      //     { status: 400 },
      //   );
      // }

      senderObj = {
        studentId: String(senderStu._id),
        name:
          clean(senderStu.name) ||
          clean(senderStu.thaiName) ||
          clean(senderStu.engName) ||
          "-",
        company: clean(senderStu.company),
      };
    }
  }

  // fallback: ถ้า lookup ไม่เจอ แต่ client ส่งชื่อมา ก็ยังเก็บไว้เป็นตัวแทนได้
  if (!senderObj.name && (senderNameClient || senderCompanyClient)) {
    senderObj = {
      studentId: senderObj.studentId || senderStudentIdReq || "",
      name: senderNameClient,
      company: senderCompanyClient,
    };
  }

  // ถ้าคุณต้องการ “บังคับต้องรู้ตัวแทนเสมอ” ให้เปิด validation นี้
  // if (!senderObj.name) {
  //   return Response.json(
  //     { ok: false, error: "missing sender (senderStudentId/name)" },
  //     { status: 400 },
  //   );
  // }

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

    // ✅ ตัวแทนนำส่งเอกสาร
    sender: senderObj,
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

        // ✅ ส่งกลับให้ FE ใช้โชว์ได้ทันที
        sender: receipt.sender || senderObj,
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
            sender: receipt.sender || senderObj,
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
