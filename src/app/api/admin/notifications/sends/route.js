// src/app/api/admin/notifications/sends/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";
import DocumentReceipt from "@/models/DocumentReceipt";
import Class from "@/models/Class";
import Student from "@/models/Student";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  let m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  // normalize "INV001" -> "INV-001"
  m = s.match(/^([A-Z]{2,10})([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

function parseDocParts(docNorm) {
  const s = normalizeDocId(docNorm);
  const m = s.match(/^([A-Z]{2,10})-([0-9]{1,20})$/);
  if (!m) return null;
  return { prefix: m[1], num: m[2] };
}

function buildDocLooseRegex(docNorm) {
  const parts = parseDocParts(docNorm);
  if (!parts) {
    const raw = escapeRegExp(normalizeDocId(docNorm));
    return new RegExp(`^\\s*${raw}\\s*$`, "i");
  }
  const { prefix, num } = parts;
  // ^ INV\s*[- ]?\s*001 $
  return new RegExp(
    `^\\s*${escapeRegExp(prefix)}\\s*[- ]?\\s*${escapeRegExp(num)}\\s*$`,
    "i",
  );
}

function formatTimeBKK(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function pickStudentName(stu) {
  if (!stu) return "";
  return clean(stu?.name) || clean(stu?.thaiName) || clean(stu?.engName) || "";
}

/**
 * พยายามดึงชื่อ “ลูกค้า/ผู้ส่งเอกสาร” จาก DocumentReceipt ก่อน
 * - receivers: เลือก receiver ที่มี withholdingSig ล่าสุด (ถ้ามี)
 * - customerSig: รองรับหลาย key เผื่อ schema ต่างกัน
 */
function pickCustomerFromDoc(doc) {
  const receivers = Array.isArray(doc?.receivers) ? doc.receivers : [];

  // เลือก receiver ที่มี withholdingSig ล่าสุด (ถ้ามี)
  let best = null;
  let bestAt = null;

  for (const r of receivers) {
    const at = r?.withholdingSig?.signedAt
      ? new Date(r.withholdingSig.signedAt)
      : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (!bestAt || at > bestAt) {
      bestAt = at;
      best = r;
    }
  }

  const r0 = best || receivers[0] || null;

  const senderName =
    clean(r0?.name) ||
    clean(doc?.customerSig?.signerName) ||
    clean(doc?.customerSig?.name) ||
    clean(doc?.customerSig?.fullName) ||
    clean(doc?.customerName) ||
    "ลูกค้า";

  const senderCompany =
    clean(r0?.company) ||
    clean(doc?.customerSig?.signerCompany) ||
    clean(doc?.customerSig?.company) ||
    clean(doc?.customerCompany) ||
    "";

  return { senderName, senderCompany };
}

/**
 * ✅ NEW: ถ้าใน doc ยังเป็น "ลูกค้า" ให้ไปหา name/company จาก Student ด้วย
 * โดยใช้ classId + paymentRef ที่ match กับ docId แบบ loose regex
 */
async function resolveCustomerNameFromStudent(doc) {
  const classId = String(doc?.classId || "");
  const docIdNorm = normalizeDocId(doc?.docId);

  if (!classId || !docIdNorm)
    return { senderName: "ลูกค้า", senderCompany: "" };

  const payRegex = buildDocLooseRegex(docIdNorm);

  const stu = await Student.findOne({ classId, paymentRef: payRegex })
    .select("name thaiName engName company paymentRef")
    .lean();

  if (!stu) return { senderName: "ลูกค้า", senderCompany: "" };

  const senderName = pickStudentName(stu) || "ลูกค้า";
  const senderCompany = clean(stu.company) || "";
  return { senderName, senderCompany };
}

// event “ส่งเอกสาร” = ใช้ staffSig.signedAt เป็นหลัก (แปลว่าจบงานแล้ว)
// แต่ชื่อคน = ลูกค้า (receiver/customer)
async function pickLatestSendEvent(doc) {
  const staffAt = doc?.staffSig?.signedAt
    ? new Date(doc.staffSig.signedAt)
    : null;
  const hasStaffAt = staffAt && !Number.isNaN(staffAt.getTime());

  // fallback: ถ้าไม่มี staffSig จริง ๆ ค่อยใช้ withholdingSig ล่าสุด
  let fallbackAt = null;
  const receivers = Array.isArray(doc?.receivers) ? doc.receivers : [];
  for (const r of receivers) {
    const at = r?.withholdingSig?.signedAt
      ? new Date(r.withholdingSig.signedAt)
      : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (!fallbackAt || at > fallbackAt) fallbackAt = at;
  }

  const signedAt = hasStaffAt ? staffAt : fallbackAt;
  if (!signedAt) return null;

  // 1) ดึงจาก doc ก่อน
  let { senderName, senderCompany } = pickCustomerFromDoc(doc);

  // 2) ถ้ายังเป็น "ลูกค้า" ให้ไปหาใน Student
  if (!senderName || senderName === "ลูกค้า") {
    const fromStudent = await resolveCustomerNameFromStudent(doc);
    if (fromStudent?.senderName && fromStudent.senderName !== "ลูกค้า") {
      senderName = fromStudent.senderName;
    }
    if (!senderCompany && fromStudent?.senderCompany) {
      senderCompany = fromStudent.senderCompany;
    }
  }

  return {
    signedAt,
    senderName,
    senderCompany,
    classId: String(doc?.classId || ""),
    docId: clean(doc?.docId),
  };
}

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const since = clean(searchParams.get("since"));
    const prime = clean(searchParams.get("prime")) === "1";

    // PRIME: เอา cursor ล่าสุดจาก server
    if (prime) {
      const latestDoc = await DocumentReceipt.findOne({
        $or: [
          { "staffSig.signedAt": { $ne: null } },
          { "receivers.withholdingSig.signedAt": { $ne: null } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean();

      const ev = latestDoc ? await pickLatestSendEvent(latestDoc) : null;
      const cursor = ev?.signedAt
        ? ev.signedAt.toISOString()
        : new Date().toISOString();

      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const sinceDate = since ? new Date(since) : null;
    const hasSince = sinceDate && !Number.isNaN(sinceDate.getTime());

    // ✅ HANDSHAKE: ไม่มี since (หรือ parse ไม่ได้) -> ไม่ส่งของเก่า
    if (!hasSince) {
      const latestDoc = await DocumentReceipt.findOne({
        $or: [
          { "staffSig.signedAt": { $ne: null } },
          { "receivers.withholdingSig.signedAt": { $ne: null } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean();

      const ev = latestDoc ? await pickLatestSendEvent(latestDoc) : null;
      const cursor = ev?.signedAt
        ? ev.signedAt.toISOString()
        : new Date().toISOString();

      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const q = {
      $or: [
        { "staffSig.signedAt": { $ne: null } },
        { "receivers.withholdingSig.signedAt": { $ne: null } },
      ],
      updatedAt: { $gt: sinceDate },
    };

    const rows = await DocumentReceipt.find(q)
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const events = [];
    for (const doc of rows) {
      const ev = await pickLatestSendEvent(doc);
      if (!ev) continue;
      if (ev.signedAt <= sinceDate) continue;

      events.push({
        id: `${String(doc._id)}:${ev.signedAt.toISOString()}`,
        cursor: ev.signedAt.toISOString(),
        classId: ev.classId,
        docId: ev.docId,
        senderName: ev.senderName,
        senderCompany: ev.senderCompany,
        timeText: formatTimeBKK(ev.signedAt),
      });
    }

    // เก่า -> ใหม่
    events.sort((a, b) => new Date(a.cursor) - new Date(b.cursor));

    const classIds = [...new Set(events.map((e) => e.classId).filter(Boolean))];
    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } })
          .select("title")
          .lean()
      : [];
    const classMap = new Map(classes.map((c) => [String(c._id), c]));

    const items = events.map((e) => {
      const cl = classMap.get(String(e.classId)) || {};
      const classTitle = clean(cl.title) || "ไม่ระบุคลาส";
      const company = e.senderCompany ? ` (${e.senderCompany})` : "";
      const ref = e.docId ? ` ${e.docId}` : "";
      const displayName = clean(e.senderName) || "ลูกค้า";

      return {
        id: e.id,
        cursor: e.cursor,
        message: `คุณ ${displayName}${company} ได้นำส่งเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}`,
      };
    });

    const newCursor = items.length ? items[items.length - 1].cursor : since;

    return NextResponse.json(
      { ok: true, cursor: newCursor, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err?.message || "ERROR" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
}
