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

  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*-\s*/g, "-");

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

  // ไม่ค้นหา = ไม่โชว์รายการ
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

  // 2) ดึง checkins ของ class วันนี้ แล้ว filter ให้ตรง dayIndex
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
    .select("_id classId name thaiName engName company paymentRef")
    .lean();

  const studentById = new Map();
  for (const s of students || []) studentById.set(String(s._id), s);

  // 4) preload staff_receive receipts เพื่อโชว์สถานะ + ลายเซ็นเดิม
  const paymentRefSet = new Set();
  for (const s of students || []) {
    const pay = clean(s?.paymentRef);
    if (pay) paymentRefSet.add(normalizeDocId(pay));
  }
  const docIds = Array.from(paymentRefSet);

  const staffReceipts = await DocumentReceipt.find({
    classId: { $in: classIds },
    docId: { $in: docIds },
    type: "staff_receive",
  })
    .select(
      "_id classId docId staffReceiveItems customerSig staffSig updatedAt",
    )
    .lean();

  const staffByKey = new Map(); // classId__docId -> receipt
  for (const r of staffReceipts || []) {
    staffByKey.set(`${String(r.classId)}__${String(r.docId)}`, r);
  }

  // 5) build results (match ชื่อ/บริษัท/เลขใบ)
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

    const hay = [stuName, company, paymentRef, paymentRefNorm]
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();

    const textMatch = hay.includes(qLower);
    const docMatch =
      paymentRefNorm === qDoc || paymentRef.toUpperCase() === qDoc;

    if (!textMatch && !docMatch) continue;

    const receipt = staffByKey.get(`${clsId}__${paymentRefNorm}`);

    const staffSignedAt =
      receipt?.staffSig?.signedAt || receipt?.updatedAt || null;

    const senderSigUrl = clean(receipt?.customerSig?.url);
    const staffSigUrl = clean(receipt?.staffSig?.url);

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

      // ✅ เพิ่ม: ลิงก์ลายเซ็นที่เคยบันทึกแล้ว (เอาไปทำ preview)
      senderSigUrl,
      staffSigUrl,

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
