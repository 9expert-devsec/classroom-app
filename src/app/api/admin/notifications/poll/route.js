// src/app/api/admin/notifications/poll/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import { requireAdmin } from "@/lib/adminAuth.server";

import Checkin from "@/models/Checkin";
import Student from "@/models/Student";
import Class from "@/models/Class";

import FoodEditLog from "@/models/FoodEditLog";
import DocumentReceipt from "@/models/DocumentReceipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

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

function safeDateFromIso(iso) {
  const s = clean(iso);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pickCursorDateFromCheckin(row) {
  return (
    (row?.updatedAt && new Date(row.updatedAt)) ||
    (row?.time && new Date(row.time)) ||
    (row?.createdAt && new Date(row.createdAt)) ||
    new Date()
  );
}

function choiceLabel(t) {
  const v = clean(t);
  if (v === "coupon") return "Coupon";
  if (v === "noFood") return "ไม่รับอาหาร";
  return "รับอาหาร";
}

/* ---------------- receipts/sends helpers ---------------- */

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

function pickCustomerFromDoc(doc) {
  const receivers = Array.isArray(doc?.receivers) ? doc.receivers : [];

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
    clean(r0?.name) || clean(doc?.customerSig?.signerName) || "ลูกค้า";
  const senderCompany =
    clean(r0?.company) || clean(doc?.customerSig?.signerCompany || "");

  return { senderName, senderCompany };
}

function pickLatestSendEvent(doc) {
  const staffAt = doc?.staffSig?.signedAt
    ? new Date(doc.staffSig.signedAt)
    : null;
  const hasStaffAt = staffAt && !Number.isNaN(staffAt.getTime());

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

/* ---------------- prime cursor ---------------- */

async function getPrimeCursor() {
  const [latestCheckin, latestFoodEdit, latestReceiptDoc, latestSendDoc] =
    await Promise.all([
      Checkin.findOne({})
        .sort({ time: -1, updatedAt: -1, createdAt: -1 })
        .limit(1)
        .lean(),
      FoodEditLog.findOne({}).sort({ createdAt: -1 }).limit(1).lean(),
      DocumentReceipt.findOne({
        "receivers.receiptSig.signedAt": { $ne: null },
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean(),
      DocumentReceipt.findOne({
        $or: [
          { "staffSig.signedAt": { $ne: null } },
          { "receivers.withholdingSig.signedAt": { $ne: null } },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(1)
        .lean(),
    ]);

  const candidates = [];

  if (latestCheckin) {
    const d = pickCursorDateFromCheckin(latestCheckin);
    if (d && !Number.isNaN(d.getTime())) candidates.push(d);
  }
  if (latestFoodEdit?.createdAt) {
    const d = new Date(latestFoodEdit.createdAt);
    if (!Number.isNaN(d.getTime())) candidates.push(d);
  }
  if (latestReceiptDoc) {
    const ev = pickLatestReceiptEvent(latestReceiptDoc);
    if (ev?.signedAt && !Number.isNaN(ev.signedAt.getTime()))
      candidates.push(ev.signedAt);
  }
  if (latestSendDoc) {
    const ev = pickLatestSendEvent(latestSendDoc);
    if (ev?.signedAt && !Number.isNaN(ev.signedAt.getTime()))
      candidates.push(ev.signedAt);
  }

  if (!candidates.length) return new Date().toISOString();
  candidates.sort((a, b) => a - b);
  return candidates[candidates.length - 1].toISOString();
}

/* ---------------- builder: checkins ---------------- */

async function buildCheckins(sinceDate, limit = 20) {
  const q = {
    $or: [
      { updatedAt: { $gt: sinceDate } },
      { time: { $gt: sinceDate } },
      { createdAt: { $gt: sinceDate } },
    ],
  };

  const rows = await Checkin.find(q)
    .sort({ time: -1, updatedAt: -1 })
    .limit(limit)
    .lean();

  if (!rows.length) return [];

  const studentIds = [
    ...new Set(rows.map((r) => String(r.studentId || "")).filter(Boolean)),
  ];
  const classIds = [
    ...new Set(rows.map((r) => String(r.classId || "")).filter(Boolean)),
  ];

  const [students, classes] = await Promise.all([
    Student.find({ _id: { $in: studentIds } })
      .select("name thaiName engName")
      .lean(),
    Class.find({ _id: { $in: classIds } })
      .select("title")
      .lean(),
  ]);

  const studentMap = new Map(students.map((s) => [String(s._id), s]));
  const classMap = new Map(classes.map((c) => [String(c._id), c]));

  return rows
    .slice()
    .reverse()
    .map((r) => {
      const st = studentMap.get(String(r.studentId)) || {};
      const cl = classMap.get(String(r.classId)) || {};

      const fullName =
        clean(st.name) || clean(st.thaiName) || clean(st.engName) || "ผู้เรียน";

      const cursorDate = pickCursorDateFromCheckin(r);
      const cursor = cursorDate.toISOString();

      const timeText =
        formatTimeBKK(r.time) ||
        formatTimeBKK(r.updatedAt) ||
        formatTimeBKK(r.createdAt);

      const classTitle = clean(cl.title) || "ไม่ระบุคลาส";

      return {
        type: "checkin",
        id: String(r._id),
        eventId: `${String(r._id)}:${cursor}`,
        cursor,
        message: `คุณ ${fullName} ได้ทำการเช็คอินเรียบร้อย เวลา ${timeText} จาก class ${classTitle}`,
      };
    });
}

/* ---------------- builder: food edits ---------------- */

async function buildFoodEdits(sinceDate, limit = 20) {
  const rows = await FoodEditLog.find({ createdAt: { $gt: sinceDate } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return rows
    .slice()
    .reverse()
    .map((r) => {
      const cursor = new Date(r.createdAt).toISOString();
      return {
        type: "foodEdit",
        id: `${String(r._id)}:${cursor}`,
        eventId: `${String(r._id)}:${cursor}`,
        cursor,
        classId: clean(r.classId),
        studentName: clean(r.studentName) || "ผู้เรียน",
        studentCompany: clean(r.studentCompany),
        choiceType: clean(r.choiceType),
      };
    });
}

/* ---------------- builder: receipts + sends (DocumentReceipt union) ---------------- */

async function buildReceiptAndSendEvents(sinceDate, limitDocs = 50) {
  const q = {
    $or: [
      { "receivers.receiptSig.signedAt": { $ne: null } },
      { "staffSig.signedAt": { $ne: null } },
      { "receivers.withholdingSig.signedAt": { $ne: null } },
    ],
    updatedAt: { $gt: sinceDate }, // กรองกว้างเร็ว แล้วคัดด้วย signedAt อีกชั้น
  };

  const rows = await DocumentReceipt.find(q)
    .sort({ updatedAt: -1 })
    .limit(limitDocs)
    .lean();

  const receiptEvents = [];
  const sendEvents = [];

  for (const doc of rows) {
    // receipt
    const rEv = pickLatestReceiptEvent(doc);
    if (rEv?.signedAt && rEv.signedAt > sinceDate) {
      receiptEvents.push({
        type: "receipt",
        id: `${String(doc._id)}:${rEv.signedAt.toISOString()}`,
        eventId: `${String(doc._id)}:${rEv.signedAt.toISOString()}`,
        cursor: rEv.signedAt.toISOString(),
        classId: String(doc.classId || ""),
        docId: clean(doc.docId),
        signerName: rEv.signerName,
        signerCompany: rEv.signerCompany,
        receiveType: rEv.receiveType,
        timeText: formatTimeBKK(rEv.signedAt),
      });
    }

    // send
    const sEv = pickLatestSendEvent(doc);
    if (sEv?.signedAt && sEv.signedAt > sinceDate) {
      sendEvents.push({
        type: "send",
        id: `${String(doc._id)}:${sEv.signedAt.toISOString()}`,
        eventId: `${String(doc._id)}:${sEv.signedAt.toISOString()}`,
        cursor: sEv.signedAt.toISOString(),
        classId: sEv.classId,
        docId: sEv.docId,
        senderName: sEv.senderName,
        senderCompany: sEv.senderCompany,
        timeText: formatTimeBKK(sEv.signedAt),
      });
    }
  }

  // เก่า -> ใหม่
  receiptEvents.sort((a, b) => new Date(a.cursor) - new Date(b.cursor));
  sendEvents.sort((a, b) => new Date(a.cursor) - new Date(b.cursor));

  return { receiptEvents, sendEvents };
}

/* ---------------- handler ---------------- */

export async function GET(req) {
  try {
    await requireAdmin();
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const since = clean(searchParams.get("since"));
    const prime = clean(searchParams.get("prime")) === "1";

    if (prime) {
      const cursor = await getPrimeCursor();
      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const sinceDateRaw = safeDateFromIso(since);

    // handshake (เผื่อไม่ได้ prime)
    if (!sinceDateRaw) {
      return NextResponse.json(
        { ok: true, cursor: new Date().toISOString(), items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // overlap 2s กันพลาด event ชนกัน/มาช้า
    const sinceDate = new Date(sinceDateRaw.getTime() - 2000);

    const [checkins, foodEdits, docPack] = await Promise.all([
      buildCheckins(sinceDate, 20),
      buildFoodEdits(sinceDate, 20),
      buildReceiptAndSendEvents(sinceDate, 60),
    ]);

    const { receiptEvents, sendEvents } = docPack;

    // ดึง class title ครั้งเดียวสำหรับ (receipt/send/foodEdit)
    const classIds = [
      ...new Set(
        [...foodEdits, ...receiptEvents, ...sendEvents]
          .map((e) => clean(e.classId))
          .filter(Boolean),
      ),
    ];

    const classes = classIds.length
      ? await Class.find({ _id: { $in: classIds } })
          .select("title")
          .lean()
      : [];
    const classMap = new Map(classes.map((c) => [String(c._id), c]));

    const foodItems = foodEdits.map((e) => {
      const cl = classMap.get(String(e.classId)) || {};
      const classTitle = clean(cl.title) || "ไม่ระบุคลาส";
      const company = e.studentCompany ? ` (${e.studentCompany})` : "";
      const when = formatTimeBKK(e.cursor);
      const label = choiceLabel(e.choiceType);

      return {
        type: "foodEdit",
        id: e.id,
        eventId: e.eventId,
        cursor: e.cursor,
        message: `คุณ ${e.studentName}${company} ยืนยันอาหาร: ${label} เวลา ${when} จาก class ${classTitle}`,
      };
    });

    const receiptItems = receiptEvents.map((e) => {
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
        type: "receipt",
        id: e.id,
        eventId: e.eventId,
        cursor: e.cursor,
        message: `คุณ ${e.signerName}${company} ได้รับเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}${recv}`,
      };
    });

    const sendItems = sendEvents.map((e) => {
      const cl = classMap.get(String(e.classId)) || {};
      const classTitle = clean(cl.title) || "ไม่ระบุคลาส";
      const company = e.senderCompany ? ` (${e.senderCompany})` : "";
      const ref = e.docId ? ` ${e.docId}` : "";

      return {
        type: "send",
        id: e.id,
        eventId: e.eventId,
        cursor: e.cursor,
        message: `คุณ ${e.senderName}${company} ได้นำส่งเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}`,
      };
    });

    const items = [...checkins, ...receiptItems, ...sendItems, ...foodItems]
      .filter(Boolean)
      .sort((a, b) => String(a.cursor).localeCompare(String(b.cursor)));

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
