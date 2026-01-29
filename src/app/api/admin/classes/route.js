// src/app/api/admin/classes/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";
import DocumentReceipt from "@/models/DocumentReceipt";

export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function clean(s) {
  return String(s ?? "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseRunFromTitle(title) {
  const s = String(title || "").trim();
  const parts = s.split("-");
  const last = parts[parts.length - 1];
  const n = Number(last);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeCourseCode(code) {
  return String(code || "CLASS")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

// ใช้สำหรับ title pattern ใหม่: DD-MM-YY(พ.ศ.)
function toDDMMYY_BE(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "00-00-00";
  const beYear = d.getFullYear() + 543;
  const yy = String(beYear).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yy}`;
}

// map type -> CR / H
function typePrefixFromBody(body) {
  const raw = String(
    body?.trainingType ||
      body?.classType ||
      body?.type ||
      body?.mode ||
      body?.format ||
      "",
  )
    .trim()
    .toLowerCase();

  if (raw.includes("hybrid") || raw === "h") return "H";
  if (raw.includes("classroom") || raw.includes("on-site") || raw === "cr")
    return "CR";

  return "CR";
}

// channel -> PUB (default)
function channelPrefixFromBody(body) {
  const raw = String(body?.channel || body?.channelCode || body?.audience || "")
    .trim()
    .toUpperCase();
  return raw || "PUB";
}

// CR-PUB-MSE-L6-23-02-69
function buildTitlePrefixFromBody({ body, startDate }) {
  const type = typePrefixFromBody(body);
  const channel = channelPrefixFromBody(body);
  const code = normalizeCourseCode(body?.courseCode || "");
  const dt = toDDMMYY_BE(startDate);
  return `${type}-${channel}-${code}-${dt}`;
}

async function getMaxRunByPrefix(titlePrefix) {
  const re = new RegExp(`^${escapeRegExp(titlePrefix)}-`);
  const rows = await Class.find({ title: re }, { title: 1 }).lean().limit(500);

  let max = 0;
  for (const r of rows) {
    const run = parseRunFromTitle(r?.title);
    if (run && run > max) max = run;
  }
  return max;
}

function dayRangeFromYMD(ymd) {
  // ymd = "YYYY-MM-DD"
  const start = new Date(ymd + "T00:00:00");
  const end = new Date(ymd + "T23:59:59.999");
  return { start, end };
}

// normalize docId ให้ match กันระหว่าง INV-001 / INV 001 / inv-001
function normalizeDocId(x) {
  let s = String(x || "")
    .trim()
    .toUpperCase();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return s;
}

function pickStudentName(stu) {
  return (
    clean(stu?.name) ||
    clean(stu?.thaiName) ||
    clean(stu?.engName) ||
    clean(stu?.nameTH) ||
    clean(stu?.nameEN) ||
    ""
  );
}

/* ---------- days helpers (เลือกวันเอง) ---------- */

function isYMD(x) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(x || "").trim());
}

function uniqSortYMD(list) {
  const m = new Map();
  for (const v of Array.isArray(list) ? list : []) {
    const s = String(v || "").trim();
    if (!isYMD(s)) continue;
    m.set(s, true);
  }
  return Array.from(m.keys()).sort(); // YMD sort ได้ด้วย string
}

function ymdToUTCDate(ymd) {
  // ymd "YYYY-MM-DD" -> Date (UTC)
  const [y, m, d] = String(ymd)
    .split("-")
    .map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function utcDateToYMD(dt) {
  if (!dt || Number.isNaN(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildContiguousDaysFromStart(ymdStart, dayCount) {
  const base = ymdToUTCDate(ymdStart);
  if (!base) return [];
  const n = Number(dayCount) || 1;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const dt = new Date(base.getTime() + i * 86400000);
    out.push(utcDateToYMD(dt));
  }
  return out;
}

/* ---------------- GET ---------------- */

export async function GET(req) {
  await dbConnect();
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id");
  const date = searchParams.get("date"); // YYYY-MM-DD (local)
  const titlePrefix = searchParams.get("titlePrefix"); // CR-PUB-MSE-L6-23-02-69 (optional)

  // ----------------------------- //
  // กรณีขอรายละเอียด Class เดียว
  // ----------------------------- //
  if (id) {
    const cls = await Class.findById(id).lean();
    if (!cls) {
      return NextResponse.json(
        { ok: false, error: "Class not found" },
        { status: 404 },
      );
    }

    // ✅ จำนวนวันอบรม: days.length > duration.dayCount > dayCount > 1
    const dayCount =
      (Array.isArray(cls.days) && cls.days.length) ||
      cls.duration?.dayCount ||
      cls.dayCount ||
      1;

    // ดึงรายชื่อนักเรียน
    const students = await Student.find({ classId: id }).lean();

    // ดึงเช็คอินทั้งหมด
    const checkins = await Checkin.find({ classId: id }).lean();

    // 1) map checkins: studentId -> { [dayNumber]: { isLate, time, signatureUrl } }
    const checkinMap = new Map();
    for (const ch of checkins) {
      const sid = String(ch.studentId);
      const dayNum = Number(ch.day) || 1;
      if (!checkinMap.has(sid)) checkinMap.set(sid, {});
      checkinMap.get(sid)[dayNum] = {
        isLate: !!ch.isLate,
        time: ch.time || ch.createdAt || null,
        signatureUrl: clean(ch.signatureUrl) || "",
      };
    }

    // 2) map receive signatures from DocumentReceipt
    const receiptDocs = await DocumentReceipt.find({ classId: id })
      .select("_id classId docId receivers type")
      .lean();

    const receiveSigByDocId = new Map();
    const receiveSigByReceiverId = new Map();

    for (const r of receiptDocs || []) {
      const docNorm = normalizeDocId(r?.docId);
      const receivers = Array.isArray(r?.receivers) ? r.receivers : [];
      for (const rec of receivers) {
        const rid = clean(rec?.receiverId);
        const sig = rec?.receiptSig || null;
        const url = clean(sig?.url);
        const signedAt = sig?.signedAt || null;

        if (rid && url && !receiveSigByReceiverId.has(rid)) {
          receiveSigByReceiverId.set(rid, { url, signedAt });
        }
        if (docNorm && url && !receiveSigByDocId.has(docNorm)) {
          receiveSigByDocId.set(docNorm, { url, signedAt });
        }
      }
    }

    const mergedStudents = students.map((stu) => {
      const sid = String(stu._id);
      const byDay = checkinMap.get(sid) || {};

      const checkinsByDay = {};
      const checkinFlags = {};
      const checkinTimes = {};

      let lastDay = null;
      let lastIsLate = false;

      for (let d = 1; d <= dayCount; d += 1) {
        const info = byDay[d];
        if (info) {
          const sigUrl = info.signatureUrl || clean(stu?.signatureUrl) || "";

          checkinsByDay[d] = {
            ...info,
            signatureUrl: sigUrl || null,
          };

          checkinFlags[`day${d}`] = true;
          checkinTimes[`day${d}`] = info.time || null;

          lastDay = d;
          lastIsLate = !!info.isLate;
        } else {
          checkinFlags[`day${d}`] = false;
          checkinTimes[`day${d}`] = null;
        }
      }

      let statusLabel = "-";
      if (lastDay != null) {
        statusLabel = lastIsLate
          ? `Late (Day ${lastDay})`
          : `Pass (Day ${lastDay})`;
      }

      const paymentRef = clean(stu?.paymentRef);
      const docNorm = normalizeDocId(paymentRef);

      const sigByRid = receiveSigByReceiverId.get(sid) || null;
      const sigByDoc = receiveSigByDocId.get(docNorm) || null;

      const receiveSig = sigByRid || sigByDoc || null;

      const receiveSigUrl = clean(receiveSig?.url);
      const receiveSigSignedAt = receiveSig?.signedAt || null;

      return {
        _id: stu._id,

        // name fields
        name: clean(stu?.name) || "",
        thaiName: clean(stu?.thaiName) || "",
        engName: clean(stu?.engName) || "",
        nameTH:
          clean(stu?.thaiName || stu?.nameTH || pickStudentName(stu)) || "",
        nameEN: clean(stu?.engName || stu?.nameEN || "") || "",

        company: stu.company || "",
        paymentRef: paymentRef || "",

        // receive fields (compat)
        receiveType: stu.documentReceiveType || stu.receiveType || "",
        receiveDate: stu.documentReceivedAt || stu.receiveDate || null,

        // receive signature fields
        documentReceiptSigUrl: receiveSigUrl || "",
        documentReceiptSignedAt: receiveSigSignedAt || null,
        documentReceiptSig: receiveSigUrl
          ? { url: receiveSigUrl, signedAt: receiveSigSignedAt }
          : null,

        checkin: checkinFlags,
        checkinTimes,
        late: lastIsLate,
        statusLabel,
        checkins: checkinsByDay,
      };
    });

    return NextResponse.json({
      ok: true,
      item: {
        ...cls,
        dayCount,
        students: mergedStudents,
      },
    });
  }

  // ----------------------------- //
  // list class ทั้งหมด
  // ----------------------------- //

  const find = {};

  if (date) {
    const { start, end } = dayRangeFromYMD(date);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      find.date = { $gte: start, $lte: end };
    }
  }

  if (titlePrefix) {
    const re = new RegExp(`^${escapeRegExp(titlePrefix)}-`);
    find.title = re;
  }

  const classes = await Class.find(find).sort({ date: -1 }).lean();
  const classIds = classes.map((c) => c._id);

  const counts = await Student.aggregate([
    { $match: { classId: { $in: classIds } } },
    { $group: { _id: "$classId", count: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const items = classes.map((c) => ({
    ...c,
    studentsCount: countMap.get(String(c._id)) || 0,
    // ช่วยให้ list แสดงจำนวนวันได้ถูก (ถ้าใช้)
    dayCount:
      (Array.isArray(c.days) && c.days.length) ||
      c.duration?.dayCount ||
      c.dayCount ||
      1,
  }));

  return NextResponse.json({ ok: true, items });
}

/* ---------------- POST ---------------- */

export async function POST(req) {
  await dbConnect();

  const body = await req.json();

  const {
    publicCourseId,
    courseCode,
    courseName,
    title, // manual override (ใช้เฉพาะ manual)
    date, // "YYYY-MM-DD" (compat)
    days, // ✅ ["YYYY-MM-DD", ...] (เลือกวันเอง)
    dayCount, // compat
    startTime,
    endTime,
    room,
    instructors,
    source, // "api" | "manual" | "sync"
    externalScheduleId,
    trainingType, // "classroom" | "hybrid" (optional)
    channel, // "PUB" (optional)
  } = body || {};

  if (!courseCode || !courseName) {
    return NextResponse.json(
      { ok: false, error: "missing courseCode / courseName" },
      { status: 400 },
    );
  }

  // ✅ ถ้ามี days[] ให้ใช้ days เป็น source of truth
  const daysSorted = uniqSortYMD(days);

  // startDateYMD = วันแรก
  const startDateYMD = daysSorted[0] || clean(date);

  if (!startDateYMD || !isYMD(startDateYMD)) {
    return NextResponse.json(
      { ok: false, error: "missing/invalid date (YYYY-MM-DD) or days[]" },
      { status: 400 },
    );
  }

  const startDateUTC = ymdToUTCDate(startDateYMD);
  if (!startDateUTC) {
    return NextResponse.json(
      { ok: false, error: "invalid date" },
      { status: 400 },
    );
  }

  // dayCount = จำนวนวันจาก days[] (ถ้ามี) ไม่งั้นใช้ body.dayCount
  const dayCnt = daysSorted.length ? daysSorted.length : Number(dayCount) || 1;

  // ✅ days ที่จะเก็บ: ถ้ามี days[] ใช้เลย ไม่งั้น generate แบบ contiguous
  const daysToStore = daysSorted.length
    ? daysSorted
    : buildContiguousDaysFromStart(startDateYMD, dayCnt);

  const instructorList = (instructors || []).map((ins) => {
    if (typeof ins === "string") return { name: ins, email: "" };
    return { name: ins.name || ins.fullname || "", email: ins.email || "" };
  });

  const src = source === "api" || source === "sync" ? source : "manual";

  // ✅ กรณีมาจาก schedule (api/sync หรือมี externalScheduleId) -> auto title เสมอ
  const shouldAutoTitle = src !== "manual" || !!externalScheduleId;

  let finalTitle = (title || "").trim();

  if (shouldAutoTitle) {
    const prefix = buildTitlePrefixFromBody({ body, startDate: startDateUTC });
    let run = (await getMaxRunByPrefix(prefix)) + 1;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      finalTitle = `${prefix}-${run}`;
      try {
        const doc = await Class.create({
          source: src,
          publicCourseId: publicCourseId || null,
          courseCode,
          courseName,
          title: finalTitle,

          // compat: date = วันแรก
          date: startDateUTC,

          // ✅ เก็บ days + dayCount
          days: daysToStore,
          dayCount: dayCnt,

          duration: {
            dayCount: dayCnt,
            startTime: startTime || "09:00",
            endTime: endTime || "16:00",
          },
          room: room || "",
          instructors: instructorList,
          externalScheduleId: externalScheduleId
            ? String(externalScheduleId)
            : "",
          trainingType: trainingType || "",
          channel: channel || "",
        });

        return NextResponse.json({ ok: true, item: doc });
      } catch (err) {
        const msg = String(err?.message || "");
        const code = err?.code;
        if (code === 11000 || msg.toLowerCase().includes("duplicate")) {
          run += 1;
          continue;
        }
        console.error(err);
        return NextResponse.json(
          { ok: false, error: "create class failed" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { ok: false, error: "cannot allocate unique run number" },
      { status: 409 },
    );
  }

  // manual: ใช้ title ที่ user ส่งมา หรือ fallback เป็น courseName
  finalTitle = finalTitle || courseName;

  const doc = await Class.create({
    source: src,
    publicCourseId: publicCourseId || null,
    courseCode,
    courseName,
    title: finalTitle,

    // compat: date = วันแรก
    date: startDateUTC,

    // ✅ เก็บ days + dayCount
    days: daysToStore,
    dayCount: dayCnt,

    duration: {
      dayCount: dayCnt,
      startTime: startTime || "09:00",
      endTime: endTime || "16:00",
    },
    room: room || "",
    instructors: instructorList,
    externalScheduleId: externalScheduleId ? String(externalScheduleId) : "",
    trainingType: trainingType || "",
    channel: channel || "",
  });

  return NextResponse.json({ ok: true, item: doc });
}
