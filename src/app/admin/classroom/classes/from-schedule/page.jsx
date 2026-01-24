// src/app/admin/classroom/classes/from-schedule/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";

const ROOMS = ["Jupiter", "Mars", "Saturn", "Venus", "Opera"];

/* ---------- helpers ---------- */

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// แปลงวันที่เป็น "YYYY-MM-DD" ตามเวลา local (ไม่ผ่าน ISO/UTC)
function toLocalYMD(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ดึง first date จาก object schedule (ยึด dates[0] ก่อน)
function getFirstDateRaw(s) {
  return (
    (Array.isArray(s.dates) && s.dates[0]) ||
    s.startDate ||
    s.start_at ||
    s.start ||
    s.date ||
    null
  );
}

// ✅ ใช้ schedule.type จาก API จริง: "hybrid" | "classroom"
function pickTypePrefix(schedule) {
  const raw = String(schedule?.type || "")
    .trim()
    .toLowerCase();
  if (raw === "hybrid") return "H";
  if (raw === "classroom") return "CR";
  return "CR";
}

// channel code (ตอนนี้ default PUB)
function pickChannelPrefix(schedule) {
  const raw = String(
    schedule?.channel || schedule?.channelCode || schedule?.audience || "",
  )
    .trim()
    .toUpperCase();
  return raw || "PUB";
}

// ทำ course code ให้เป็นรูปแบบ MSE-L6, POWER-BI, ...
function normalizeCourseCode(code) {
  return String(code || "CLASS")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

// date token: DD-MM-YY (YY = พ.ศ. 2 หลัก) เช่น 23-02-69
function toDDMMYY_BE(firstDate) {
  let yy = "00";
  let mm = "00";
  let dd = "00";

  if (firstDate) {
    const d = new Date(firstDate);
    if (!Number.isNaN(d.getTime())) {
      const beYear = d.getFullYear() + 543; // ปี พ.ศ.
      yy = String(beYear).slice(-2);
      mm = String(d.getMonth() + 1).padStart(2, "0");
      dd = String(d.getDate()).padStart(2, "0");
    }
  }

  return `${dd}-${mm}-${yy}`;
}

// prefix ของ title (ยังไม่ใส่ -RUN)
// CR-PUB-MSE-L6-23-02-69
function buildTitlePrefix(schedule, courseCode, firstDate) {
  const type = pickTypePrefix(schedule); // CR/H
  const channel = pickChannelPrefix(schedule); // PUB
  const code = normalizeCourseCode(courseCode); // MSE-L6
  const ddmmyy = toDDMMYY_BE(firstDate); // 23-02-69
  return `${type}-${channel}-${code}-${ddmmyy}`;
}

function parseRunFromTitle(title) {
  const s = String(title || "").trim();
  const parts = s.split("-");
  const last = parts[parts.length - 1];
  const n = Number(last);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

/* ---------- Component ---------- */

export default function FromSchedulePage() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  // modal state
  const [openModal, setOpenModal] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [saving, setSaving] = useState(false);

  // ฟอร์มใน modal
  const [classTitle, setClassTitle] = useState("");
  const [room, setRoom] = useState("");
  const [instructors, setInstructors] = useState([]);
  const [instructorId, setInstructorId] = useState("");

  // search + filter
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    async function loadSchedules() {
      setLoading(true);
      try {
        // คำนวณช่วง: เดือนนี้ + เดือนหน้า
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

        const toYMD = (d) => d.toISOString().slice(0, 10);

        const qs = new URLSearchParams({
          from: toYMD(start),
          to: toYMD(end),
        }).toString();

        const res = await fetch(`/api/admin/ai/schedule?${qs}`);
        const data = await res.json();

        const rowsAll =
          data.items ||
          data.data ||
          data.schedules ||
          (Array.isArray(data) ? data : []);

        setItems(rowsAll || []);
      } catch (err) {
        console.error(err);
        alert("โหลด schedule ไม่สำเร็จ");
      }
      setLoading(false);
    }

    async function loadInstructors() {
      try {
        const res = await fetch("/api/admin/ai/instructors");
        const data = await res.json();
        const rows =
          data.items ||
          data.data ||
          data.instructors ||
          (Array.isArray(data) ? data : []);
        setInstructors(rows || []);
      } catch (err) {
        console.error(err);
      }
    }

    loadSchedules();
    loadInstructors();
  }, []);

  // ====== apply search + filter + SORT ใกล้ -> ไกล ======
  const filteredItems = useMemo(() => {
    const base = safeArr(items)
      .filter((s) => {
        const firstDateRaw = getFirstDateRaw(s);
        const d = firstDateRaw ? new Date(firstDateRaw) : null;
        if (!d || Number.isNaN(d.getTime())) return false;

        // filter ช่วงวัน
        if (fromDate) {
          const df = new Date(fromDate + "T00:00:00");
          if (d < df) return false;
        }
        if (toDate) {
          const dt = new Date(toDate + "T23:59:59");
          if (d > dt) return false;
        }

        // filter ห้อง (schedule ตัวอย่างไม่มี room ก็ปล่อยผ่าน)
        if (roomFilter !== "ALL") {
          const r = (s.room || "").toString().trim();
          if (r !== roomFilter) return false;
        }

        // filter search ชื่อคอร์ส / code
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const courseName =
            s.course?.course_name || s.course_name || s.title || "";
          const courseCode =
            s.course?.course_id || s.course_id || s.courseCode || s.code || "";
          const haystack = (courseName + " " + courseCode).toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const da = new Date(getFirstDateRaw(a));
        const db = new Date(getFirstDateRaw(b));
        const ta = Number.isNaN(da.getTime()) ? 0 : da.getTime();
        const tb = Number.isNaN(db.getTime()) ? 0 : db.getTime();
        return ta - tb; // ใกล้ -> ไกล
      });

    return base;
  }, [items, search, roomFilter, fromDate, toDate]);

  async function guessNextRunNumber({ dateYMD, titlePrefix }) {
    // พยายามดึง class ของวันนั้นเพื่อเดา run = max+1
    // ถ้า endpoint ไม่รองรับ จะ fallback 1
    try {
      const qs = new URLSearchParams({
        date: dateYMD,
        titlePrefix,
      }).toString();

      const res = await fetch(`/api/admin/classes?${qs}`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });

      if (!res.ok) return 1;

      const data = await res.json().catch(() => ({}));
      const rows =
        data.items ||
        data.data ||
        data.classes ||
        (Array.isArray(data) ? data : []);

      const list = safeArr(rows);

      let maxRun = 0;
      for (const c of list) {
        const t = String(c?.title || c?.classTitle || "").trim();
        if (!t) continue;
        if (!t.startsWith(titlePrefix + "-")) continue;
        const r = parseRunFromTitle(t);
        if (r && r > maxRun) maxRun = r;
      }

      return maxRun + 1 || 1;
    } catch (e) {
      return 1;
    }
  }

  // เมื่อกด "สร้าง Class" บน row ใด
  async function handleOpenModal(s, index) {
    setCurrentSchedule({ ...s, index });

    const firstDate = getFirstDateRaw(s);

    // ✅ ยึดตาม JSON จริง: course.course_id เป็นหลัก
    const courseCode =
      s.course?.course_id || s.course_id || s.courseCode || s.code || "CLASS";

    const titlePrefix = buildTitlePrefix(s, courseCode, firstDate);

    const dateYMD = firstDate ? toLocalYMD(firstDate) : "";
    const run = dateYMD
      ? await guessNextRunNumber({ dateYMD, titlePrefix })
      : 1;

    setClassTitle(`${titlePrefix}-${String(run)}`);

    setRoom(s.room || "");
    setInstructorId("");
    setOpenModal(true);
  }

  async function handleCreateClass() {
    if (!currentSchedule) return;

    if (!classTitle.trim()) {
      alert("กรุณาใส่ชื่อ Class");
      return;
    }

    setSaving(true);

    const s = currentSchedule;
    const firstDate = getFirstDateRaw(s);

    const courseCode =
      s.course?.course_id || s.course_id || s.courseCode || s.code || "";

    const courseName =
      s.course?.course_name || s.course_name || s.courseName || s.title || "";

    const selectedInst =
      instructors.find(
        (i) =>
          String(i._id) === instructorId ||
          i.instructor_id === instructorId ||
          i.code === instructorId,
      ) || null;

    const payload = {
      // ✅ ให้มี title preview ได้ แต่ server จะเป็นผู้ finalize (และกันชน run)
      title: classTitle.trim(),

      courseCode,
      courseName,

      date: firstDate ? toLocalYMD(firstDate) : undefined,
      dayCount: Array.isArray(s.dates) ? s.dates.length : 1,
      startTime: "09:00",
      endTime: "16:00",
      room: room || "",

      source: "api",
      externalScheduleId: String(s._id || s.id || s.schedule_id || ""),

      // ✅ ยึด type จาก API จริง
      trainingType: String(s.type || ""), // "hybrid" | "classroom"
      channel: "PUB",

      instructors: selectedInst
        ? [
            {
              name:
                selectedInst.name ||
                selectedInst.display_name ||
                selectedInst.fullname ||
                selectedInst.name_th ||
                "",
              email: selectedInst.email || selectedInst.instructor_email || "",
            },
          ]
        : [],
    };

    if (!payload.date) {
      alert("schedule นี้ไม่มีวันที่ (dates[0]) ต้องเช็คโครง API เพิ่ม");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(out);
        alert(out.error || "สร้าง Class ไม่สำเร็จ");
      } else {
        alert("สร้าง Class สำเร็จ");
        setOpenModal(false);
      }
    } catch (err) {
      console.error(err);
      alert("เรียก /api/admin/classes ไม่สำเร็จ");
    }
    setSaving(false);
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          สร้าง Class จากรอบอบรม (schedule API)
        </h1>
        <p className="text-sm text-admin-textMuted">
          ดึงข้อมูลจาก https://9exp-sec.com/api/ai/schedules ผ่าน proxy
          แล้วกดสร้าง Class
        </p>
      </div>

      {/* ส่วนค้นหา + filter */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-card mb-2">
        <div className="flex flex-wrap gap-3 items-center text-xs sm:text-sm">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-admin-textMuted mb-1">
              ค้นหา (ชื่อคอร์ส / รหัสคอร์ส)
            </label>
            <input
              className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="เช่น Excel, MSA-L1 ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-admin-textMuted mb-1">ห้องอบรม</label>
            <select
              className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              {ROOMS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-admin-textMuted mb-1">จากวันที่</label>
            <input
              type="date"
              className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-admin-textMuted mb-1">ถึงวันที่</label>
            <input
              type="date"
              className="rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-admin-surface p-4 shadow-card relative">
        <div className="overflow-auto max-h-[calc(100vh-260px)] min-h-[240px]">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-admin-surfaceMuted text-[11px] uppercase text-admin-textMuted">
              <tr>
                <th className="px-3 py-2 text-left text-sm">Course</th>
                <th className="px-3 py-2 text-left text-sm">วัน/เวลาเริ่ม</th>
                <th className="px-3 py-2 text-center text-sm">สร้าง Class</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((s, idx) => {
                const key = s._id || s.id || s.schedule_id || idx;

                const courseName =
                  s.course?.course_name ||
                  s.course_name ||
                  s.title ||
                  "ไม่ทราบชื่อคอร์ส";

                const courseCode =
                  s.course?.course_id || s.course_id || s.courseCode || "";

                const firstDate = getFirstDateRaw(s);

                return (
                  <tr
                    key={key}
                    className="border-t border-admin-border hover:bg-admin-surfaceMuted/60"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{courseName}</div>
                      <div className="text-[11px] text-admin-textMuted">
                        {courseCode}{" "}
                        {s?.type ? (
                          <span className="ml-1 rounded-md bg-admin-surfaceMuted px-1.5 py-0.5 text-[10px]">
                            {String(s.type).toUpperCase()}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-admin-textMuted">
                      {formatDateTime(firstDate)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      <PrimaryButton
                        type="button"
                        className="px-3 py-1 text-xs"
                        onClick={() => handleOpenModal(s, idx)}
                        disabled={loading}
                      >
                        สร้าง Class
                      </PrimaryButton>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-admin-textMuted"
                  >
                    ยังไม่มีข้อมูล schedule ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="absolute inset-0 rounded-2xl bg-admin-surface/70 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-admin-textMuted">
              <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              กำลังโหลด schedule...
            </div>
          </div>
        )}
      </div>

      {/* ---------- Modal ---------- */}
      {openModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-admin-surface p-5 shadow-slate-950/20">
            <h2 className="text-lg font-semibold">ยืนยันการสร้าง Class</h2>

            {currentSchedule && (
              <div className="mt-2 rounded-xl bg-admin-surfaceMuted px-3 py-2 text-xs text-admin-textMuted">
                <div className="font-medium text-admin-text">
                  {currentSchedule.course?.course_name ||
                    currentSchedule.course_name ||
                    currentSchedule.title ||
                    "ไม่ทราบชื่อคอร์ส"}
                </div>
                <div>
                  รอบวันที่: {formatDateTime(getFirstDateRaw(currentSchedule))}
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-admin-text">ชื่อ Class</span>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={classTitle}
                  onChange={(e) => setClassTitle(e.target.value)}
                />
                <span className="mt-1 block text-[11px] text-admin-textMuted">
                  ตัวอย่าง: CR-PUB-MSE-L6-23-02-69-1 (แก้เองได้ตามต้องการ)
                </span>
              </label>

              <label className="block">
                <span className="text-admin-text">ห้องอบรม</span>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                >
                  <option value="">-- เลือกห้อง --</option>
                  {ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-admin-text">อาจารย์ผู้สอน</span>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                >
                  <option value="">-- เลือกอาจารย์ --</option>
                  {instructors.map((t) => {
                    const id =
                      t._id || t.instructor_id || t.code || t.email || "";
                    const name =
                      t.name || t.display_name || t.fullname || t.name_th || id;
                    return (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2 text-sm">
              <button
                type="button"
                className="rounded-lg px-4 py-1.5 text-admin-textMuted hover:bg-admin-surfaceMuted"
                onClick={() => setOpenModal(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <PrimaryButton
                type="button"
                className="px-4 py-1.5"
                onClick={handleCreateClass}
                disabled={saving}
              >
                {saving ? "กำลังบันทึก..." : "ยืนยันสร้าง Class"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
