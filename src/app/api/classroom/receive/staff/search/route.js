import dbConnect from "@/lib/mongoose";
import ClassModel from "@/models/Class";
import Student from "@/models/Student";
import DocumentReceipt from "@/models/DocumentReceipt";
import Checkin from "@/models/Checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */
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

  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");

  // รองรับ INV-001, INV 001, INV001
  let m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  m = s.match(/^([A-Z]{2,10})([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

function toYMD_BKK(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatYMD_TH(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function getClassDaysYMD(cls) {
  const days = Array.isArray(cls?.days)
    ? cls.days.map((x) => clean(x)).filter(Boolean)
    : [];

  if (days.length) {
    return [...new Set(days)].sort();
  }

  const start = cls?.startDate || cls?.date || null;
  const dayCount =
    Number(cls?.dayCount ?? cls?.totalDays ?? cls?.duration?.dayCount ?? 1) ||
    1;

  if (!start) return [];

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return [];

  const out = [];
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ymd = toYMD_BKK(d);
    if (ymd) out.push(ymd);
  }
  return out;
}

function isClassActiveOnYMD(cls, ymd) {
  const days = getClassDaysYMD(cls);
  return days.includes(ymd);
}

function buildDateTextFromClass(cls) {
  if (clean(cls?.date_range_text)) return clean(cls.date_range_text);

  const days = getClassDaysYMD(cls);
  if (days.length) {
    const a = days[0];
    const b = days[days.length - 1];
    const ta = formatYMD_TH(a);
    const tb = formatYMD_TH(b);
    if (!ta && !tb) return "";
    return a === b ? ta : `${ta} - ${tb}`;
  }

  const start = cls?.startDate || cls?.date || null;
  if (start) {
    const dc =
      Number(cls?.dayCount ?? cls?.totalDays ?? cls?.duration?.dayCount ?? 1) ||
      1;

    const s = new Date(start);
    const e = new Date(s);
    e.setDate(e.getDate() + (dc - 1));

    const ts = formatDateTH(s);
    const te = formatDateTH(e);
    return ts === te ? ts : `${ts} - ${te}`;
  }

  return "";
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const qRaw = clean(searchParams.get("q"));
  const q = clean(qRaw);
  const qLower = q.toLowerCase();
  const qDoc = normalizeDocId(q);

  const includeSigned = ["1", "true", "yes"].includes(
    clean(searchParams.get("includeSigned")).toLowerCase(),
  );

  const todayYMD = toYMD_BKK(new Date());

  if (!q) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  const reText = new RegExp(escapeRegExp(q), "i");

  let docRe = null;
  const m = qDoc.match(/^([A-Z]{2,10})-([0-9]{1,20})$/);
  if (m) {
    const prefix = m[1];
    const num = m[2];
    docRe = new RegExp(
      `${escapeRegExp(prefix)}[-\\s]*${escapeRegExp(num)}$`,
      "i",
    );
  }

  // 1) หา students จากคำค้น
  const students = await Student.find({
    $or: [
      { name: reText },
      { thaiName: reText },
      { engName: reText },
      { company: reText },
      { paymentRef: reText },
      ...(docRe ? [{ paymentRef: docRe }] : []),
    ],
  })
    .select("_id classId name thaiName engName company paymentRef")
    .limit(160)
    .lean();

  if (!students?.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  const studentIds = students.map((s) => String(s._id));
  const classIds = Array.from(
    new Set(students.map((s) => String(s.classId || "")).filter(Boolean)),
  );

  if (!classIds.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 2) ต้องเคย checkin อย่างน้อย 1 ครั้งใน classId ของตัวเอง
  const checkins = await Checkin.find({
    studentId: { $in: studentIds },
    classId: { $in: classIds },
  })
    .select("_id studentId classId day time")
    .lean();

  const checkMeta = new Map(); // studentId__classId -> { days:Set, lastTime:Date|null }

  for (const c of checkins || []) {
    const sid = String(c.studentId || "");
    const cid = String(c.classId || "");
    if (!sid || !cid) continue;

    const key = `${sid}__${cid}`;
    const prev = checkMeta.get(key) || { days: new Set(), lastTime: null };

    prev.days.add(Number(c.day || 0) || 0);

    const t = c.time ? new Date(c.time) : null;
    if (t && (!prev.lastTime || t.getTime() > prev.lastTime.getTime())) {
      prev.lastTime = t;
    }

    checkMeta.set(key, prev);
  }

  const checkedStudents = (students || []).filter((s) => {
    const sid = String(s._id || "");
    const cid = String(s.classId || "");
    return sid && cid && checkMeta.has(`${sid}__${cid}`);
  });

  if (!checkedStudents.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 3) โหลด class meta เฉพาะที่เกี่ยวข้อง
  const classIdsUsed = Array.from(
    new Set(
      checkedStudents.map((s) => String(s.classId || "")).filter(Boolean),
    ),
  );

  const classes = await ClassModel.find({ _id: { $in: classIdsUsed } })
    .select(
      "_id title courseTitle courseCode classCode room roomName roomInfo date startDate endDate dayCount totalDays duration days date_range_text time_range_text",
    )
    .lean();

  const classMetaById = new Map();

  for (const cls of classes || []) {
    // ✅ แสดงเฉพาะคลาสที่ active วันนี้
    if (!isClassActiveOnYMD(cls, todayYMD)) continue;

    const id = String(cls._id);

    const title =
      cls.courseTitle || cls.courseName || cls.title || cls.classCode || "";
    const courseCode = cls.courseCode || cls.course_code || cls.code || "";
    const classCode = cls.classCode || cls.class_code || cls.title || "";

    const roomName =
      cls.roomName ||
      cls.room ||
      cls.roomInfo?.nameTH ||
      cls.roomInfo?.name ||
      "-";

    const dateText = buildDateTextFromClass(cls) || "";
    const timeText = cls.time_range_text || "";

    classMetaById.set(id, {
      id,
      title,
      courseCode,
      classCode,
      roomName,
      dateText,
      timeText,
    });
  }

  const activeClassIds = Array.from(classMetaById.keys());

  if (!activeClassIds.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 4) preload staff_receive receipts
  const paymentRefSet = new Set();
  for (const s of checkedStudents || []) {
    const pay = clean(s?.paymentRef);
    if (pay) paymentRefSet.add(normalizeDocId(pay));
  }
  const docIds = Array.from(paymentRefSet);

  const staffReceipts = await DocumentReceipt.find({
    classId: { $in: activeClassIds },
    docId: { $in: docIds },
    type: "staff_receive",
  })
    .select("_id classId docId staffReceiveItems staffSig")
    .lean();

  const staffByKey = new Map(); // classId__docId -> receipt
  for (const r of staffReceipts || []) {
    staffByKey.set(`${String(r.classId)}__${String(r.docId)}`, r);
  }

  // 5) build results
  const results = [];

  for (const stu of checkedStudents) {
    const clsId = String(stu.classId || "");
    const meta = classMetaById.get(clsId);

    // ✅ ถ้าไม่ใช่คลาสของวันนี้ จะไม่แสดง
    if (!meta) continue;

    const stuName =
      clean(stu.name) || clean(stu.thaiName) || clean(stu.engName) || "-";
    const company = clean(stu.company);
    const paymentRef = clean(stu.paymentRef);
    const paymentRefNorm = normalizeDocId(paymentRef);

    // ถ้าไม่มี docId จะทำ staff_receive ไม่ได้
    if (!paymentRefNorm) continue;

    const hay = [stuName, company, paymentRef, paymentRefNorm]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();

    const textMatch = hay.includes(qLower);
    const docMatch =
      paymentRefNorm === qDoc || paymentRef.toUpperCase() === qDoc;

    if (!textMatch && !docMatch) continue;

    const receipt = staffByKey.get(`${clsId}__${paymentRefNorm}`);
    const staffSignedAt = receipt?.staffSig?.signedAt || null;

    // ✅ default: ซ่อนรายการที่เจ้าหน้าที่เซ็นแล้ว
    if (!includeSigned && staffSignedAt) continue;

    const key = `${String(stu._id)}__${clsId}`;
    const cm = checkMeta.get(key);
    const checkedDays = Array.from(cm?.days || [])
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    results.push({
      studentId: String(stu._id),
      classId: clsId,

      name: stuName,
      company: company || "",
      docId: paymentRef || "",
      docIdNormalized: paymentRefNorm,

      receiptId: receipt?._id ? String(receipt._id) : "",
      staffSignedAt,
      staffReceiveItems: receipt?.staffReceiveItems || null,
      staffSigUrl: clean(receipt?.staffSig?.url),

      checkedDays,

      classInfo: {
        title: meta.title,
        courseCode: meta.courseCode,
        classCode: meta.classCode,
        roomName: meta.roomName,
        dateText: meta.dateText,
        timeText: meta.timeText,
      },
    });
  }

  results.sort((a, b) => {
    const an = (a.name || "").localeCompare(b.name || "", "th");
    if (an !== 0) return an;
    return (a.docIdNormalized || "").localeCompare(b.docIdNormalized || "");
  });

  return Response.json({
    ok: true,
    today: todayYMD,
    count: results.length,
    items: results,
  });
}
