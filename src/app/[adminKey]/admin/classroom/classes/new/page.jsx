// src/app/admin/classroom/classes/new/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { Calendar } from "@/components/ui/calendar";

const ROOMS = ["Jupiter", "Mars", "Saturn", "Venus", "Opera", "Online"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

// YYYY-MM-DD local (จาก Date object)
function toLocalYMD(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function uniqDates(dates) {
  const map = new Map();
  for (const d of dates || []) {
    const ymd = toLocalYMD(d);
    if (ymd) map.set(ymd, new Date(d));
  }
  return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
}

function normalizeCourseCode(code) {
  return String(code || "CLASS")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function toDDMMYY_BE_fromYMD(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return `00-00-00`;
  const [y, m, d] = s.split("-");
  const be = Number(y) + 543;
  const yy = String(be).slice(-2);
  return `${d}-${m}-${yy}`;
}

function formatDMYDashFromYMD(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
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

// heuristic: ถ้าคอร์สเป็น hybrid หรือเลือกห้อง Online ให้ขึ้น H
function pickTypePrefixManual(course, room) {
  const raw = String(course?.type || course?.trainingType || "")
    .trim()
    .toLowerCase();
  if (raw === "hybrid") return "H";
  if (raw === "classroom") return "CR";
  if (
    String(room || "")
      .trim()
      .toLowerCase() === "online"
  )
    return "H";
  return "CR";
}

async function guessNextRunNumber({ dateYMD, titlePrefix }) {
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
  } catch {
    return 1;
  }
}

export default function NewClassManualPage() {
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);

  const [courseId, setCourseId] = useState("");

  // ✅ ตั้งชื่อ Class เอง
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  // ✅ เลือกวันเองหลายวัน
  const [selectedDates, setSelectedDates] = useState([]); // Date[]
  const selectedSorted = useMemo(
    () => uniqDates(selectedDates),
    [selectedDates],
  );

  // วันแรก = วันที่น้อยสุด (compat)
  const dateStr = useMemo(() => {
    const first = selectedSorted[0];
    return first ? toLocalYMD(first) : "";
  }, [selectedSorted]);

  const dayCount = useMemo(() => selectedSorted.length || 0, [selectedSorted]);

  const daysYMD = useMemo(
    () => selectedSorted.map((d) => toLocalYMD(d)).filter(Boolean),
    [selectedSorted],
  );

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");
  const [room, setRoom] = useState("");
  const [instructorId, setInstructorId] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c._id) === courseId) || null,
    [courses, courseId],
  );

  // โหลดคอร์ส + instructor
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch("/api/admin/ai/public-courses");
        const data = await res.json();
        const items =
          data.items ||
          data.data ||
          data.courses ||
          (Array.isArray(data) ? data : []);
        setCourses(items || []);
      } catch (err) {
        console.error(err);
        alert("โหลดรายการคอร์สไม่สำเร็จ");
      }
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

    loadCourses();
    loadInstructors();
  }, []);

  // ✅ auto-gen title แบบเดียวกับหน้า import schedule
  const genRef = useRef(0);
  useEffect(() => {
    async function run() {
      if (!selectedCourse) return;
      if (titleTouched) return;

      // ยังไม่เลือกวัน → ยังไม่บังคับ pattern (รอเลือกวันก่อน)
      if (!daysYMD.length) {
        setTitle(
          `${selectedCourse.course_id || ""} - ${selectedCourse.course_name || ""}`
            .trim()
            .replace(/\s+/g, " "),
        );
        return;
      }

      const firstYMD = daysYMD[0];
      const type = pickTypePrefixManual(selectedCourse, room);
      const channel = "PUB";
      const code = normalizeCourseCode(selectedCourse.course_id || "CLASS");
      const ddmmyy = toDDMMYY_BE_fromYMD(firstYMD);
      const titlePrefix = `${type}-${channel}-${code}-${ddmmyy}`;

      const my = ++genRef.current;
      const runNo = await guessNextRunNumber({
        dateYMD: firstYMD,
        titlePrefix,
      });

      if (my !== genRef.current) return;
      setTitle(`${titlePrefix}-${runNo}`);
    }

    run();
  }, [selectedCourse, daysYMD, room, titleTouched]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!selectedCourse) {
      alert("กรุณาเลือกคอร์ส");
      return;
    }

    if (!daysYMD.length) {
      alert("กรุณาเลือกวันอบรมอย่างน้อย 1 วัน");
      return;
    }

    const t = String(title || "").trim();
    if (!t) {
      alert("กรุณากรอกชื่อ Class");
      return;
    }

    const selectedInst =
      instructors.find(
        (i) =>
          String(i._id) === instructorId ||
          i.instructor_id === instructorId ||
          i.code === instructorId,
      ) || null;

    const payload = {
      title: t,

      courseCode: selectedCourse.course_id || "",
      courseName: selectedCourse.course_name || "",

      date: dateStr,
      dayCount: dayCount || 1,
      days: daysYMD,

      startTime,
      endTime,
      room: room || "",
      source: "manual",
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json();

      if (!res.ok) {
        console.error(out);
        alert(out.error || "สร้าง Class ไม่สำเร็จ");
        setSubmitting(false);
        return;
      }

      alert("สร้าง Class (manual) สำเร็จแล้ว");

      setSelectedDates([]);
      setStartTime("09:00");
      setEndTime("16:00");
      setRoom("");
      setInstructorId("");

      setTitleTouched(false);
      // รอเลือกวันใหม่แล้วค่อย auto-gen
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเรียก API");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <h1 className="text-2xl font-semibold">สร้าง Class (manual)</h1>
      <p className="mt-1 text-sm text-admin-textMuted">
        เลือกคอร์ส, เลือกวันอบรมเองหลายวัน, ตั้งชื่อ Class เองได้
        และระบบจะนับจำนวนวันอัตโนมัติ
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex-1 min-h-0 space-y-4 overflow-y-auto rounded-3xl bg-admin-surface p-6 shadow-card "
      >
        {/* เลือกคอร์ส */}
        <div>
          <label className="block text-sm font-medium text-admin-text">
            เลือกคอร์ส (public-courses)
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">-- กรุณาเลือกคอร์ส --</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.course_id} — {c.course_name}
              </option>
            ))}
          </select>
        </div>

        {/* ตั้งชื่อ */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-admin-text">
              ชื่อ Class (แก้ไขเองได้)
            </label>

            <button
              type="button"
              className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text hover:bg-admin-surfaceMuted"
              onClick={() => {
                if (!selectedCourse) return;
                setTitleTouched(false); // ให้ระบบ gen ใหม่
              }}
              disabled={!selectedCourse}
              title="ให้ระบบ gen ชื่อใหม่อัตโนมัติ (ตามวันแรกที่เลือก)"
            >
              ใช้ชื่ออัตโนมัติ
            </button>
          </div>

          <input
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            placeholder="เช่น CR-PUB-XXX-26-01-69-1 หรือ ชื่ออะไรก็ได้"
          />
          <p className="mt-1 text-[11px] text-admin-textMuted">
            * ถ้าไม่แก้เอง ระบบจะ gen ชื่อให้เหมือนหน้า import schedule
          </p>
        </div>

        {/* ห้อง */}
        <div>
          <label className="block text-sm font-medium text-admin-text">
            ห้อง
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          >
            <option value="">เช่น Jupiter / Mars / Online</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* อาจารย์ผู้สอน */}
        <div>
          <label className="block text-sm font-medium text-admin-text">
            อาจารย์ผู้สอน
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
          >
            <option value="">-- เลือกอาจารย์ -- (ไม่บังคับ)</option>
            {instructors.map((t) => {
              const id = t._id || t.instructor_id || t.code || t.email || "";
              const name =
                t.name || t.display_name || t.fullname || t.name_th || id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        {/* เลือกวันเอง + จำนวนวันอัตโนมัติ */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-admin-text">
              วันอบรม (เลือกวันเอง)
            </label>

            <div className="mt-2 rounded-2xl border border-admin-border bg-white p-3">
              <Calendar
                mode="multiple"
                numberOfMonths={1}
                selected={selectedDates}
                onSelect={(v) => setSelectedDates(Array.isArray(v) ? v : [])}
                classNames={{
                  day_selected:
                    "bg-transparent text-admin-text ring-2 ring-brand-primary hover:bg-transparent",
                }}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {daysYMD.length ? (
                  daysYMD.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-admin-surfaceMuted px-3 py-1 text-xs text-admin-text"
                    >
                      {formatDMYDashFromYMD(d)} {/* ✅ dd-mm-yyyy */}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-admin-textMuted">
                    ยังไม่ได้เลือกวัน (คลิกวันที่เพื่อเลือกหลายวันได้)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-admin-text">
                จำนวนวันอบรม (คำนวณอัตโนมัติ)
              </label>
              <div>
                <div className="mt-1 w-full rounded-xl border border-admin-border bg-admin-surfaceMuted px-3 py-2 text-sm text-admin-text shadow-sm cursor-not-allowed">
                  {dayCount || 0}
                </div>
                <p className="mt-1 text-[11px] text-admin-textMuted">
                  จำนวนวัน = จำนวน “วันที่เลือก” (เลือกเว้นวันได้)
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-1">
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-admin-text">
                  เวลาเริ่ม
                </label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-medium text-admin-text">
                  เวลาสิ้นสุด
                </label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <PrimaryButton
          type="submit"
          className="mt-4 w-full"
          disabled={submitting}
        >
          {submitting ? "กำลังสร้าง Class..." : "สร้าง Class"}
        </PrimaryButton>
      </form>
    </div>
  );
}
