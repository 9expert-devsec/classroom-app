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

function pickLatestReceiptEvent(doc) {
  const receivers = Array.isArray(doc?.receivers) ? doc.receivers : [];
  let latestSignedAt = null;
  let signer = null;

  for (const r of receivers) {
    const signedAt = r?.receiptSig?.signedAt
      ? new Date(r.receiptSig.signedAt)
      : null;
    if (!signedAt || Number.isNaN(signedAt.getTime())) continue;
    if (!latestSignedAt || signedAt > latestSignedAt) {
      latestSignedAt = signedAt;
      signer = r;
    }
  }

  if (!latestSignedAt) return null;

  return {
    signedAt: latestSignedAt,
    signerName: clean(signer?.name) || "ผู้เรียน",
    signerCompany: clean(signer?.company),
    receiveType: clean(signer?.documentReceiveType),
  };
}

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const since = clean(searchParams.get("since"));
    const prime = clean(searchParams.get("prime")) === "1";

    // ✅ PRIME: ขอ cursor ล่าสุดจาก server (กันปัญหาเวลาเครื่อง client คลาด + กันเด้งของเก่า)
    if (prime) {
      const latestDoc = await DocumentReceipt.findOne({
        "receivers.receiptSig.signedAt": { $ne: null },
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean();

      const ev = latestDoc ? pickLatestReceiptEvent(latestDoc) : null;
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

    // query กว้างไว้ก่อนด้วย updatedAt (เร็ว) แล้วค่อยกรอง signedAt อีกชั้น (แม่น)
    const q = {
      "receivers.receiptSig.signedAt": { $ne: null },
    };
    if (hasSince) q.updatedAt = { $gt: sinceDate };

    const rows = await DocumentReceipt.find(q)
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    // สร้าง event เฉพาะที่ “signedAt > since”
    const events = [];
    for (const doc of rows) {
      const ev = pickLatestReceiptEvent(doc);
      if (!ev) continue;
      if (hasSince && ev.signedAt <= sinceDate) continue;

      events.push({
        id: `${String(doc._id)}:${ev.signedAt.toISOString()}`,
        cursor: ev.signedAt.toISOString(),
        classId: String(doc.classId || ""),
        docId: clean(doc.docId),
        signerName: ev.signerName,
        signerCompany: ev.signerCompany,
        receiveType: ev.receiveType,
        timeText: formatTimeBKK(ev.signedAt),
      });
    }

    // เรียงเก่า -> ใหม่ เพื่อ toast ตามลำดับ
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
      const ref = e.docId ? ` ${e.docId}` : "";
      const company = e.signerCompany ? ` (${e.signerCompany})` : "";
      const recv =
        e.receiveType === "ems"
          ? " (ส่ง EMS)"
          : e.receiveType === "on_class"
            ? " (รับ ณ วันอบรม)"
            : "";

      return {
        id: e.id,
        cursor: e.cursor,
        message: `คุณ ${e.signerName}${company} ได้รับเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}${recv}`,
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
