// src/app/api/classroom/receive/customer/search/route.js
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

  // ✅ NEW: normalize "INV001" -> "INV-001"
  m = s.match(/^([A-Z]{2,10})([0-9]{1,20})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return s;
}

function bangkokNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
}

function toYMD_BKK(d) {
  const x = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

function isSameYMD(a, b) {
  return toYMD_BKK(a) === toYMD_BKK(b);
}

function includesTodayByDaysArray(cls, todayYMD) {
  const days = Array.isArray(cls?.days) ? cls.days : [];
  return days.includes(todayYMD);
}

function computeDayIndexForToday(cls, today) {
  const todayYMD = toYMD_BKK(today);

  // 1) days[] เป็น source of truth
  if (Array.isArray(cls?.days) && cls.days.length) {
    const idx = cls.days.indexOf(todayYMD);
    return idx >= 0 ? idx + 1 : null;
  }

  // 2) fallback: startDate + dayCount
  const start = cls?.startDate || cls?.date || cls?.start || null;
  if (!start) return null;

  const dc =
    Number(cls?.dayCount ?? cls?.totalDays ?? cls?.duration?.dayCount ?? 1) ||
    1;

  const startD = new Date(start);
  for (let i = 0; i < dc; i++) {
    const di = addDays(startD, i);
    if (isSameYMD(di, today)) return i + 1;
  }
  return null;
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

function parseYMDToDateBKK(ymd) {
  // ymd: "YYYY-MM-DD"
  // ทำให้เป็นเที่ยงวันเพื่อลดปัญหา timezone/ข้ามวัน
  const d = new Date(`${ymd}T12:00:00.000+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMonthShortTH(d) {
  return d.toLocaleDateString("th-TH", {
    month: "short",
    timeZone: "Asia/Bangkok",
  });
}

function formatYearTH(d) {
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatDaysRangeTH(days) {
  const list = (Array.isArray(days) ? days : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (!list.length) return "";

  // sort
  const dates = list
    .map(parseYMDToDateBKK)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dates.length) return "";

  // group contiguous (diff 1 day)
  const groups = [];
  let start = dates[0];
  let prev = dates[0];

  function isNextDay(a, b) {
    const aa = new Date(a);
    const bb = new Date(b);
    aa.setHours(0, 0, 0, 0);
    bb.setHours(0, 0, 0, 0);
    const diff = (bb.getTime() - aa.getTime()) / (24 * 3600 * 1000);
    return diff === 1;
  }

  for (let i = 1; i < dates.length; i++) {
    const cur = dates[i];
    if (isNextDay(prev, cur)) {
      prev = cur;
      continue;
    }
    groups.push([start, prev]);
    start = cur;
    prev = cur;
  }
  groups.push([start, prev]);

  // ถ้าทุกกลุ่มอยู่เดือน/ปีเดียวกัน → ทำแบบ "17-18, 20-21 ก.พ. 2569"
  const key0 = `${dates[0].getFullYear()}-${dates[0].getMonth() + 1}`;
  const allSameMonthYear = groups.every(([a, b]) => {
    const ka = `${a.getFullYear()}-${a.getMonth() + 1}`;
    const kb = `${b.getFullYear()}-${b.getMonth() + 1}`;
    return ka === key0 && kb === key0;
  });

  if (allSameMonthYear) {
    const parts = groups.map(([a, b]) => {
      const da = a.getDate();
      const db = b.getDate();
      return da === db ? `${da}` : `${da}-${db}`;
    });
    const mon = formatMonthShortTH(dates[0]);
    const yr = formatYearTH(dates[0]);
    return `${parts.join(", ")} ${mon} ${yr}`.trim();
  }

  // ไม่งั้นแยกกลุ่มเป็นช่วงเต็ม
  const full = groups.map(([a, b]) => {
    const da = a.getDate();
    const db = b.getDate();
    const sameMY =
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

    if (da === db) {
      return `${da} ${formatMonthShortTH(a)} ${formatYearTH(a)}`.trim();
    }
    if (sameMY) {
      return `${da}-${db} ${formatMonthShortTH(a)} ${formatYearTH(a)}`.trim();
    }
    return `${da} ${formatMonthShortTH(a)} ${formatYearTH(a)} - ${db} ${formatMonthShortTH(b)} ${formatYearTH(b)}`.trim();
  });

  return full.join(", ");
}

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const qRaw = clean(searchParams.get("q"));
  const q = clean(qRaw);
  const qLower = q.toLowerCase();
  const qDoc = normalizeDocId(q);

  const today = bangkokNow();
  const todayYMD = toYMD_BKK(today);

  // ✅ ไม่ค้นหา = ไม่โชว์รายการเลย
  if (!q) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 1) หา class ที่ “มีเรียนวันนี้”
  const maybeClasses = await ClassModel.find({})
    .select(
      "_id title courseTitle courseCode classCode room roomName roomInfo date startDate endDate dayCount totalDays duration days date_range_text time_range_text",
    )
    .lean();

  const todaysClasses = (maybeClasses || []).filter((cls) => {
    if (includesTodayByDaysArray(cls, todayYMD)) return true;
    const di = computeDayIndexForToday(cls, today);
    return !!di;
  });

  const classMetaById = new Map();
  const classIds = todaysClasses.map((c) => String(c._id));

  for (const cls of todaysClasses) {
    const id = String(cls._id);
    const dayIndex = computeDayIndexForToday(cls, today);

    const title = cls.courseTitle || cls.title || "";
    const courseCode = cls.courseCode || cls.course_code || cls.code || "";
    const classCode = cls.classCode || cls.class_code || "";

    const roomName =
      cls.roomName ||
      cls.room ||
      cls.roomInfo?.nameTH ||
      cls.roomInfo?.name ||
      "-";

    const dateText =
      cls.date_range_text ||
      (Array.isArray(cls?.days) && cls.days.length
        ? formatDaysRangeTH(cls.days)
        : "") ||
      (cls.startDate
        ? formatDateTH(cls.startDate)
        : cls.date
          ? formatDateTH(cls.date)
          : "") ||
      "";

    const timeText = cls.time_range_text || "";

    classMetaById.set(id, {
      id,
      dayIndex,
      title,
      courseCode,
      classCode,
      roomName,
      dateText,
      timeText,
    });
  }

  if (!classIds.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 2) ✅ NEW RULE:
  //    ดึง checkins ของ class ที่มีเรียนวันนี้
  //    แต่ “ยอมรับเช็คอินวันไหนก็ได้” ภายในคลาส (day <= วันนี้ของคลาส)
  const checkins = await Checkin.find({ classId: { $in: classIds } })
    .select("_id studentId classId day time isLate signatureUrl")
    .lean();

  const latestCheckinByPair = new Map(); // key = classId__studentId

  for (const ci of checkins || []) {
    const clsId = String(ci.classId || "");
    const stuId = String(ci.studentId || "");
    if (!clsId || !stuId) continue;

    const meta = classMetaById.get(clsId);
    if (!meta?.dayIndex) continue;

    const d = Number(ci.day);
    // ✅ ต้องเป็น “เช็คอินภายในวันนี้ของคลาส” (กันข้อมูล day หลุด ๆ)
    if (!Number.isFinite(d) || d <= 0 || d > Number(meta.dayIndex)) continue;

    const key = `${clsId}__${stuId}`;
    const prev = latestCheckinByPair.get(key);

    // เลือกตัวล่าสุด: day มากกว่า หรือ day เท่ากันแล้ว time มากกว่า
    const prevDay = Number(prev?.day || 0);
    const prevTime = String(prev?.time || "");
    const curTime = String(ci.time || "");

    if (!prev || d > prevDay || (d === prevDay && curTime > prevTime)) {
      latestCheckinByPair.set(key, ci);
    }
  }

  const eligiblePairs = Array.from(latestCheckinByPair.values());

  if (!eligiblePairs.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  const studentIds = Array.from(
    new Set(
      eligiblePairs.map((x) => String(x.studentId || "")).filter(Boolean),
    ),
  );

  // 3) ดึง students เฉพาะที่ “เคยเช็คอินในคลาสที่มีเรียนวันนี้”
  const students = await Student.find({ _id: { $in: studentIds } })
    .select(
      "_id classId name thaiName engName company paymentRef documentReceiveType documentReceivedAt documentReceiptSigUrl documentReceiptSignedAt",
    )
    .lean();

  const studentById = new Map();
  for (const s of students || []) studentById.set(String(s._id), s);

  // 4) filter + build results (ก่อน) — ตามชื่อ/บริษัท/เลขเอกสาร
  const draft = [];

  for (const ci of eligiblePairs) {
    const clsId = String(ci.classId || "");
    const meta = classMetaById.get(clsId);
    if (!meta?.dayIndex) continue;

    const stu = studentById.get(String(ci.studentId || ""));
    if (!stu) continue;

    const stuName =
      clean(stu.name) || clean(stu.thaiName) || clean(stu.engName) || "-";
    const company = clean(stu.company);
    const paymentRef = clean(stu.paymentRef);
    const paymentRefNorm = normalizeDocId(paymentRef);

    const hay = [stuName, company, paymentRef, paymentRefNorm]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();

    const textMatch = hay.includes(qLower);
    const docMatch =
      paymentRefNorm === qDoc || paymentRef.toUpperCase() === qDoc;

    if (!textMatch && !docMatch) continue;

    draft.push({
      studentId: String(stu._id),
      classId: clsId,
      dayIndex: meta.dayIndex,

      name: stuName,
      company: company || "",
      docId: paymentRef || "",
      docIdNormalized: paymentRefNorm,

      documentReceiveType: clean(stu.documentReceiveType) || "",
      documentReceivedAt: stu.documentReceivedAt || null,

      signedUrl: clean(stu.documentReceiptSigUrl) || "",
      signedAt: stu.documentReceiptSignedAt || null,
      receiverIndex: 0,

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

  if (!draft.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 5) (แนะนำ) preload DocumentReceipt ให้แม่นขึ้น (รองรับค้นชื่อแล้วกดไปเซ็น)
  const docIdsToLoad = Array.from(
    new Set(draft.map((x) => clean(x.docIdNormalized)).filter(Boolean)),
  );

  function nameKey(s) {
    return clean(s).replace(/\s+/g, " ").toLowerCase();
  }

  const receiptByKey = new Map(); // classId__docId -> receipt
  const receiptIndexByKey = new Map(); // classId__docId -> { byRid, byName, sharedSigUrl, sharedSignedAt }

  if (docIdsToLoad.length) {
    const recs = await DocumentReceipt.find({
      classId: { $in: classIds },
      docId: { $in: docIdsToLoad },
      type: "customer_receive", // ✅ กันไปหยิบ staff_receive มาปน
    })
      .select("_id classId docId receivers updatedAt")
      .lean();

    for (const r of recs || []) {
      const k = `${String(r.classId)}__${String(r.docId)}`;
      receiptByKey.set(k, r);

      const byRid = new Map(); // receiverId -> index
      const byName = new Map(); // normalized name -> index

      const receivers = Array.isArray(r.receivers) ? r.receivers : [];
      let sharedSigUrl = "";
      let sharedSignedAt = null;

      receivers.forEach((rcv, idx) => {
        const rid = clean(rcv?.receiverId);
        const nm = nameKey(rcv?.name);

        if (rid) byRid.set(String(rid), idx);
        if (nm) byName.set(nm, idx);

        const url = clean(rcv?.receiptSig?.url);
        const at = rcv?.receiptSig?.signedAt || null;

        // ✅ หา "ลายเซ็นร่วม" อันแรกของ docId นี้ (ถือว่า INV เดียวกัน เซ็นแทนกันได้)
        if (!sharedSigUrl && url) {
          sharedSigUrl = url;
          sharedSignedAt = at || r.updatedAt || null;
        }
      });

      receiptIndexByKey.set(k, { byRid, byName, sharedSigUrl, sharedSignedAt });
    }
  }

  for (const it of draft) {
    const key = `${it.classId}__${it.docIdNormalized}`;
    const rec = receiptByKey.get(key);
    const meta = receiptIndexByKey.get(key);

    if (!rec || !meta) continue;

    const receivers = Array.isArray(rec.receivers) ? rec.receivers : [];

    // ✅ หา receiverIndex ให้ถูกคน (กันล็อกคนแรก)
    let idx = -1;

    if (meta.byRid?.has(String(it.studentId))) {
      idx = meta.byRid.get(String(it.studentId));
    } else {
      const nk = nameKey(it.name);
      if (nk && meta.byName?.has(nk)) idx = meta.byName.get(nk);
    }

    if (idx >= 0) {
      it.receiverIndex = idx;

      const rcv = receivers[idx] || {};
      const urlFromReceiver = clean(rcv?.receiptSig?.url);
      const atFromReceiver = rcv?.receiptSig?.signedAt || null;

      // ✅ signedUrl/signedAt: ถ้าคนนี้ไม่มี แต่ docId เดียวกันมีลายเซ็น → กระจายให้
      if (!it.signedUrl)
        it.signedUrl = urlFromReceiver || meta.sharedSigUrl || "";
      if (!it.signedAt)
        it.signedAt = atFromReceiver || meta.sharedSignedAt || null;

      // ✅ documentReceivedAt: ให้ "เขียว" ตามลายเซ็นร่วม (ถ้า student ยังไม่มีวันที่รับ)
      if (!it.documentReceivedAt) {
        it.documentReceivedAt = atFromReceiver || meta.sharedSignedAt || null;
      }
    } else {
      // ✅ ถ้าหา index ไม่เจอ ก็ยัง “เขียว” ได้ถ้า docId นี้มีลายเซ็นอยู่แล้ว
      if (!it.signedUrl && meta.sharedSigUrl) it.signedUrl = meta.sharedSigUrl;
      if (!it.signedAt && meta.sharedSignedAt)
        it.signedAt = meta.sharedSignedAt;

      if (!it.documentReceivedAt && meta.sharedSignedAt) {
        it.documentReceivedAt = meta.sharedSignedAt;
      }
    }
  }

  // sort
  draft.sort((a, b) => {
    const an = (a.name || "").localeCompare(b.name || "", "th");
    if (an !== 0) return an;
    return (a.docIdNormalized || "").localeCompare(b.docIdNormalized || "");
  });

  return Response.json({
    ok: true,
    today: todayYMD,
    count: draft.length,
    items: draft,
  });
}
