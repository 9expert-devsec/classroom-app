// src/lib/classroomDashboard.server.js
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Student from "@/models/Student";
import Checkin from "@/models/Checkin";

/**
 * Classroom Dashboard data builder (server-only)
 * include:
 * - cards    => totals + classCards (ไม่มี studentGroups/lists)
 * - students => studentGroups (รองรับ mode filter)
 * - lists    => fastest3 + latest10
 * - program  => เติม program/icon ผ่าน AI proxy (หนัก) — แยกจาก cards เพื่อไม่ให้ initial ช้า
 */

/* ---------------- tiny helpers ---------------- */

function clean(x) {
  return String(x || "").trim();
}

function ymdOf(x) {
  return clean(x).slice(0, 10);
}

/* ---------------- time helpers (TH timezone) ---------------- */

const OFFSET_MIN = 7 * 60;

function nowInOffset(offsetMinutes = OFFSET_MIN) {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + offsetMinutes * 60000);
}

function toYMDLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// สร้างช่วงเวลาแบบ "half-open": [startUTC, endUTCExclusive)
function getRangeDatesTH(range, fromYMD = "", toYMD = "") {
  const thNow = nowInOffset(OFFSET_MIN);

  const startTH = new Date(thNow);
  startTH.setHours(0, 0, 0, 0);

  const endTHExclusive = new Date(startTH);
  endTHExclusive.setDate(endTHExclusive.getDate() + 1); // พรุ่งนี้ 00:00

  if (range === "week") {
    startTH.setDate(startTH.getDate() - 6);
  } else if (range === "month") {
    startTH.setDate(1);
  } else if (range === "custom") {
    // from/to เป็น YYYY-MM-DD (TH)
    if (fromYMD) {
      const f = new Date(fromYMD + "T00:00:00");
      if (!Number.isNaN(f.getTime())) {
        startTH.setTime(f.getTime());
        startTH.setHours(0, 0, 0, 0);
      }
    }
    if (toYMD) {
      const t = new Date(toYMD + "T00:00:00");
      if (!Number.isNaN(t.getTime())) {
        const x = new Date(t);
        x.setHours(0, 0, 0, 0);
        x.setDate(x.getDate() + 1);
        endTHExclusive.setTime(x.getTime());
      }
    }
  }

  // TH boundary -> UTC stored dates
  const startUTC = new Date(startTH.getTime() - OFFSET_MIN * 60000);
  const endUTCExclusive = new Date(
    endTHExclusive.getTime() - OFFSET_MIN * 60000,
  );

  // สำหรับ query by days[] (string) เราใช้ ymd แบบ TH
  const startYMD = toYMDLocal(startTH);
  const endYMD = toYMDLocal(new Date(endTHExclusive.getTime() - 1)); // inclusive day label

  return { startUTC, endUTCExclusive, startYMD, endYMD };
}

/* ---------------- class date helpers ---------------- */

// overlap ของ half-open intervals: [aStart,aEnd) ทับ [bStart,bEnd) ?
function isOverlapOpen(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}

// หมายเหตุ: days[] อาจเป็น "วันอบรมแบบกระโดด" (ไม่ต่อเนื่อง)
// - ฟังก์ชันนี้ใช้เพื่อ "แสดงผล" (dateStart/dateEnd) และ sort
// - ห้ามเอา first->last ไปใช้แทนการ filter ว่าวันนี้มีคลาสหรือไม่
function computeClassRangeUTC(cls) {
  const days = Array.isArray(cls?.days) ? cls.days.filter(Boolean) : [];
  if (days.length > 0) {
    const sorted = days
      .slice()
      .map((s) => String(s).slice(0, 10))
      .sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const startTH = new Date(first + "T00:00:00");
    const endTHExclusive = new Date(last + "T00:00:00");
    endTHExclusive.setDate(endTHExclusive.getDate() + 1);

    const startUTC = new Date(startTH.getTime() - OFFSET_MIN * 60000);
    const endUTCExclusive = new Date(
      endTHExclusive.getTime() - OFFSET_MIN * 60000,
    );
    return { startUTC, endUTCExclusive };
  }

  const baseDate = cls?.date ? new Date(cls.date) : null;
  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    const d = new Date(0);
    return { startUTC: d, endUTCExclusive: d };
  }

  const dayCount = Math.max(
    1,
    Number(cls?.duration?.dayCount || cls?.dayCount || 1) || 1,
  );

  // base UTC -> TH เพื่อปัดเป็นวัน
  const baseTH = new Date(baseDate.getTime() + OFFSET_MIN * 60000);

  const startTH = new Date(baseTH);
  startTH.setHours(0, 0, 0, 0);

  const endTHExclusive = new Date(startTH);
  endTHExclusive.setDate(endTHExclusive.getDate() + dayCount);

  const startUTC = new Date(startTH.getTime() - OFFSET_MIN * 60000);
  const endUTCExclusive = new Date(
    endTHExclusive.getTime() - OFFSET_MIN * 60000,
  );

  return { startUTC, endUTCExclusive };
}

function hasDays(cls) {
  return Array.isArray(cls?.days) && cls.days.filter(Boolean).length > 0;
}

function anyDayInYmdRange(days, startYMD, endYMD) {
  const s = clean(startYMD);
  const e = clean(endYMD);
  if (!s || !e) return false;

  for (const d of days || []) {
    const y = ymdOf(d);
    if (!y) continue;
    if (y >= s && y <= e) return true;
  }
  return false;
}

/* ---------------- internal fetch helpers (AI program) ---------------- */

function normalizeBase(base) {
  const b = String(base || "").trim();
  if (!b) return "";
  return b.endsWith("/") ? b.slice(0, -1) : b;
}

function getInternalOrigin(opts) {
  const byReq = normalizeBase(opts?.origin);
  if (byReq) return byReq;

  const byEnv = normalizeBase(process.env.INTERNAL_ORIGIN);
  if (byEnv) return byEnv;

  return "http://localhost:3000";
}

async function fetchJsonInternal(pathOrUrl, opts = {}) {
  const origin = getInternalOrigin(opts);
  const url = String(pathOrUrl || "").startsWith("http")
    ? pathOrUrl
    : `${origin}${pathOrUrl}`;

  const headers = {};
  if (opts.cookieHeader) headers.cookie = opts.cookieHeader; // ✅ ผ่าน requireAdmin

  const res = await fetch(url, { cache: "no-store", headers }).catch(
    () => null,
  );
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

/* ---------------- caches ---------------- */

const _courseCache = new Map(); // courseCode -> { programId, programName, programIconUrl } | null
const _programCache = new Map(); // programObjectId -> { programName, programColor, programIconUrl } | null

function pickFirstItem(data) {
  if (!data) return null;
  if (data.item) return data.item;

  if (Array.isArray(data.items) && data.items[0]) return data.items[0];
  if (Array.isArray(data.data) && data.data[0]) return data.data[0];

  if (data.data && Array.isArray(data.data.items) && data.data.items[0]) {
    return data.data.items[0];
  }
  return null;
}

async function getPublicCourseByCourseId(courseId, fetchOpts) {
  const key = String(courseId || "").trim();
  if (!key) return null;
  if (_courseCache.has(key)) return _courseCache.get(key);

  const tries = [
    `/api/admin/ai/public-course?course_id=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-courses?course_id=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-courses?courseCode=${encodeURIComponent(key)}`,
    `/api/admin/ai/public-courses?code=${encodeURIComponent(key)}`,
  ];

  let data = null;
  for (const p of tries) {
    data = await fetchJsonInternal(p, fetchOpts);
    if (data?.ok) break;
  }

  const item = pickFirstItem(data);
  if (!item) {
    _courseCache.set(key, null);
    return null;
  }

  const program = item.program || item.Program || null;

  const out = {
    programId: String(
      program?._id || item?.programId || item?.program_id || "",
    ),
    programName: String(
      program?.program_name || program?.programName || item?.programName || "",
    ),
    programIconUrl: String(
      program?.programiconurl ||
        program?.programIconUrl ||
        item?.programIconUrl ||
        "",
    ),
  };

  _courseCache.set(key, out);
  return out;
}

async function getProgramById(programId, cookieHeader, origin) {
  const pid = String(programId || "").trim();
  if (!pid) return null;
  if (_programCache.has(pid)) return _programCache.get(pid);

  const data = await fetchJsonInternal(
    `/api/admin/ai/program?id=${encodeURIComponent(pid)}`,
    { cookieHeader, origin },
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

/* ---------------- include helpers ---------------- */

function normalizeIncludeSet(include) {
  // รองรับ: Set | Array | String ("cards,program") | undefined
  let parts = [];

  if (include instanceof Set) {
    parts = Array.from(include);
  } else if (Array.isArray(include)) {
    parts = include;
  } else {
    const raw = String(include || "").trim();
    parts = raw ? raw.split(",") : [];
  }

  const set = new Set(parts.map((s) => String(s || "").trim()).filter(Boolean));

  // ✅ default ถ้าไม่ส่งมาเลย
  if (!set.size) {
    set.add("cards");
    set.add("lists"); // ✅ ให้มี fastest/latest โดย default
    return set;
  }

  // ✅ ถ้ามี cards แต่ไม่ส่ง lists มา -> เติมให้เอง (กัน dashboard ว่าง)
  if (set.has("cards") && !set.has("lists")) {
    set.add("lists");
  }

  return set;
}

function hasInclude(includeSet, key) {
  return includeSet.has("all") || includeSet.has(key);
}

/* ---------------- classes loader (ลด scope ที่ดึงจาก DB) ---------------- */

async function loadClassesInRange({
  startUTC,
  endUTCExclusive,
  startYMD,
  endYMD,
}) {
  // ถ้ามี days[] จะ query ได้ตรงกว่า
  // ถ้าไม่มี days[] จะ fallback ด้วย date range แบบ "กว้าง" แล้วค่อย filter overlap อีกที
  const probeStart = new Date(startUTC);
  probeStart.setDate(probeStart.getDate() - 45); // กันคลาสหลายวันเริ่มก่อนช่วง (ปรับได้)

  // ✅ FIX: ถ้ามี days[] แล้ว "ห้าม" เอา date มาลากคลาสเข้า range
  const q = {
    $or: [
      // days เป็น string "YYYY-MM-DD"
      { days: { $elemMatch: { $gte: startYMD, $lte: endYMD } } },
      {
        $and: [
          { $or: [{ days: { $exists: false } }, { days: { $size: 0 } }] },
          { date: { $gte: probeStart, $lt: endUTCExclusive } },
        ],
      },
    ],
  };

  const rows = await Class.find(q)
    .select("_id title courseCode courseName room date duration dayCount days")
    .lean();

  // ✅ FIX (กันหลุดชัวร์): ถ้ามี days[] ให้ถือเป็น set ของวันอบรม
  // ไม่ตีความเป็นช่วง first->last สำหรับการ filter ว่าวันนี้มีคลาสหรือไม่
  return rows.filter((c) => {
    if (hasDays(c)) {
      return anyDayInYmdRange(c.days, startYMD, endYMD);
    }
    const r = computeClassRangeUTC(c);
    return isOverlapOpen(
      r.startUTC,
      r.endUTCExclusive,
      startUTC,
      endUTCExclusive,
    );
  });
}

/* ---------------- tiny concurrency pool ---------------- */

async function runPool(items, worker, limit = 6) {
  const q = items.slice();
  const workers = Array.from({ length: Math.max(1, limit) }).map(async () => {
    while (q.length) {
      const it = q.shift();
      // eslint-disable-next-line no-await-in-loop
      await worker(it);
    }
  });
  await Promise.all(workers);
}

/* ---------------- program/meta resolver (cache-first) ---------------- */

function metaFromCaches(courseCode, fallbackTitle = "", fallbackCode = "") {
  const key = String(courseCode || "").trim();
  if (!key) {
    return {
      programId: "",
      programName: "",
      programColor: "",
      programIconUrl: "",
      icon: iconFallbackFromTitle(fallbackTitle, fallbackCode),
    };
  }

  const pc = _courseCache.get(key) || null;
  if (!pc) {
    return {
      programId: "",
      programName: "",
      programColor: "",
      programIconUrl: "",
      icon: iconFallbackFromTitle(fallbackTitle, fallbackCode),
    };
  }

  const programIconUrl = String(pc.programIconUrl || "");
  const programName = String(pc.programName || "");
  const programId = String(pc.programId || "");

  return {
    programId,
    programName,
    programColor: "",
    programIconUrl,
    icon: iconFromUrl(programIconUrl, fallbackTitle, fallbackCode),
  };
}

/* ---------------- main export ---------------- */

export async function getClassroomDashboardData(range = "today", opts = {}) {
  const cookieHeader = String(opts.cookieHeader || "");
  const includeSet = normalizeIncludeSet(opts.include);
  const mode = String(opts.mode || "").trim(); // students|checkins|late|absent
  const origin = opts?.origin;

  const safeRange = ["today", "week", "month", "custom"].includes(range)
    ? range
    : "today";

  await dbConnect();

  const { startUTC, endUTCExclusive, startYMD, endYMD } = getRangeDatesTH(
    safeRange,
    opts.from || "",
    opts.to || "",
  );

  // โหลดเฉพาะคลาสที่เกี่ยวข้องกับช่วง
  const classes = await loadClassesInRange({
    startUTC,
    endUTCExclusive,
    startYMD,
    endYMD,
  });
  const classIds = classes.map((c) => c._id);

  const out = {
    ok: true,
    range: safeRange,
    start: startUTC.toISOString(),
    end: new Date(endUTCExclusive.getTime() - 1).toISOString(), // inclusive สำหรับ UI
  };

  /* ---------------- cards (fast) ---------------- */
  if (hasInclude(includeSet, "cards")) {
    // student counts by class
    const studentAgg =
      classIds.length > 0
        ? await Student.aggregate([
            { $match: { classId: { $in: classIds } } },
            { $group: { _id: "$classId", n: { $sum: 1 } } },
          ])
        : [];

    const studentCountByClass = new Map();
    for (const r of studentAgg)
      studentCountByClass.set(String(r._id), Number(r.n) || 0);

    const totalStudents = studentAgg.reduce(
      (sum, r) => sum + (Number(r.n) || 0),
      0,
    );

    // checkin counts by class + late
    const checkAgg =
      classIds.length > 0
        ? await Checkin.aggregate([
            {
              $match: {
                time: { $gte: startUTC, $lt: endUTCExclusive },
                classId: { $in: classIds },
              },
            },
            {
              $group: {
                _id: "$classId",
                checkins: { $sum: 1 },
                late: { $sum: { $cond: ["$isLate", 1, 0] } },
              },
            },
          ])
        : [];

    const checkinCountByClass = new Map();
    const lateCountByClass = new Map();

    let totalCheckins = 0;
    let lateCount = 0;

    for (const r of checkAgg) {
      const k = String(r._id);
      const c = Number(r.checkins) || 0;
      const l = Number(r.late) || 0;
      checkinCountByClass.set(k, c);
      lateCountByClass.set(k, l);
      totalCheckins += c;
      lateCount += l;
    }

    // distinct students who checked in (เพื่อ absent)
    const checkedStudentIds =
      classIds.length > 0
        ? await Checkin.distinct("studentId", {
            time: { $gte: startUTC, $lt: endUTCExclusive },
            classId: { $in: classIds },
          })
        : [];

    const absentCount = Math.max(
      0,
      totalStudents - (checkedStudentIds?.length || 0),
    );

    // classCards
    const classCards = classes.map((cls) => {
      const id = String(cls._id);
      const r = computeClassRangeUTC(cls);

      return {
        id,
        title: String(cls.title || ""),
        courseCode: String(cls.courseCode || ""),
        courseName: String(cls.courseName || ""),
        room: String(cls.room || ""),

        dateStart: r.startUTC.toISOString(),
        dateEnd: new Date(r.endUTCExclusive.getTime() - 1).toISOString(),

        // program fields (เติมทีหลังถ้า include=program)
        programId: "",
        programName: "",
        programColor: "",
        programIconUrl: "",
        icon: iconFallbackFromTitle(cls.title, cls.courseCode),

        students: studentCountByClass.get(id) || 0,
        checkins: checkinCountByClass.get(id) || 0,
        late: lateCountByClass.get(id) || 0,
      };
    });

    classCards.sort((a, b) => new Date(a.dateStart) - new Date(b.dateStart));

    out.totals = {
      totalClasses: classes.length,
      totalStudents,
      totalCheckins,
      lateCount,
      absentCount,
    };
    out.classCards = classCards;
  }

  /* ---------------- program (slow) ---------------- */
  if (includeSet.has("program")) {
    const debugCourseErrors = {};
    const fetchOpts = { origin, cookieHeader };

    if (Array.isArray(out.classCards) && out.classCards.length) {
      await runPool(
        out.classCards,
        async (card) => {
          const courseId = String(card.courseCode || "").trim();
          if (!courseId) return;

          const pc = await getPublicCourseByCourseId(courseId, fetchOpts);
          if (!pc) {
            debugCourseErrors[courseId] = { error: "public-course not found" };
            return;
          }

          let programId = String(pc.programId || "");
          let programName = String(pc.programName || "");
          let programColor = "";
          let programIconUrl = String(pc.programIconUrl || "");

          if (programId && !programColor) {
            const p = await getProgramById(programId, cookieHeader, origin);
            if (p) {
              programName = programName || String(p.programName || "");
              programColor = String(p.programColor || "");
              programIconUrl = programIconUrl || String(p.programIconUrl || "");
            }
          }

          card.programId = programId;
          card.programName = programName;
          card.programColor = programColor;
          card.programIconUrl = programIconUrl;
          card.icon = iconFromUrl(programIconUrl, card.title, card.courseCode);
        },
        6,
      );
    }

    out.debugCourseErrors = debugCourseErrors;
    out.debugAi = {
      hasBase: !!String(process.env.AI_API_BASE || "").trim(),
      hasKey: !!String(process.env.AI_API_KEY || "").trim(),
      basePreview: process.env.AI_API_BASE
        ? String(process.env.AI_API_BASE).slice(0, 80)
        : "",
      internalOrigin: getInternalOrigin({ origin }),
    };
  }

  /* ---------------- students (heavy) ---------------- */
  if (hasInclude(includeSet, "students")) {
    const students =
      classIds.length > 0
        ? await Student.find({ classId: { $in: classIds } })
            .select("_id classId name thaiName engName company")
            .lean()
        : [];

    const latest =
      classIds.length > 0
        ? await Checkin.aggregate([
            {
              $match: {
                time: { $gte: startUTC, $lt: endUTCExclusive },
                classId: { $in: classIds },
              },
            },
            { $sort: { time: -1 } },
            {
              $group: {
                _id: "$studentId",
                time: { $first: "$time" },
                isLate: { $first: "$isLate" },
                classId: { $first: "$classId" },
              },
            },
          ])
        : [];

    const latestCheckinByStudent = new Map();
    for (const r of latest) {
      latestCheckinByStudent.set(String(r._id), {
        time: r.time ? new Date(r.time).toISOString() : "",
        isLate: !!r.isLate,
        classId: String(r.classId || ""),
      });
    }

    const studentsByClass = new Map();
    for (const s of students) {
      const k = String(s.classId || "");
      if (!k) continue;
      if (!studentsByClass.has(k)) studentsByClass.set(k, []);
      studentsByClass.get(k).push(s);
    }

    const metaByClassId = new Map();

    if (Array.isArray(out.classCards)) {
      for (const c of out.classCards) {
        metaByClassId.set(String(c.id), {
          programId: String(c.programId || ""),
          programName: String(c.programName || ""),
          programColor: String(c.programColor || ""),
          programIconUrl: String(c.programIconUrl || ""),
          icon: c.icon || iconFallbackFromTitle(c.title, c.courseCode),
        });
      }
    }

    for (const cls of classes) {
      const cid = String(cls._id);
      if (metaByClassId.has(cid)) continue;

      const courseCode = String(cls.courseCode || "").trim();
      const m = metaFromCaches(courseCode, cls.title, cls.courseCode);
      metaByClassId.set(cid, m);
    }

    const wantsMode = new Set(["students", "checkins", "late", "absent"]).has(
      mode,
    )
      ? mode
      : "students";

    const studentGroups = [];

    for (const cls of classes) {
      const cid = String(cls._id);
      const meta = metaByClassId.get(cid) || {
        programId: "",
        programName: "",
        programColor: "",
        programIconUrl: "",
        icon: iconFallbackFromTitle(cls.title, cls.courseCode),
      };

      const allItems = (studentsByClass.get(cid) || []).map((s) => {
        const sid = String(s._id);
        const chk = latestCheckinByStudent.get(sid) || null;

        const name =
          clean(s.name) ||
          clean(s.thaiName) ||
          clean(s.engName) ||
          "ไม่พบชื่อผู้เรียน";

        const company = clean(s.company);

        return {
          id: sid,
          name,
          company,
          checkinTime: chk?.time || "",
          isLate: !!chk?.isLate,
        };
      });

      allItems.sort((a, b) => {
        const at = a.checkinTime
          ? new Date(a.checkinTime).getTime()
          : Number.POSITIVE_INFINITY;
        const bt = b.checkinTime
          ? new Date(b.checkinTime).getTime()
          : Number.POSITIVE_INFINITY;
        return at - bt;
      });

      const stats = {
        students: allItems.length,
        checkins: allItems.filter((x) => !!x.checkinTime).length,
        late: allItems.filter((x) => !!x.checkinTime && x.isLate).length,
        absent: allItems.filter((x) => !x.checkinTime).length,
      };

      let items = allItems;
      if (wantsMode === "checkins")
        items = allItems.filter((x) => !!x.checkinTime);
      if (wantsMode === "late")
        items = allItems.filter((x) => !!x.checkinTime && x.isLate);
      if (wantsMode === "absent")
        items = allItems.filter((x) => !x.checkinTime);

      studentGroups.push({
        classId: cid,
        title: String(cls.title || ""),
        courseCode: String(cls.courseCode || ""),
        room: String(cls.room || ""),

        programId: String(meta.programId || ""),
        programName: String(meta.programName || ""),
        programColor: String(meta.programColor || ""),
        programIconUrl: String(meta.programIconUrl || ""),
        icon: meta.icon || iconFallbackFromTitle(cls.title, cls.courseCode),

        totalInClass: allItems.length,
        stats,
        items,
      });
    }

    out.studentGroups = studentGroups;
    out.studentMode = wantsMode;
  }

  /* ---------------- lists (fast-ish) ---------------- */
  if (hasInclude(includeSet, "lists")) {
    const match = {
      time: { $gte: startUTC, $lt: endUTCExclusive },
      ...(classIds.length ? { classId: { $in: classIds } } : {}),
    };

    const fastestDocs = await Checkin.find(match)
      .sort({ time: 1 })
      .limit(3)
      .populate("studentId", "name thaiName engName")
      .populate("classId", "title courseCode")
      .lean();

    const latestDocs = await Checkin.find(match)
      .sort({ time: -1 })
      .limit(10)
      .populate("studentId", "name thaiName engName")
      .populate("classId", "title courseCode")
      .lean();

    out.fastest3 = fastestDocs.map((c) => {
      const name =
        c.studentId?.name ||
        c.studentId?.thaiName ||
        c.studentId?.engName ||
        "ไม่พบชื่อผู้เรียน";

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

    out.latest10 = latestDocs.map((c) => {
      const name =
        c.studentId?.name ||
        c.studentId?.thaiName ||
        c.studentId?.engName ||
        "ไม่พบชื่อผู้เรียน";

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
  }

  return out;
}
