// src/lib/classroomDashboard.server.js
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";

/**
 * Classroom Dashboard data builder (server-only)
 * - Range: today | week | month
 * - ใช้ timezone ไทย (+07:00) ในการตี "วัน"
 * - Query เก็บเป็น Date (UTC)
 * - เติม program icon โดยอิงจาก internal proxy:
 *   /api/admin/ai/public-course?course_id=...
 * - ส่ง studentGroups เพื่อให้ UI โหมด students/checkins/late/absent แสดงรายชื่อแบบแยกตามคลาสได้
 */

/* ---------------- time helpers (TH timezone) ---------------- */

function nowInOffset(offsetMinutes = 7 * 60) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + offsetMinutes * 60000);
}

function getRangeDatesTH(range) {
  const offsetMinutes = 7 * 60;
  const thNow = nowInOffset(offsetMinutes);

  const startTH = new Date(thNow);
  startTH.setHours(0, 0, 0, 0);

  const endTH = new Date(thNow);
  endTH.setHours(23, 59, 59, 999);

  if (range === "week") {
    startTH.setDate(startTH.getDate() - 6);
  } else if (range === "month") {
    startTH.setDate(1);
  }

  // convert TH boundary -> UTC stored dates
  const startUTC = new Date(startTH.getTime() - offsetMinutes * 60000);
  const endUTC = new Date(endTH.getTime() - offsetMinutes * 60000);
  return { start: startUTC, end: endUTC };
}

/* ---------------- class date helpers ---------------- */

function computeClassRangeUTC(cls) {
  // (เผื่ออนาคตมี startDate/endDate)
  if (cls?.startDate && cls?.endDate) {
    return { start: new Date(cls.startDate), end: new Date(cls.endDate) };
  }

  const baseDate = cls?.date ? new Date(cls.date) : null;
  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    const d = new Date(0);
    return { start: d, end: d };
  }

  const dayCount = Math.max(1, Number(cls?.duration?.dayCount || 1));
  const offsetMinutes = 7 * 60;

  // convert base UTC -> TH (เพื่อปัดเป็นวัน)
  const baseTH = new Date(baseDate.getTime() + offsetMinutes * 60000);

  const startTH = new Date(baseTH);
  startTH.setHours(0, 0, 0, 0);

  const endTH = new Date(startTH);
  endTH.setDate(endTH.getDate() + (dayCount - 1));
  endTH.setHours(23, 59, 59, 999);

  // TH -> UTC
  const startUTC = new Date(startTH.getTime() - offsetMinutes * 60000);
  const endUTC = new Date(endTH.getTime() - offsetMinutes * 60000);
  return { start: startUTC, end: endUTC };
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as <= be && ae >= bs;
}

/* ---------------- internal fetch helpers ---------------- */

function normalizeBase(base) {
  const b = String(base || "").trim();
  if (!b) return "";
  return b.endsWith("/") ? b.slice(0, -1) : b;
}

function getInternalOrigin() {
  // แนะนำให้ตั้งใน .env.local:
  // INTERNAL_ORIGIN=http://localhost:3000
  const o = normalizeBase(process.env.INTERNAL_ORIGIN);
  if (o) return o;

  // fallback สำหรับ dev
  return "http://localhost:3000";
}

async function fetchJsonInternal(pathOrUrl) {
  const origin = getInternalOrigin();
  const url = String(pathOrUrl || "").startsWith("http")
    ? pathOrUrl
    : `${origin}${pathOrUrl}`;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res) return null;

  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  if (!ct.includes("application/json")) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ---------------- program resolution (with cache) ---------------- */

const _courseCache = new Map(); // courseCode -> { programId, programName, programIconUrl }
const _programCache = new Map(); // programObjectId -> { programName, programColor, programIconUrl }

async function getPublicCourseByCourseId(courseId) {
  const key = String(courseId || "").trim();
  if (!key) return null;
  if (_courseCache.has(key)) return _courseCache.get(key);

  // ✅ ให้ยิงผ่าน internal proxy ของเราเท่านั้น (มันใส่ x-api-key ให้แล้ว)
  // tries เผื่อคุณมี route alias อีกตัว
  const tries = [
    `/api/admin/ai/public-course?course_id=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-courses?course_id=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-course?id=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-courses?id=${encodeURIComponent(key)}`,
  ];

  let data = null;
  for (const p of tries) {
    data = await fetchJsonInternal(p);
    if (data?.ok) break;
  }

  const item = data?.item || data?.data || null;

  const out = {
    programId: item?.program?._id ? String(item.program._id) : "",
    programName: String(
      item?.program?.program_name || item?.program?.programName || ""
    ),
    programIconUrl: String(
      item?.program?.programiconurl || item?.program?.programIconUrl || ""
    ),
  };

  _courseCache.set(key, out);
  return out;
}

async function getProgramById(programId) {
  const pid = String(programId || "").trim();
  if (!pid) return null;
  if (_programCache.has(pid)) return _programCache.get(pid);

  // ✅ ใช้ internal proxy: /api/admin/ai/program
  const data = await fetchJsonInternal(
    `/api/admin/ai/program?id=${encodeURIComponent(pid)}`
  );

  const item = data?.item || data?.data || data || null;

  const out = {
    programId: pid,
    programName: String(item?.program_name || item?.programName || ""),
    programColor: String(item?.programcolor || item?.programColor || ""),
    programIconUrl: String(item?.programiconurl || item?.programIconUrl || ""),
  };

  _programCache.set(pid, out);
  return out;
}

/* ---------------- icon helpers ---------------- */

function iconFallbackFromTitle(title, courseCode = "") {
  const t = String(courseCode || title || "").trim();
  const ch = t ? t[0].toUpperCase() : "?";
  return { type: "fallback", value: ch };
}

function iconFromUrl(url, fallbackTitle, fallbackCode) {
  const u = String(url || "").trim();
  if (u) return { type: "url", value: u };
  return iconFallbackFromTitle(fallbackTitle, fallbackCode);
}

/* ---------------- main export ---------------- */

export async function getClassroomDashboardData(range = "today") {
  const safeRange = ["today", "week", "month"].includes(range)
    ? range
    : "today";

  await dbConnect();

  const { start, end } = getRangeDatesTH(safeRange);

  // 1) load all classes แล้วค่อย filter overlap
  const allClasses = await Class.find({}).lean();

  const classes = allClasses.filter((c) => {
    const r = computeClassRangeUTC(c);
    return isOverlap(r.start, r.end, start, end);
  });

  const classIds = classes.map((c) => c._id);

  // 2) students ในคลาสเหล่านี้
  const students =
    classIds.length > 0
      ? await Student.find({ classId: { $in: classIds } }).lean()
      : [];

  // 3) checkins ในช่วงเวลา (ตาม range)
  // NOTE: ใช้ time ตาม schema ของ Checkin (ที่คุณใช้ใน dashboard route)
  const checkins = await Checkin.find({ time: { $gte: start, $lt: end } })
    .populate("studentId", "thaiName engName company organization")
    .populate("classId", "title courseCode room")
    .lean();

  // 4) totals
  const totalClasses = classes.length;
  const totalStudents = students.length;
  const totalCheckins = checkins.length;
  const lateCount = checkins.filter((c) => c.isLate).length;

  // absent: นับจากนักเรียนทั้งหมด - นักเรียนที่มี checkin อย่างน้อย 1 ครั้งในช่วง
  const checkedStudentIds = new Set(
    checkins
      .map((c) => String(c.studentId?._id || c.studentId || ""))
      .filter(Boolean)
  );
  const absentCount = Math.max(0, totalStudents - checkedStudentIds.size);

  // 5) per-class counts
  const studentCountByClass = new Map();
  for (const s of students) {
    const k = String(s.classId || "");
    if (!k) continue;
    studentCountByClass.set(k, (studentCountByClass.get(k) || 0) + 1);
  }

  // checkins per class (unique students หรือจำนวน checkin?)
  // ใช้ "จำนวนเช็คอิน record" ตามของเดิมคุณ (เหมือน totals.totalCheckins)
  const checkinCountByClass = new Map();
  const lateCountByClass = new Map();

  for (const c of checkins) {
    const k = String(c.classId?._id || c.classId || "");
    if (!k) continue;
    checkinCountByClass.set(k, (checkinCountByClass.get(k) || 0) + 1);
    if (c.isLate) lateCountByClass.set(k, (lateCountByClass.get(k) || 0) + 1);
  }

  // 6) map latest checkin by studentId (ภายในช่วง range)
  const latestCheckinByStudent = new Map(); // studentId -> { time,isLate }
  const sortedDesc = checkins
    .slice()
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  for (const c of sortedDesc) {
    const sid = String(c.studentId?._id || c.studentId || "");
    if (!sid) continue;
    if (!latestCheckinByStudent.has(sid)) {
      latestCheckinByStudent.set(sid, {
        time: c.time ? new Date(c.time).toISOString() : "",
        isLate: !!c.isLate,
        classId: String(c.classId?._id || c.classId || ""),
      });
    }
  }

  // 7) build classCards + เติม program/icon (มาจาก AI proxy)
  const classCards = [];
  const debugCourseErrors = {}; // courseCode -> { error, preview }

  for (const cls of classes) {
    const id = String(cls._id);
    const r = computeClassRangeUTC(cls);

    let programId = "";
    let programName = "";
    let programColor = "";
    let programIconUrl = "";

    // default fallback icon
    let icon = iconFallbackFromTitle(cls.title, cls.courseCode);

    const courseId = String(cls.courseCode || "").trim();
    if (courseId) {
      const pc = await getPublicCourseByCourseId(courseId);

      if (pc) {
        programId = pc.programId || "";
        programName = pc.programName || "";
        programIconUrl = pc.programIconUrl || "";

        // ถ้าได้ icon จาก public-course แล้ว ใช้ได้เลย (ชัวร์สุด)
        if (programIconUrl) {
          icon = iconFromUrl(programIconUrl, cls.title, cls.courseCode);
        } else if (programName) {
          icon = iconFallbackFromTitle(programName, cls.courseCode);
        }

        // ถ้าอยากได้ color/ข้อมูลเพิ่มค่อย query program ต่อ
        if (programId) {
          const p = await getProgramById(programId);
          if (p) {
            programName = programName || p.programName || "";
            programColor = p.programColor || "";
            programIconUrl = programIconUrl || p.programIconUrl || "";

            // icon เอา url ก่อนเสมอ
            icon = iconFromUrl(programIconUrl, cls.title, cls.courseCode);
          }
        }
      } else {
        debugCourseErrors[courseId] = {
          error: "public-course returned null",
        };
      }
    }

    classCards.push({
      id,
      title: String(cls.title || ""),
      courseCode: String(cls.courseCode || ""),
      courseName: String(cls.courseName || ""),
      room: String(cls.room || ""),
      dateStart: r.start.toISOString(),
      dateEnd: r.end.toISOString(),

      programId,
      programName,
      programColor,
      programIconUrl,
      icon,

      students: studentCountByClass.get(id) || 0,
      checkins: checkinCountByClass.get(id) || 0,
      late: lateCountByClass.get(id) || 0,
    });
  }

  classCards.sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart));

  // 8) build studentGroups (แยกตาม class)
  const studentsByClass = new Map(); // classId -> Student[]
  for (const s of students) {
    const k = String(s.classId || "");
    if (!k) continue;
    if (!studentsByClass.has(k)) studentsByClass.set(k, []);
    studentsByClass.get(k).push(s);
  }

  const cardById = new Map();
  for (const c of classCards) cardById.set(String(c.id), c);

  const studentGroups = [];
  for (const cls of classes) {
    const cid = String(cls._id);
    const card = cardById.get(cid);

    const list = (studentsByClass.get(cid) || []).map((s) => {
      const sid = String(s._id);
      const chk = latestCheckinByStudent.get(sid) || null;

      const name = String(s.thaiName || s.engName || "ไม่พบชื่อผู้เรียน");
      const company = String(s.company || s.organization || "");

      return {
        id: sid,
        name,
        company,
        checkinTime: chk?.time || "",
        isLate: !!chk?.isLate,
        isAbsent: !chk?.time,
      };
    });

    // sort: คนเช็คอินก่อนขึ้นก่อน / ไม่เช็คอินไว้ท้าย
    list.sort((a, b) => {
      const at = a.checkinTime
        ? new Date(a.checkinTime).getTime()
        : Number.POSITIVE_INFINITY;
      const bt = b.checkinTime
        ? new Date(b.checkinTime).getTime()
        : Number.POSITIVE_INFINITY;
      return at - bt;
    });

    studentGroups.push({
      classId: cid,
      title: String(cls.title || ""),
      courseCode: String(cls.courseCode || ""),
      room: String(cls.room || ""),
      programName: String(card?.programName || ""),
      programIconUrl: String(card?.programIconUrl || ""),
      icon: card?.icon || iconFallbackFromTitle(cls.title, cls.courseCode),
      stats: {
        students: list.length,
        checkins: list.filter((x) => !!x.checkinTime).length,
        late: list.filter((x) => !!x.checkinTime && x.isLate).length,
        absent: list.filter((x) => !x.checkinTime).length,
      },
      items: list,
    });
  }

  // 9) fastest3
  const fastest3 = checkins
    .slice()
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .slice(0, 3)
    .map((c) => {
      const name =
        c.studentId?.thaiName || c.studentId?.engName || "ไม่พบชื่อผู้เรียน";
      const classLabel = c.classId
        ? `${c.classId.courseCode || "-"} – ${c.classId.title || "-"}`
        : "-";
      return {
        id: String(c.studentId?._id || c._id),
        name,
        time: new Date(c.time).toISOString(),
        classLabel,
      };
    });

  // 10) latest10
  const latest10 = checkins
    .slice()
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 10)
    .map((c) => {
      const name =
        c.studentId?.thaiName || c.studentId?.engName || "ไม่พบชื่อผู้เรียน";
      const classLabel = c.classId
        ? `${c.classId.courseCode || "-"} – ${c.classId.title || "-"}`
        : "-";
      return {
        id: String(c.studentId?._id || c._id),
        name,
        time: new Date(c.time).toISOString(),
        isLate: !!c.isLate,
        classLabel,
      };
    });

  return {
    ok: true,
    range: safeRange,
    start: start.toISOString(),
    // ให้ end เป็น inclusive ในฝั่ง UI
    end: new Date(end.getTime() - 1).toISOString(),
    totals: {
      totalClasses,
      totalStudents,
      totalCheckins,
      lateCount,
      absentCount,
    },

    classCards,
    studentGroups,
    fastest3,
    latest10,

    debugAi: {
      hasBase: !!String(process.env.AI_API_BASE || "").trim(),
      hasKey: !!String(process.env.AI_API_KEY || "").trim(),
      basePreview: process.env.AI_API_BASE
        ? String(process.env.AI_API_BASE).slice(0, 80)
        : "",
      internalOrigin: getInternalOrigin(),
    },
    debugCourseErrors,
  };
}
