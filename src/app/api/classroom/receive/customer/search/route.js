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
  const m = s.match(/^([A-Z]{2,10})\s+([0-9]{1,20})$/);
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

export async function GET(req) {
  await dbConnect();

  const { searchParams } = new URL(req.url);
  const qRaw = clean(searchParams.get("q"));
  const q = clean(qRaw);
  const qLower = q.toLowerCase();
  const qDoc = normalizeDocId(q);

  const today = bangkokNow();
  const todayYMD = toYMD_BKK(today);

  // ✅ ไม่ค้นหา = ไม่โชว์รายการเลย (ตามที่ต้องการ)
  if (!q) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  // 1) หา class ที่อยู่ในวันนี้
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
      (cls.startDate ? formatDateTH(cls.startDate) : "") ||
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

  // 2) ดึง checkins ของ class วันนี้ (เป็น source of truth)
  //    แล้ว filter ให้ตรง dayIndex ของ class นั้น ๆ
  const checkins = await Checkin.find({ classId: { $in: classIds } })
    .select("_id studentId classId day time isLate signatureUrl")
    .lean();

  const todaysCheckins = (checkins || []).filter((c) => {
    const clsId = String(c.classId || "");
    const meta = classMetaById.get(clsId);
    if (!meta?.dayIndex) return false;
    return Number(c.day) === Number(meta.dayIndex);
  });

  if (!todaysCheckins.length) {
    return Response.json({ ok: true, today: todayYMD, count: 0, items: [] });
  }

  const studentIds = Array.from(
    new Set(
      todaysCheckins.map((c) => String(c.studentId || "")).filter(Boolean),
    ),
  );

  // 3) ดึง students เฉพาะที่มี checkin วันนี้
  const students = await Student.find({ _id: { $in: studentIds } })
    .select(
      "_id classId name thaiName engName company paymentRef documentReceiveType documentReceivedAt documentReceiptSigUrl documentReceiptSignedAt",
    )
    .lean();

  const studentById = new Map();
  for (const s of students || []) studentById.set(String(s._id), s);

  // 4) (optional) ถ้าผู้ใช้พิมพ์ docId ตรง ๆ → preload DocumentReceipt เพื่อเอา receiverIndex + signedUrl
  const receiptByKey = new Map(); // key = classId__docId
  if (qDoc) {
    const recs = await DocumentReceipt.find({
      classId: { $in: classIds },
      docId: qDoc,
    })
      .select("_id classId docId receivers")
      .lean();

    for (const r of recs || []) {
      receiptByKey.set(`${String(r.classId)}__${String(r.docId)}`, r);
    }
  }

  // 5) filter + build results
  const results = [];

  for (const ci of todaysCheckins) {
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

    // match เฉพาะชื่อ/บริษัท/เลขใบ (normalized)
    const hay = [stuName, company, paymentRef, paymentRefNorm]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();
    const textMatch = hay.includes(qLower);
    const docMatch =
      paymentRefNorm === qDoc || paymentRef.toUpperCase() === qDoc;

    if (!textMatch && !docMatch) continue;

    // signedUrl: ใช้ field ใน Student ก่อน (ถ้ามี)
    let signedUrl = clean(stu.documentReceiptSigUrl);
    let signedAt = stu.documentReceiptSignedAt || null;
    let receiverIndex = 0;

    // ถ้าค้นด้วย docId ตรง ๆ และมี receipt → เอา signedUrl/receiverIndex จาก receipt ให้แม่นขึ้น
    const rec = receiptByKey.get(`${clsId}__${qDoc}`);
    if (rec && Array.isArray(rec.receivers)) {
      const idx = rec.receivers.findIndex((x) => {
        const rid = clean(x?.receiverId);
        const nm = clean(x?.name);
        // เอา receiverId เป็นหลัก ถ้ามี
        if (rid && String(rid) === String(stu._id)) return true;
        // fallback ชื่อ
        return nm && nm === stuName;
      });

      if (idx >= 0) {
        receiverIndex = idx;
        const rcv = rec.receivers[idx] || {};
        const urlFromReceipt = clean(rcv?.receiptSig?.url);
        const atFromReceipt = rcv?.receiptSig?.signedAt || null;

        if (!signedUrl && urlFromReceipt) signedUrl = urlFromReceipt;
        if (!signedAt && atFromReceipt) signedAt = atFromReceipt;
      }
    }

    results.push({
      studentId: String(stu._id),
      classId: clsId,
      dayIndex: meta.dayIndex,

      name: stuName,
      company: company || "",
      docId: paymentRef || "",
      docIdNormalized: paymentRefNorm,

      documentReceiveType: clean(stu.documentReceiveType) || "",
      documentReceivedAt: stu.documentReceivedAt || null,

      signedUrl: signedUrl || "",
      signedAt,
      receiverIndex,

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

  // sort
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
