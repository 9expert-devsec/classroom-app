// src/app/api/admin/notifications/sends/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";
import DocumentReceipt from "@/models/DocumentReceipt";
import Class from "@/models/Class";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x || "").trim();
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

  // ถ้าไม่มี withholdingSig เลย ใช้ตัวแรก
  const r0 = best || receivers[0] || null;

  const senderName =
    clean(r0?.name) || clean(doc?.customerSig?.signerName) || "ลูกค้า";

  const senderCompany =
    clean(r0?.company) || clean(doc?.customerSig?.signerCompany || "");

  return { senderName, senderCompany };
}

// event “ส่งเอกสาร” = ใช้ staffSig.signedAt เป็นหลัก (แปลว่าจบงานแล้ว)
// แต่ชื่อคน = ลูกค้า (receiver)
function pickLatestSendEvent(doc) {
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

  const { senderName, senderCompany } = pickCustomerFromDoc(doc);

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

      const ev = latestDoc ? pickLatestSendEvent(latestDoc) : null;
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

    const q = {
      $or: [
        { "staffSig.signedAt": { $ne: null } },
        { "receivers.withholdingSig.signedAt": { $ne: null } },
      ],
    };
    if (hasSince) q.updatedAt = { $gt: sinceDate };

    const rows = await DocumentReceipt.find(q)
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const events = [];
    for (const doc of rows) {
      const ev = pickLatestSendEvent(doc);
      if (!ev) continue;
      if (hasSince && ev.signedAt <= sinceDate) continue;

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

      return {
        id: e.id,
        cursor: e.cursor,
        message: `คุณ ${e.senderName}${company} ได้นำส่งเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}`,
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
