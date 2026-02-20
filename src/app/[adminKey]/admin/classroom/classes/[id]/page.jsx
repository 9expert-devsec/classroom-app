"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentsTable from "./StudentsTable";
import SyncStudentsButton from "./SyncStudentsButton";
import ReportPreviewButton from "./ReportPreviewButton";
import { ChevronDown, ChevronLeft, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ===== helpers ===== */

const BKK_TZ = "Asia/Bangkok";
const EN_LOCALE = "en-GB";

/**
 * ✅ ชุดห้องแบบเดียวกับหน้า "สร้าง Class (manual)"
 */
const ROOM_OPTIONS_BASE = [
  "Jupiter",
  "Mars",
  "Saturn",
  "Venus",
  "Opera",
  "Online",
];

function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BKK_TZ,
  });
}

function formatTimeTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BKK_TZ,
  });
}

/** ให้ ymd (YYYY-MM-DD) แบบยึด Asia/Bangkok */
function ymdFromAnyBKK(value) {
  if (!value) return "";
  const s = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ymdToUTCDate(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function utcDateToYMD(dt) {
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function addDaysYMD(ymd, addDays) {
  const dt = ymdToUTCDate(ymd);
  if (!dt) return "";
  dt.setUTCDate(dt.getUTCDate() + Number(addDays || 0));
  return utcDateToYMD(dt);
}

function diffDaysYMD(a, b) {
  const da = ymdToUTCDate(a);
  const db = ymdToUTCDate(b);
  if (!da || !db) return null;
  const ms = db.getTime() - da.getTime();
  return Math.round(ms / 86400000);
}

function formatDateEN(input) {
  const ymd = ymdFromAnyBKK(input);
  if (!ymd) return "";
  const dt = ymdToUTCDate(ymd);
  if (!dt) return "";
  return dt.toLocaleDateString(EN_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BKK_TZ,
  });
}

function monthShortEN(ymd) {
  const dt = ymdToUTCDate(ymd);
  if (!dt) return "";
  return dt.toLocaleDateString(EN_LOCALE, { month: "short", timeZone: BKK_TZ });
}

function monthYearEN(ymd) {
  const dt = ymdToUTCDate(ymd);
  if (!dt) return "";
  return dt.toLocaleDateString(EN_LOCALE, {
    month: "short",
    year: "numeric",
    timeZone: BKK_TZ,
  });
}

/**
 * สร้างข้อความช่วงวันอบรมจาก list ของวันจริง
 */
function buildTrainingRangeLabel(dayYMDs) {
  const list = (dayYMDs || []).map((x) => ymdFromAnyBKK(x)).filter(Boolean);
  if (!list.length) return "";

  const uniq = Array.from(new Set(list)).sort();

  const segs = [];
  let start = uniq[0];
  let prev = uniq[0];

  for (let i = 1; i < uniq.length; i++) {
    const cur = uniq[i];
    const diff = diffDaysYMD(prev, cur);
    if (diff === 1) {
      prev = cur;
      continue;
    }
    segs.push({ start, end: prev });
    start = cur;
    prev = cur;
  }
  segs.push({ start, end: prev });

  const years = new Set(uniq.map((d) => d.slice(0, 4)));
  const monthYears = new Set(uniq.map((d) => d.slice(0, 7)));
  const sameYear = years.size === 1;
  const sameMonthYear = monthYears.size === 1;

  const fmtDay = (ymd) => String(Number(String(ymd).slice(8, 10)));
  const year = uniq[0].slice(0, 4);

  if (sameMonthYear) {
    const my = monthYearEN(uniq[0]);
    const parts = segs
      .map(({ start, end }) => {
        const a = fmtDay(start);
        const b = fmtDay(end);
        return start === end ? a : `${a} - ${b}`;
      })
      .join(" , ");
    return `${parts} ${my}`;
  }

  if (sameYear) {
    const parts = segs
      .map(({ start, end }) => {
        const aDay = fmtDay(start);
        const bDay = fmtDay(end);
        const aMon = monthShortEN(start);
        const bMon = monthShortEN(end);

        if (start === end) return `${aDay} ${aMon}`;
        if (aMon === bMon) return `${aDay} - ${bDay} ${aMon}`;
        return `${aDay} ${aMon} - ${bDay} ${bMon}`;
      })
      .join(" , ");
    return `${parts} ${year}`;
  }

  const parts = segs
    .map(({ start, end }) => {
      const aMY = start.slice(0, 7);
      const bMY = end.slice(0, 7);
      if (aMY === bMY) {
        const my = monthYearEN(start);
        const a = fmtDay(start);
        const b = fmtDay(end);
        return start === end ? `${a} ${my}` : `${a} - ${b} ${my}`;
      }
      const aStr = formatDateEN(start);
      const bStr = formatDateEN(end);
      return start === end ? aStr : `${aStr} - ${bStr}`;
    })
    .join(" , ");

  return parts;
}

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function pickPositiveInt(...cands) {
  for (const x of cands) {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 1;
}

function hasAnyCheckin(stu) {
  const cd = stu?.checkinDaily;
  if (Array.isArray(cd)) {
    return cd.some((x) => !!x?.checkedIn || !!x?.time);
  }
  if (cd && typeof cd === "object") {
    return Object.values(cd).some((v) => !!v?.checked || !!v?.time);
  }

  const chk = stu?.checkinStatus || stu?.checkin || {};
  if (chk && typeof chk === "object") {
    return Object.values(chk).some((v) => !!v);
  }
  return false;
}

function hasAnyLate(stu) {
  const cd = stu?.checkinDaily;
  if (Array.isArray(cd)) return cd.some((x) => !!x?.isLate);
  if (cd && typeof cd === "object") {
    return Object.values(cd).some((v) => !!v?.isLate);
  }

  const chk = stu?.checkins;
  if (chk && typeof chk === "object") {
    return Object.values(chk).some((v) => !!v?.isLate);
  }

  return !!stu?.isLate || !!stu?.late;
}

function countLateAllDays(students) {
  let n = 0;

  for (const s of students || []) {
    const cd = s?.checkinDaily;

    if (Array.isArray(cd)) {
      for (const v of cd) if (v && v.isLate) n++;
      continue;
    }

    if (cd && typeof cd === "object") {
      for (const v of Object.values(cd)) {
        if (v && typeof v === "object" && v.isLate) n++;
      }
      continue;
    }

    const chk = s?.checkins;
    if (chk && typeof chk === "object") {
      for (const v of Object.values(chk)) {
        if (v && typeof v === "object" && v.isLate) n++;
      }
    }

    if (s?.late) n++;
  }

  return n;
}

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .trim();
}

function getStudentNameAny(stu) {
  return (
    stu?.name ||
    stu?.thaiName ||
    stu?.engName ||
    stu?.nameTH ||
    stu?.nameEN ||
    ""
  );
}

/* ===== date helpers for edit modal ===== */

function uniqueSortedYMDs(list) {
  const arr = (list || []).map((x) => ymdFromAnyBKK(x)).filter(Boolean);
  return Array.from(new Set(arr)).sort();
}

function buildConsecutiveDays(startYMD, dayCount) {
  const base = ymdFromAnyBKK(startYMD);
  const n = pickPositiveInt(dayCount, 1);
  if (!base) return [];
  return Array.from({ length: n }, (_, i) => addDaysYMD(base, i)).filter(
    Boolean,
  );
}

/* ===== Filter options ===== */

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "checked", label: "เช็คอินแล้ว" },
  { key: "not_checked", label: "ยังไม่เช็คอิน" },
  { key: "late", label: "เช็คอินสาย" },
  { key: "cancelled", label: "ยกเลิก" },
  { key: "postponed", label: "ขอเลื่อน" },
];

/* ===== NEW: NOW (BKK) + type + auto attendance + EMS counting ===== */

function getNowBKK() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  const ymd = `${map.year}-${map.month}-${map.day}`;
  const hh = Number(map.hour || 0);
  const mm = Number(map.minute || 0);
  return { ymd, minutes: hh * 60 + mm };
}

function normalizeLearnType(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return v === "live" ? "live" : "classroom";
}

function getLearnTypeRaw(stu) {
  return (
    stu?.learnType ||
    stu?.studyType ||
    stu?.trainingType || // ✅ เพิ่ม (หลายระบบใช้ชื่อนี้ตอน import)
    stu?.channel || // ✅ บางที import ใช้ channel=live
    stu?.type ||
    ""
  );
}

function getLearnType(stu) {
  return normalizeLearnType(getLearnTypeRaw(stu));
}

function getLearnTypeTimeline(stu) {
  const arr =
    stu?.learnTypeTimeline || stu?.typeTimeline || stu?.learnTypeHistory;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => ({
      effectiveDay: Number(x?.effectiveDay ?? x?.day ?? 1) || 1,
      type: normalizeLearnType(x?.type ?? x?.to ?? x?.learnType ?? "classroom"),
    }))
    .filter((x) => x.effectiveDay >= 1)
    .sort((a, b) => a.effectiveDay - b.effectiveDay);
}

function getLearnTypeForDay(stu, day) {
  const base = normalizeLearnType(getLearnTypeRaw(stu));
  const tl = getLearnTypeTimeline(stu);
  let cur = base;
  for (const it of tl) {
    if (Number(it.effectiveDay) <= Number(day)) cur = it.type;
  }
  return cur;
}

function deriveTodayDayIndex(dayDates) {
  const today = ymdFromAnyBKK(new Date());
  const arr = Array.isArray(dayDates) ? dayDates.map(ymdFromAnyBKK) : [];
  const idx = arr.findIndex((x) => x === today);
  return idx >= 0 ? idx + 1 : -1; // -1 = วันนี้ไม่อยู่ในรอบอบรม
}

function isCheckedInDay(stu, day) {
  const d = Number(day);
  if (!d) return false;

  const cd = stu?.checkinDaily;
  if (Array.isArray(cd)) {
    const found = cd.find((x) => Number(x?.day) === d);
    if (found) return !!found.checkedIn || !!found.time;
  }

  const dayKey = `day${d}`;
  const st = stu?.checkinStatus || stu?.checkin || null;
  if (st && typeof st === "object" && st[dayKey]) return true;

  const chk = stu?.checkins;
  if (chk && typeof chk === "object") {
    const byNum = chk[d] || chk[String(d)] || chk[dayKey];
    if (byNum && typeof byNum === "object") {
      return !!byNum.checkedIn || !!byNum.time;
    }
  }

  return false;
}

function hasCheckinDailyEntry(stu, day) {
  const d = Number(day);
  const cd = stu?.checkinDaily;
  if (!Array.isArray(cd)) return false;
  return cd.some((x) => Number(x?.day) === d);
}

function applyAutoAttendance(students, dayDates, nowBkk) {
  const list = Array.isArray(students) ? students : [];
  if (!list.length) return list;

  const todayDay = deriveTodayDayIndex(dayDates);
  if (todayDay <= 0) return list; // วันนี้ไม่อยู่ในวันอบรม -> ไม่ inject

  const afterLive = nowBkk.minutes >= 8 * 60 + 30;
  const afterAbsent = nowBkk.minutes >= 16 * 60;

  if (!afterLive && !afterAbsent) return list;

  const dayKey = `day${todayDay}`;

  return list.map((stu) => {
    if (!stu || typeof stu !== "object") return stu;

    // ถ้ามี record ของวันนี้อยู่แล้ว ไม่ยุ่ง
    if (hasCheckinDailyEntry(stu, todayDay)) return stu;

    // ถ้าเช็คอินวันนี้แล้ว ไม่ยุ่ง
    if (isCheckedInDay(stu, todayDay)) return stu;

    const typeToday = getLearnTypeForDay(stu, todayDay);

    // 1) LIVE หลัง 08:30 -> LIVE CHECK (ถือว่า check-in แล้ว แต่ไม่ต้องมีลายเซ็น)
    if (typeToday === "live" && afterLive) {
      const nextDaily = Array.isArray(stu.checkinDaily)
        ? [...stu.checkinDaily]
        : [];
      nextDaily.push({
        day: todayDay,
        checkedIn: true,
        mode: "live",
        status: "live",
        time: null,
        signatureUrl: "",
        _auto: true,
      });

      const nextStatus =
        stu.checkinStatus && typeof stu.checkinStatus === "object"
          ? { ...stu.checkinStatus }
          : {};
      nextStatus[dayKey] = true;

      const nextCheckins =
        stu.checkins && typeof stu.checkins === "object"
          ? { ...stu.checkins }
          : {};
      nextCheckins[String(todayDay)] = {
        checkedIn: true,
        mode: "live",
        status: "live",
        time: null,
        signatureUrl: "",
        _auto: true,
      };

      return {
        ...stu,
        checkinDaily: nextDaily,
        checkinStatus: nextStatus,
        checkins: nextCheckins,
      };
    }

    // 2) CLASSROOM หลัง 16:00 -> ไม่เข้าเรียน (ไม่ถือว่า check-in)
    if (typeToday === "classroom" && afterAbsent) {
      const nextDaily = Array.isArray(stu.checkinDaily)
        ? [...stu.checkinDaily]
        : [];
      nextDaily.push({
        day: todayDay,
        checkedIn: false,
        status: "absent",
        mode: "",
        time: null,
        signatureUrl: "",
        _auto: true,
      });

      const nextCheckins =
        stu.checkins && typeof stu.checkins === "object"
          ? { ...stu.checkins }
          : {};
      nextCheckins[String(todayDay)] = {
        checkedIn: false,
        status: "absent",
        mode: "",
        time: null,
        signatureUrl: "",
        _auto: true,
      };

      return {
        ...stu,
        checkinDaily: nextDaily,
        checkins: nextCheckins,
      };
    }

    return stu;
  });
}

function getDocReceiveTypeRaw(stu) {
  return String(stu?.documentReceiveType || stu?.receiveType || "")
    .trim()
    .toLowerCase();
}

function isEMSStudent(stu) {
  return getDocReceiveTypeRaw(stu) === "ems";
}

function hasDocReceivedOnSite(stu) {
  // เผื่อบางเคสเก็บเป็น signature/url/signedAt
  if (stu?.documentReceivedAt) return true;
  if (stu?.documentReceiptSignedAt) return true;
  if (stu?.documentReceiptSigUrl) return true;
  if (stu?.documentReceiptSig?.url) return true;
  return false;
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState([]);
  const [filterKey, setFilterKey] = useState("all");
  const [search, setSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editForm, setEditForm] = useState({
    title: "",
    courseCode: "",
    room: "",
    trainerName: "",
    startDate: "",
    dayCount: 1,

    dateMode: "consecutive",
    days: [],
  });

  const [dayPick, setDayPick] = useState("");
  const [instructors, setInstructors] = useState([]);

  // ✅ tick เวลาเพื่อให้ LIVE CHECK/ไม่เข้าเรียน (และ report) อัปเดตตามเวลา
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  const nowBKK = useMemo(() => getNowBKK(), [nowTick]);

  const reloadClass = useCallback(async () => {
    if (!id) return null;

    const r1 = await fetch(`/api/admin/classes/${id}`, {
      cache: "no-store",
    }).catch(() => null);

    if (r1 && r1.ok) {
      const d1 = await safeJson(r1);
      if (d1 && (d1._id || d1.id)) {
        setClassData(d1);
        return d1;
      }
      if (d1?.ok && (d1.class || d1.item)) {
        const found = d1.class || d1.item || null;
        setClassData(found);
        return found;
      }
    }

    const r2 = await fetch(`/api/admin/classes?id=${id}&withStudents=1`, {
      cache: "no-store",
    }).catch(() => null);

    const d2 = r2 ? await safeJson(r2) : null;

    let found = null;
    if (d2 && d2._id) found = d2;
    else if (d2 && d2.ok && d2.class) found = d2.class;
    else if (d2 && d2.ok && d2.item) found = d2.item;
    else if (Array.isArray(d2)) found = d2.find((c) => c._id === id);
    else if (Array.isArray(d2?.items))
      found = d2.items.find((c) => c._id === id);

    setClassData(found || null);
    return found || null;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const x = await reloadClass();
        if (!alive) return;
        if (!x) setClassData(null);
      } catch (err) {
        console.error("load class error", err);
        if (!alive) return;
        setClassData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, reloadClass]);

  useEffect(() => {
    async function loadInstructors() {
      try {
        const res = await fetch("/api/admin/ai/instructors");
        const data = await res.json().catch(() => ({}));
        const rows =
          data.items ||
          data.data ||
          data.instructors ||
          (Array.isArray(data) ? data : []);
        setInstructors(rows || []);
      } catch (err) {
        console.error(err);
        setInstructors([]);
      }
    }
    loadInstructors();
  }, []);

  const rawStudents = useMemo(() => {
    return Array.isArray(classData?.students) ? classData.students : [];
  }, [classData]);

  const dayCount = useMemo(() => {
    if (!classData) return 1;
    return pickPositiveInt(
      classData?.days?.length,
      classData?.duration?.dayCount,
      classData?.totalDays,
      classData?.dayCount,
    );
  }, [classData]);

  const startDate =
    classData?.startDate || classData?.date || classData?.start || null;

  const dayDates = useMemo(() => {
    const raw = Array.isArray(classData?.days) ? classData.days : [];
    const fromDays = raw
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string") return ymdFromAnyBKK(x);
        if (typeof x === "object") {
          return ymdFromAnyBKK(
            x.date || x.ymd || x.day || x.value || x.startDate,
          );
        }
        return ymdFromAnyBKK(x);
      })
      .filter(Boolean);

    if (fromDays.length) return fromDays;

    const base = ymdFromAnyBKK(startDate);
    if (!base) return [];
    const n = pickPositiveInt(dayCount, 1);
    return Array.from({ length: n }, (_, i) => addDaysYMD(base, i)).filter(
      Boolean,
    );
  }, [classData, startDate, dayCount]);

  const trainingRangeLabel = useMemo(() => {
    return buildTrainingRangeLabel(dayDates);
  }, [dayDates]);

  // ✅ NEW: inject LIVE CHECK / ABSENT สำหรับ “วันนี้” เข้า students แบบชั่วคราว (ใช้กับ table + report)
  const students = useMemo(() => {
    return applyAutoAttendance(rawStudents, dayDates, nowBKK);
  }, [rawStudents, dayDates, nowBKK.ymd, nowBKK.minutes]);

  const filteredStudents = useMemo(() => {
    const rows = students || [];
    switch (filterKey) {
      case "checked":
        return rows.filter(
          (s) => hasAnyCheckin(s) && s?.studentStatus !== "cancelled",
        );
      case "not_checked":
        return rows.filter(
          (s) => !hasAnyCheckin(s) && s?.studentStatus !== "cancelled",
        );
      case "late":
        return rows.filter(
          (s) => hasAnyLate(s) && s?.studentStatus !== "cancelled",
        );
      case "cancelled":
        return rows.filter((s) => s?.studentStatus === "cancelled");
      case "postponed":
        return rows.filter((s) => s?.studentStatus === "postponed");
      case "all":
      default:
        return rows;
    }
  }, [students, filterKey]);

  const finalStudents = useMemo(() => {
    const q = norm(search);
    if (!q) return filteredStudents;

    return (filteredStudents || []).filter((s) => {
      const parts = [
        getStudentNameAny(s),
        s?.nameEN,
        s?.engName,
        s?.company,
        s?.paymentRef,
        s?.studentStatus,
      ]
        .filter(Boolean)
        .map((x) => norm(x));

      return parts.some((p) => p.includes(q));
    });
  }, [filteredStudents, search]);

  // (ยังไม่ใช้ใน UI แต่เก็บไว้ได้)
  const presentCount = useMemo(() => {
    return students.filter((s) => hasAnyCheckin(s)).length;
  }, [students]);

  const lateCount = useMemo(() => {
    return countLateAllDays(students);
  }, [students]);

  // ✅ NEW: เอกสาร — ไม่นับ EMS
  const emsCount = useMemo(() => {
    return students.filter((s) => isEMSStudent(s)).length;
  }, [students]);

  const docNeedStudents = useMemo(() => {
    return students.filter((s) => !isEMSStudent(s));
  }, [students]);

  const receivedCount = useMemo(() => {
    return docNeedStudents.filter((s) => hasDocReceivedOnSite(s)).length;
  }, [docNeedStudents]);

  const notReceivedCount = useMemo(() => {
    return Math.max(0, docNeedStudents.length - receivedCount);
  }, [docNeedStudents, receivedCount]);

  const selectedStudents = useMemo(() => {
    const set = new Set((selectedIds || []).map(String));
    return (students || []).filter((s) => set.has(String(s?._id)));
  }, [students, selectedIds]);

  const reportStudents = useMemo(() => {
    if (selectedIds?.length) return selectedStudents;
    return finalStudents;
  }, [selectedIds, selectedStudents, finalStudents]);

  const roomOptions = useMemo(() => {
    const base = [...ROOM_OPTIONS_BASE];
    const cur = String(editForm.room || "").trim();
    if (cur && !base.includes(cur)) base.unshift(cur);
    return base;
  }, [editForm.room]);

  const editDaysPreviewLabel = useMemo(() => {
    const days =
      editForm.dateMode === "custom"
        ? uniqueSortedYMDs(editForm.days || [])
        : buildConsecutiveDays(editForm.startDate, editForm.dayCount);
    return buildTrainingRangeLabel(days);
  }, [editForm.dateMode, editForm.days, editForm.startDate, editForm.dayCount]);

  const editTotalDays = useMemo(() => {
    if (editForm.dateMode === "custom") {
      return uniqueSortedYMDs(editForm.days || []).length || 1;
    }
    return pickPositiveInt(editForm.dayCount, 1);
  }, [editForm.dateMode, editForm.days, editForm.dayCount]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-admin-textMuted">
        กำลังโหลดข้อมูลห้องอบรม...
      </div>
    );
  }

  if (!classData) {
    return <div className="p-6 text-sm text-red-500">ไม่พบข้อมูลห้องอบรม</div>;
  }

  const courseTitle =
    classData.courseTitle || classData.course_name || classData.title || "";

  const courseName =
    classData.courseName || // ✅ ชื่อหลักสูตรที่คุณต้องการ
    classData.course_name || // เผื่อ field เก่า
    classData.course?.course_name || // เผื่อ nested
    "";

  const courseCode =
    classData.courseCode || classData.course_code || classData.code || "";

  const classCode = classData.classCode || classData.class_code || "";

  const roomName =
    classData.roomName ||
    classData.room_name ||
    classData.classroomName ||
    classData.classroom ||
    classData.room ||
    classData.roomTitle ||
    classData.roomInfo?.nameTH ||
    classData.roomInfo?.name ||
    "";

  const dateRangeText = classData.date_range_text || classData.dateText || "";
  const endDate = classData.endDate || classData.finishDate || classData.end;
  const timeRangeText = classData.time_range_text || classData.timeText || "";

  const trainerRaw =
    classData.trainers ||
    classData.instructors ||
    classData.teacherList ||
    null;

  const trainerName =
    classData.trainerName ||
    classData.trainer ||
    (Array.isArray(trainerRaw)
      ? trainerRaw
          .map((t) => (typeof t === "string" ? t : t.name || t.fullname || ""))
          .filter(Boolean)
          .at(0) || ""
      : "");

  const studentsCount = students.length;
  const createdAt = classData.createdAt;
  const updatedAt = classData.updatedAt;

  function openEditModal() {
    const dc = pickPositiveInt(
      classData?.days?.length,
      classData?.duration?.dayCount,
      classData?.totalDays,
      classData?.dayCount,
    );

    const rawDays = Array.isArray(classData?.days) ? classData.days : [];
    const parsedDays = uniqueSortedYMDs(
      rawDays.map((x) => (typeof x === "object" ? x?.date || x?.ymd || x : x)),
    );

    const baseStart = ymdFromAnyBKK(startDate);
    const hasCustomDays = parsedDays.length > 0;

    setDayPick("");

    setEditForm({
      title: courseTitle || "",
      courseCode: courseCode || "",
      room: roomName || "",
      trainerName: trainerName || "",
      startDate: (hasCustomDays ? parsedDays[0] : baseStart) || "",
      dayCount: hasCustomDays ? parsedDays.length : dc,

      dateMode: hasCustomDays ? "custom" : "consecutive",
      days: hasCustomDays ? parsedDays : [],
    });

    setEditOpen(true);
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditOpen(false);
  }

  function addOneDay() {
    const ymd = ymdFromAnyBKK(dayPick);
    if (!ymd) return;

    setEditForm((f) => {
      const next = uniqueSortedYMDs([...(f.days || []), ymd]);
      return { ...f, days: next, startDate: next[0] || f.startDate };
    });

    setDayPick("");
  }

  function removeDay(ymd) {
    setEditForm((f) => {
      const next = uniqueSortedYMDs((f.days || []).filter((x) => x !== ymd));
      return {
        ...f,
        days: next,
        startDate: next[0] || "",
        dayCount: next.length || 1,
      };
    });
  }

  async function handleSaveEdit(e) {
    e?.preventDefault();
    if (!id) return;

    const confirmSave = window.confirm(
      "ยืนยันการบันทึกการแก้ไขข้อมูล Class นี้หรือไม่?",
    );
    if (!confirmSave) return;

    setEditSaving(true);
    try {
      const customDays =
        editForm.dateMode === "custom"
          ? uniqueSortedYMDs(editForm.days || [])
          : [];

      const payload = {
        title: editForm.title,
        courseCode: editForm.courseCode,
        room: editForm.room,
        trainerName: editForm.trainerName,

        date:
          editForm.dateMode === "custom"
            ? customDays[0] || null
            : editForm.startDate || null,
        dayCount:
          editForm.dateMode === "custom"
            ? customDays.length || 1
            : Number(editForm.dayCount) || 1,

        days: editForm.dateMode === "custom" ? customDays : undefined,
      };

      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        console.error("update class failed", data);
        alert(data?.error || "บันทึกการแก้ไขไม่สำเร็จ");
        return;
      }

      await reloadClass();
      alert("บันทึกการแก้ไขเรียบร้อยแล้ว");
      setEditOpen(false);
    } catch (err) {
      console.error("update class error", err);
      alert("เกิดข้อผิดพลาดขณะบันทึกการแก้ไข");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteClass() {
    if (!id) return;
    const ok = window.confirm(
      `ต้องการลบ Class นี้จริงหรือไม่?\n\n${courseCode || ""} - ${courseTitle || ""}`,
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/classes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        console.error("delete class failed", data);
        alert(data?.error || "ลบ Class ไม่สำเร็จ");
        setDeleting(false);
        return;
      }

      alert("ลบ Class เรียบร้อยแล้ว");
      router.push("/a1exqwvCqTXP7s0/admin/classroom/classes");
    } catch (err) {
      console.error("delete class error", err);
      alert("เกิดข้อผิดพลาดระหว่างลบ Class");
      setDeleting(false);
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="shrink-0 space-y-4">
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() =>
              router.replace("/a1exqwvCqTXP7s0/admin/classroom/classes")
            }
            className="inline-flex h-9 w-9 items-center justify-center rounded-full
               border border-admin-border bg-white text-admin-text
               hover:bg-admin-surfaceMuted"
            aria-label="ย้อนกลับ"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <SyncStudentsButton classId={id} />

            <ReportPreviewButton
              students={finalStudents} // ตาม filter + search (ที่เห็นในตาราง)
              selectedStudents={selectedStudents} // เฉพาะที่เลือก
              totalStudentsCount={studentsCount} // total ทั้งคลาส
              dayCount={dayCount}
              dayDates={dayDates} // ✅ ใช้วันจริงชุดเดียวกับตาราง
              classInfo={classData}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full
                 border border-admin-border bg-white text-admin-text
                 hover:bg-admin-surfaceMuted"
                  aria-label="เมนูการจัดการ Class"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-40 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
              >
                <DropdownMenuItem onSelect={openEditModal}>
                  แก้ไขข้อมูล Class
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onSelect={handleDeleteClass}
                  disabled={deleting}
                >
                  {deleting ? "กำลังลบ..." : "ลบ Class นี้"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row  md:justify-between bg-white p-4 rounded-2xl border border-admin-border">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
              CLASS DETAIL
            </div>
            <h1 className="text-lg font-semibold text-admin-text">
              {courseTitle}
            </h1>

            <div className=" text-base text-admin-textMuted">
              {courseCode && (
                <>
                  รหัสคอร์ส : <span className="font-medium">{courseCode}</span>
                </>
              )}
              {classCode && (
                <>
                  {" "}
                  • รอบที่: <span className="font-medium">{classCode}</span>
                </>
              )}
            </div>

            <div className=" text-base text-admin-textMuted">
              {courseName && (
                <div>
                  หลักสูตร :{" "}
                  <span className="font-medium">
                    {courseName}
                  </span>
                </div>
              )}
            </div>

            <div className=" text-base text-admin-textMuted">
              ห้อง {roomName || "-"}
              {dateRangeText && <> • {dateRangeText}</>}
            </div>

            {timeRangeText && (
              <div className=" text-base text-admin-textMuted">
                เวลาอบรม: {timeRangeText}
              </div>
            )}

            {!timeRangeText && (trainingRangeLabel || startDate || endDate) && (
              <div className=" text-base text-admin-textMuted">
                ช่วงเวลา :{" "}
                {trainingRangeLabel ||
                  `${startDate ? formatDateEN(startDate) : ""}${
                    endDate ? ` - ${formatDateEN(endDate)}` : ""
                  }`}
              </div>
            )}

            {trainerName && (
              <div className=" text-base text-admin-textMuted">
                วิทยากร : {trainerName}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center rounded-xl border border-admin-border p-2">
                <div className="text-xs text-admin-textMuted">จำนวนวันอบรม</div>
                <div className="mt-1 text-base font-semibold">
                  {dayCount} วัน
                </div>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-admin-border p-2">
                <div className="text-xs text-admin-textMuted">
                  จำนวนนักเรียนทั้งหมด
                </div>
                <div className="mt-1 text-base font-semibold">
                  {studentsCount} คน
                </div>
              </div>

              {/* ✅ NEW: นับเฉพาะ “ไม่ใช่ EMS” */}
              <div className="flex flex-col items-center rounded-xl border border-admin-border p-2">
                <div className="text-xs text-admin-textMuted">
                  รับเอกสารแล้ว
                </div>
                <div className="mt-1 text-base font-semibold text-emerald-600">
                  {receivedCount} คน
                </div>
                {emsCount > 0 && (
                  <div className="mt-0.5 text-[10px] text-admin-textMuted">
                    * รับผ่าน ปณ {emsCount} คน (ไม่ถูกนับ)
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center rounded-xl border border-admin-border p-2">
                <div className="text-xs text-admin-textMuted">
                  ยังไม่รับเอกสาร
                </div>
                <div className="mt-1 text-base font-semibold">
                  {notReceivedCount} คน
                </div>
                {emsCount > 0 && (
                  <div className="mt-0.5 text-[10px] text-admin-textMuted">
                    * เฉพาะคนมารับ ณ วันอบรม
                  </div>
                )}
              </div>
            </div>

            {(createdAt || updatedAt) && (
              <div className="flex flex-col items-end bg-admin-surface  text-[11px] text-admin-textMuted">
                {createdAt && (
                  <div>
                    สร้างเมื่อ : {formatDateEN(createdAt)}{" "}
                    {formatTimeTH(createdAt) &&
                      `เวลา ${formatTimeTH(createdAt)} น.`}
                  </div>
                )}
                {updatedAt && (
                  <div>
                    แก้ไขล่าสุด : {formatDateEN(updatedAt)}{" "}
                    {formatTimeTH(updatedAt) &&
                      `เวลา ${formatTimeTH(updatedAt)} น.`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="h-full rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-sm overflow-hidden flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-xs text-admin-textMuted">
                รายชื่อนักเรียน {finalStudents.length} คน • เลือกแล้ว{" "}
                <span className="font-semibold text-admin-text">
                  {selectedIds.length}
                </span>{" "}
                คน
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
                    aria-label="เลือกตัวกรอง"
                  >
                    <span className="text-admin-textMuted">Filter:</span>
                    <span className="font-medium">
                      {FILTERS.find((f) => f.key === filterKey)?.label ||
                        "ทั้งหมด"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-44 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                >
                  {FILTERS.map((f) => {
                    const active = filterKey === f.key;
                    return (
                      <DropdownMenuItem
                        key={f.key}
                        onSelect={() => setFilterKey(f.key)}
                        className={active ? "font-semibold" : ""}
                      >
                        {f.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              <input
                type="text"
                placeholder="ค้นหาชื่อ / บริษัท / เลข QT/IV/RP ..."
                className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-80"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <StudentsTable
            classId={id}
            students={finalStudents}
            dayCount={dayCount}
            dayDates={dayDates}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onReloadRequested={reloadClass}
          />
        </div>
      </div>

      {/* edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
          onClick={closeEditModal}
        >
          <div
            className="w-[95vw] max-w-xl rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold text-admin-text">
              แก้ไขข้อมูล Class
            </h2>

            <form className="space-y-3" onSubmit={handleSaveEdit}>
              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  ชื่อ CLASS
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    รหัสคอร์ส
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    value={editForm.courseCode}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, courseCode: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    ห้องอบรม
                  </label>

                  <select
                    className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    value={editForm.room || ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, room: e.target.value }))
                    }
                  >
                    <option value="">เช่น Jupiter / Mars / Online</option>
                    {roomOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <div className="mt-1 text-[10px] text-admin-textMuted">
                    * ถ้าห้องเดิมไม่อยู่ในรายการ ระบบจะแทรกให้เลือกอัตโนมัติ
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  วิทยากร
                </label>

                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={editForm.trainerName || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, trainerName: e.target.value }))
                  }
                >
                  <option value="">-- เลือกวิทยากร --</option>

                  {instructors.map((t, idx) => {
                    const name =
                      t?.name ||
                      t?.display_name ||
                      t?.fullname ||
                      t?.name_th ||
                      (typeof t === "string" ? t : "") ||
                      "";

                    if (!name) return null;

                    return (
                      <option key={`${name}-${idx}`} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="rounded-xl border border-admin-border bg-admin-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] text-admin-textMuted">
                      รูปแบบวันอบรม
                    </div>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((f) => ({
                            ...f,
                            dateMode: "consecutive",
                            days: [],
                            dayCount: pickPositiveInt(f.dayCount, 1),
                          }))
                        }
                        className={`rounded-full px-3 py-1 text-xs border ${
                          editForm.dateMode === "consecutive"
                            ? "bg-brand-primary text-white border-brand-primary"
                            : "bg-white text-admin-text border-admin-border hover:bg-admin-surfaceMuted"
                        }`}
                      >
                        ต่อเนื่อง (Start + จำนวนวัน)
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((f) => {
                            const curDays = uniqueSortedYMDs(f.days || []);
                            const fallback = curDays.length
                              ? curDays
                              : buildConsecutiveDays(f.startDate, f.dayCount);

                            return {
                              ...f,
                              dateMode: "custom",
                              days: fallback,
                              startDate: fallback[0] || f.startDate,
                              dayCount: fallback.length || 1,
                            };
                          })
                        }
                        className={`rounded-full px-3 py-1 text-xs border ${
                          editForm.dateMode === "custom"
                            ? "bg-brand-primary text-white border-brand-primary"
                            : "bg-white text-admin-text border-admin-border hover:bg-admin-surfaceMuted"
                        }`}
                      >
                        เลือกวันเอง (ข้ามวันได้)
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-admin-textMuted">
                    รวม{" "}
                    <span className="font-semibold text-admin-text">
                      {editTotalDays}
                    </span>{" "}
                    วัน
                  </div>
                </div>

                {editForm.dateMode === "consecutive" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] text-admin-textMuted">
                        วันที่เริ่มอบรม
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        value={editForm.startDate || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            startDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-admin-textMuted">
                        จำนวนวันอบรม
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                        value={editForm.dayCount}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            dayCount: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label className="block text-[11px] text-admin-textMuted">
                          เลือกวันอบรม (เพิ่มได้หลายวัน / ข้ามวัน / ข้ามเดือน)
                        </label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          value={dayPick || ""}
                          onChange={(e) => setDayPick(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={addOneDay}
                          className="h-[30px] rounded-lg bg-brand-primary px-3 text-xs font-medium text-white hover:bg-brand-primary/90"
                        >
                          เพิ่มวัน
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {uniqueSortedYMDs(editForm.days || []).map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-2 rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text"
                        >
                          {formatDateEN(d)}
                          <button
                            type="button"
                            onClick={() => removeDay(d)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
                            aria-label="ลบวัน"
                            title="ลบวัน"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {!uniqueSortedYMDs(editForm.days || []).length && (
                        <div className="text-xs text-admin-textMuted">
                          ยังไม่ได้เพิ่มวัน
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[11px] text-admin-textMuted">
                  Preview:{" "}
                  <span className="text-admin-text font-medium">
                    {editDaysPreviewLabel || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-admin-border px-3 py-1.5 text-xs text-admin-text hover:bg-admin-surfaceMuted"
                  disabled={editSaving}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                >
                  {editSaving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
