// src/app/api/admin/classes/[id]/route.js
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";
import DocumentReceipt from "@/models/DocumentReceipt";

export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function clean(x) {
  return String(x || "").trim();
}

function normalizeISODate(x) {
  // Expect "YYYY-MM-DD" (accept longer strings -> slice)
  const s = String(x || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}

function uniqueSortedDays(days) {
  const arr = Array.isArray(days) ? days : [];
  const norm = arr.map(normalizeISODate).filter(Boolean);
  const uniq = Array.from(new Set(norm));
  uniq.sort(); // ISO date sorts naturally
  return uniq;
}

function buildContinuousDaysFromStart(startISO, dayCount) {
  const s = normalizeISODate(startISO);
  const n = Math.max(1, Number(dayCount) || 1);
  if (!s) return [];

  const base = new Date(s);
  if (Number.isNaN(base.getTime())) return [];

  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return uniqueSortedDays(out);
}

function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();

  // collapse spaces
  s = s.replace(/\s+/g, " ");
  // normalize hyphen spaces: "INV - 001" -> "INV-001"
  s = s.replace(/\s*-\s*/g, "-");
  // normalize "INV 001" -> "INV-001"
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

function getStudentName(stu) {
  return clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.engName) || "-";
}

/* ---------------- routes ---------------- */

// GET /api/admin/classes/[id]
export async function GET(req, { params }) {
  await dbConnect();
  const { id } = params;

  const cls = await Class.findById(id).lean();
  if (!cls) {
    return new Response("Not found", { status: 404 });
  }

  // ---------- load students + checkins ----------
  const students = await Student.find({ classId: id })
    .select(
      [
        "_id",
        "classId",
        "name",
        "thaiName",
        "engName",
        "company",
        "paymentRef",

        // ✅ IMPORTANT: ส่งสถานะผู้เรียนไปให้ FE ด้วย
        "studentStatus",

        // receive (3.1) cached fields
        "documentReceiveType",
        "documentReceivedAt",
        "documentReceiptSigUrl",
        "documentReceiptSignedAt",

        // checkin fallback signature (ถ้ามีใน Student)
        "signatureUrl",

        // ✅ เผื่อบางจอใช้
        "isLate",
      ].join(" "),
    )
    .lean();

  const checkins = await Checkin.find({ classId: id })
    .select("_id studentId classId day time isLate signatureUrl createdAt")
    .lean();

  // ---------- build checkin map: studentId__day -> checkin ----------
  const checkinByKey = new Map();
  for (const c of checkins || []) {
    const sid = String(c.studentId || "");
    const day = Number(c.day || 0);
    if (!sid || !day) continue;
    checkinByKey.set(`${sid}__${day}`, c);
  }

  // ---------- receipts (customer_receive + staff_receive) ----------
  const receipts = await DocumentReceipt.find({ classId: id })
    .select(
      [
        "_id",
        "type",
        "classId",
        "docId",
        "receivers",
        "staffReceiveItems",
        "customerSig",
        "staffSig",
        "updatedAt",
        "createdAt",
      ].join(" "),
    )
    .lean();

  // map receipts by docId + type
  const receiptCustomerByDoc = new Map(); // docId -> receipt(customer_receive)
  const receiptStaffByDoc = new Map(); // docId -> receipt(staff_receive)
  for (const r of receipts || []) {
    const doc = normalizeDocId(r?.docId);
    if (!doc) continue;

    if (r?.type === "staff_receive") {
      receiptStaffByDoc.set(doc, r);
    } else {
      const prev = receiptCustomerByDoc.get(doc);
      if (!prev) receiptCustomerByDoc.set(doc, r);
      else {
        const prevT = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
        const curT = new Date(r.updatedAt || r.createdAt || 0).getTime();
        if (curT >= prevT) receiptCustomerByDoc.set(doc, r);
      }
    }
  }

  function pickCustomerReceiptSigFromReceivers(receipt, stu) {
    const receivers = Array.isArray(receipt?.receivers)
      ? receipt.receivers
      : [];
    if (!receivers.length) return { url: "", signedAt: null };

    const sid = String(stu?._id || "");
    const name = getStudentName(stu);

    let idx = receivers.findIndex((x) => clean(x?.receiverId) === sid);
    if (idx < 0 && name)
      idx = receivers.findIndex((x) => clean(x?.name) === name);

    if (idx < 0) return { url: "", signedAt: null };

    const rcv = receivers[idx] || {};
    const sig = rcv?.receiptSig || {};
    return {
      url: clean(sig?.url),
      signedAt: sig?.signedAt || null,
    };
  }

  // ---------- enrich students ----------
  const dayCount =
    Array.isArray(cls?.days) && cls.days.length
      ? cls.days.length
      : Number(cls?.dayCount ?? cls?.duration?.dayCount ?? 1) || 1;

  const enrichedStudents = (students || []).map((stu) => {
    const s = { ...stu };

    // ---- checkin daily summary ----
    const daily = [];
    for (let d = 1; d <= dayCount; d++) {
      const ci = checkinByKey.get(`${String(stu._id)}__${d}`);
      if (!ci) {
        daily.push({ day: d, checkedIn: false });
        continue;
      }

      const sigUrl = clean(ci.signatureUrl) || clean(stu.signatureUrl) || "";

      daily.push({
        day: d,
        checkedIn: true,
        time: ci.time || null,
        isLate: !!ci.isLate,
        signatureUrl: sigUrl,
        checkinId: String(ci._id),
      });
    }
    s.checkinDaily = daily;

    // ---- document receipt (3.1) ----
    const docIdNorm = normalizeDocId(s.paymentRef);
    s.docIdNormalized = docIdNorm;

    let docSigUrl = clean(s.documentReceiptSigUrl);
    let docSignedAt = s.documentReceiptSignedAt || null;

    if (!docSigUrl && docIdNorm) {
      const rc = receiptCustomerByDoc.get(docIdNorm);
      if (rc) {
        const picked = pickCustomerReceiptSigFromReceivers(rc, stu);
        if (picked.url) docSigUrl = picked.url;
        if (!docSignedAt && picked.signedAt) docSignedAt = picked.signedAt;
      }
    }

    s.documentReceiptSigUrl = docSigUrl;
    s.documentReceiptSignedAt = docSignedAt;
    s.documentReceiptSig = docSigUrl
      ? { url: docSigUrl, signedAt: docSignedAt }
      : null;

    // ---- staff receive (3.2) ----
    if (docIdNorm) {
      const rs = receiptStaffByDoc.get(docIdNorm);
      if (rs) {
        s.staffReceiveItems = rs.staffReceiveItems || null;

        s.staffReceiveCustomerSig = rs.customerSig || null;
        s.staffReceiveStaffSig = rs.staffSig || null;

        s.staffReceiveCustomerSigUrl = clean(rs?.customerSig?.url);
        s.staffReceiveCustomerSignedAt = rs?.customerSig?.signedAt || null;

        s.staffReceiveStaffSigUrl = clean(rs?.staffSig?.url);
        s.staffReceiveStaffSignedAt = rs?.staffSig?.signedAt || null;

        s.staffReceiveUpdatedAt = rs.updatedAt || rs.createdAt || null;
      } else {
        s.staffReceiveItems = null;
        s.staffReceiveCustomerSig = null;
        s.staffReceiveStaffSig = null;
        s.staffReceiveCustomerSigUrl = "";
        s.staffReceiveCustomerSignedAt = null;
        s.staffReceiveStaffSigUrl = "";
        s.staffReceiveStaffSignedAt = null;
        s.staffReceiveUpdatedAt = null;
      }
    }

    return s;
  });

  const out = {
    ...cls,
    students: enrichedStudents,
    studentsCount: enrichedStudents.length,
    checkins,
  };

  return Response.json(out);
}

// PATCH /api/admin/classes/[id]
export async function PATCH(req, { params }) {
  await dbConnect();
  const { id } = params;
  const body = await req.json().catch(() => ({}));

  const update = {};

  if (body.title !== undefined) {
    update.title = body.title;
    update.courseTitle = body.title;
  }

  if (body.courseCode !== undefined) {
    update.courseCode = body.courseCode;
  }

  if (body.room !== undefined) {
    update.room = body.room;
    update.roomName = body.room;
  }

  if (body.channel !== undefined) {
    update.channel = body.channel;
    update.trainingChannel = body.channel;
    update.mode = body.channel;
  }

  if (body.trainerName !== undefined) {
    update.trainerName = body.trainerName;
    update.trainer = body.trainerName;

    update.instructors = body.trainerName
      ? [{ name: body.trainerName, email: "" }]
      : [];
  }

  let days = null;

  if (body.days !== undefined) {
    const normalized = uniqueSortedDays(body.days);
    days = normalized;
  }

  if (days === null) {
    const startISO = body.date ? normalizeISODate(body.date) : "";
    const dc = body.dayCount !== undefined ? Number(body.dayCount) || 1 : 1;

    if (startISO) {
      days = buildContinuousDaysFromStart(startISO, dc);
    }
  }

  if (Array.isArray(days)) {
    if (days.length === 0) {
      return Response.json(
        { ok: false, error: "days ต้องมีอย่างน้อย 1 วัน (รูปแบบ YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    update.days = days;

    const startISO = days[0];
    const startDate = new Date(startISO);

    update.date = startDate;
    update.startDate = startDate;

    update.dayCount = days.length;
    update["duration.dayCount"] = days.length;
  } else {
    if (body.date !== undefined) {
      const d = body.date ? new Date(body.date) : null;
      update.date = d;
      update.startDate = d;
    }

    if (body.dayCount !== undefined) {
      const dayCount = Number(body.dayCount) || 1;
      update.dayCount = dayCount;
      update["duration.dayCount"] = dayCount;
    }
  }

  try {
    const cls = await Class.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    ).lean();

    if (!cls) {
      return Response.json(
        { ok: false, error: "Class not found" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true, class: cls });
  } catch (err) {
    console.error("PATCH /api/admin/classes/[id] error", err);
    return Response.json(
      { ok: false, error: "อัปเดต Class ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/classes/[id]
export async function DELETE(req, { params }) {
  await dbConnect();
  const { id } = params;

  try {
    const cls = await Class.findByIdAndDelete(id);
    if (!cls) {
      return Response.json(
        { ok: false, error: "Class not found" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/classes/[id] error", err);
    return Response.json(
      { ok: false, error: "ลบ Class ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
