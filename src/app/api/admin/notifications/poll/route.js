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

// since token รูปแบบ: "2026-02-17T03:06:30.867Z|checkin|<id>"
function parseCursorToken(token) {
  const s = clean(token);
  if (!s) return null;
  const [iso] = s.split("|");
  const d = safeDateFromIso(iso);
  if (!d) return null;
  return { sinceTs: d, sinceKey: s };
}

function cursorKeyOf(iso, type, id) {
  // iso ต้องเป็น ISO string (lexicographic sortable)
  return `${iso}|${type}|${String(id || "")}`;
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

/* ---------------- prime cursor (composite) ---------------- */

async function getPrimeCursorKey() {
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
    if (d && !Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      candidates.push(cursorKeyOf(iso, "checkin", latestCheckin._id));
    }
  }

  if (latestFoodEdit?.createdAt) {
    const d = new Date(latestFoodEdit.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const iso = d.toISOString();
      candidates.push(cursorKeyOf(iso, "foodEdit", latestFoodEdit._id));
    }
  }

  if (latestReceiptDoc) {
    const ev = pickLatestReceiptEvent(latestReceiptDoc);
    if (ev?.signedAt && !Number.isNaN(ev.signedAt.getTime())) {
      const iso = ev.signedAt.toISOString();
      candidates.push(cursorKeyOf(iso, "receipt", latestReceiptDoc._id));
    }
  }

  if (latestSendDoc) {
    const ev = pickLatestSendEvent(latestSendDoc);
    if (ev?.signedAt && !Number.isNaN(ev.signedAt.getTime())) {
      const iso = ev.signedAt.toISOString();
      candidates.push(cursorKeyOf(iso, "send", latestSendDoc._id));
    }
  }

  if (!candidates.length) {
    const nowIso = new Date().toISOString();
    return cursorKeyOf(nowIso, "init", "0");
  }

  candidates.sort((a, b) => a.localeCompare(b));
  return candidates[candidates.length - 1];
}

/* ---------------- builder: checkins ---------------- */

async function buildCheckins(querySinceDate, sinceKey, limit = 20) {
  const q = {
    $or: [
      { updatedAt: { $gt: querySinceDate } },
      { time: { $gt: querySinceDate } },
      { createdAt: { $gt: querySinceDate } },
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

  const items = [];

  // เรียงเก่า -> ใหม่
  for (const r of rows.slice().reverse()) {
    const st = studentMap.get(String(r.studentId)) || {};
    const cl = classMap.get(String(r.classId)) || {};

    const fullName =
      clean(st.name) || clean(st.thaiName) || clean(st.engName) || "ผู้เรียน";

    const cursorDate = pickCursorDateFromCheckin(r);
    const cursorIso = cursorDate.toISOString();
    const cKey = cursorKeyOf(cursorIso, "checkin", r._id);

    // ✅ filter แบบ cursorKey (exclusive) กันเด้งของเก่าหลัง refresh/login
    if (cKey.localeCompare(sinceKey) <= 0) continue;

    const timeText =
      formatTimeBKK(r.time) ||
      formatTimeBKK(r.updatedAt) ||
      formatTimeBKK(r.createdAt);

    const classTitle = clean(cl.title) || "ไม่ระบุคลาส";

    items.push({
      type: "checkin",
      id: String(r._id),
      eventId: `${String(r._id)}:${cursorIso}`,
      cursor: cursorIso,
      cursorKey: cKey,
      message: `คุณ ${fullName} ได้ทำการเช็คอินเรียบร้อย เวลา ${timeText} จาก class ${classTitle}`,
    });
  }

  return items;
}

/* ---------------- builder: food edits ---------------- */

async function buildFoodEdits(querySinceDate, sinceKey, limit = 20) {
  const rows = await FoodEditLog.find({ createdAt: { $gt: querySinceDate } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const items = [];

  for (const r of rows.slice().reverse()) {
    const cursorIso = new Date(r.createdAt).toISOString();
    const cKey = cursorKeyOf(cursorIso, "foodEdit", r._id);
    if (cKey.localeCompare(sinceKey) <= 0) continue;

    items.push({
      type: "foodEdit",
      id: `${String(r._id)}:${cursorIso}`,
      eventId: `${String(r._id)}:${cursorIso}`,
      cursor: cursorIso,
      cursorKey: cKey,
      classId: clean(r.classId),
      studentName: clean(r.studentName) || "ผู้เรียน",
      studentCompany: clean(r.studentCompany),
      choiceType: clean(r.choiceType),
    });
  }

  return items;
}

/* ---------------- builder: receipts + sends (DocumentReceipt union) ---------------- */

async function buildReceiptAndSendEvents(
  querySinceDate,
  sinceKey,
  limitDocs = 60,
) {
  const q = {
    $or: [
      { "receivers.receiptSig.signedAt": { $ne: null } },
      { "staffSig.signedAt": { $ne: null } },
      { "receivers.withholdingSig.signedAt": { $ne: null } },
    ],
    updatedAt: { $gt: querySinceDate },
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
    if (rEv?.signedAt && !Number.isNaN(rEv.signedAt.getTime())) {
      const cursorIso = rEv.signedAt.toISOString();
      const cKey = cursorKeyOf(cursorIso, "receipt", doc._id);
      if (cKey.localeCompare(sinceKey) > 0) {
        receiptEvents.push({
          type: "receipt",
          id: `${String(doc._id)}:${cursorIso}`,
          eventId: `${String(doc._id)}:${cursorIso}`,
          cursor: cursorIso,
          cursorKey: cKey,
          classId: String(doc.classId || ""),
          docId: clean(doc.docId),
          signerName: rEv.signerName,
          signerCompany: rEv.signerCompany,
          receiveType: rEv.receiveType,
          timeText: formatTimeBKK(rEv.signedAt),
        });
      }
    }

    // send
    const sEv = pickLatestSendEvent(doc);
    if (sEv?.signedAt && !Number.isNaN(sEv.signedAt.getTime())) {
      const cursorIso = sEv.signedAt.toISOString();
      const cKey = cursorKeyOf(cursorIso, "send", doc._id);
      if (cKey.localeCompare(sinceKey) > 0) {
        sendEvents.push({
          type: "send",
          id: `${String(doc._id)}:${cursorIso}`,
          eventId: `${String(doc._id)}:${cursorIso}`,
          cursor: cursorIso,
          cursorKey: cKey,
          classId: sEv.classId,
          docId: sEv.docId,
          senderName: sEv.senderName,
          senderCompany: sEv.senderCompany,
          timeText: formatTimeBKK(sEv.signedAt),
        });
      }
    }
  }

  // เก่า -> ใหม่
  receiptEvents.sort((a, b) => a.cursorKey.localeCompare(b.cursorKey));
  sendEvents.sort((a, b) => a.cursorKey.localeCompare(b.cursorKey));

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
      const cursor = await getPrimeCursorKey();
      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // ✅ ถ้า client ไม่ prime มา (กันหลุด)
    const parsed = parseCursorToken(since);
    if (!parsed) {
      const cursor = await getPrimeCursorKey();
      return NextResponse.json(
        { ok: true, cursor, items: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const { sinceTs, sinceKey } = parsed;

    // overlap 2s ใช้เพื่อ query เท่านั้น (กันพลาด event ที่ timestamp ชนกัน)
    const querySince = new Date(sinceTs.getTime() - 2000);

    const [checkins, foodEdits, docPack] = await Promise.all([
      buildCheckins(querySince, sinceKey, 20),
      buildFoodEdits(querySince, sinceKey, 20),
      buildReceiptAndSendEvents(querySince, sinceKey, 60),
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
        cursorKey: e.cursorKey,
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
        cursorKey: e.cursorKey,
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
        cursorKey: e.cursorKey,
        message: `คุณ ${e.senderName}${company} ได้นำส่งเอกสาร${ref} เรียบร้อย เวลา ${e.timeText} จาก class ${classTitle}`,
      };
    });

    const items = [...checkins, ...receiptItems, ...sendItems, ...foodItems]
      .filter(Boolean)
      .sort((a, b) => String(a.cursorKey).localeCompare(String(b.cursorKey)));

    const newCursor = items.length
      ? items[items.length - 1].cursorKey
      : sinceKey;

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
