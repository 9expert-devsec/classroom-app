// src/app/admin/classroom/classes/new/page.jsx
"use client";

import { useEffect, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";

const ROOMS = ["Jupiter", "Mars", "Saturn", "Venus", "Opera", "Online"];

// แปลง Date เป็น YYYY-MM-DD แบบ local
function toLocalYMD(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NewClassManualPage() {
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);

  const [courseId, setCourseId] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [dayCount, setDayCount] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("16:00");
  const [room, setRoom] = useState("");
  const [instructorId, setInstructorId] = useState("");

  const [submitting, setSubmitting] = useState(false);

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
        // ไม่ต้อง alert ก็ได้ แค่ไม่มี option ให้เลือก
      }
    }

    loadCourses();
    loadInstructors();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const selectedCourse = courses.find((c) => String(c._id) === courseId);
    if (!selectedCourse) {
      alert("กรุณาเลือกคอร์ส");
      return;
    }
    if (!dateStr) {
      alert("กรุณาเลือกวันอบรม (Day 1)");
      return;
    }

    const ymd = toLocalYMD(dateStr);
    if (!ymd) {
      alert("รูปแบบวันที่ไม่ถูกต้อง");
      return;
    }

    const dc = Number(dayCount) || 1;

    // หา instructor ที่เลือก
    const selectedInst =
      instructors.find(
        (i) =>
          String(i._id) === instructorId ||
          i.instructor_id === instructorId ||
          i.code === instructorId
      ) || null;

    // ตั้งชื่อ class แบบเรียบ ๆ (ปรับได้ตามใจ)
    const title = `${selectedCourse.course_id || ""} - ${
      selectedCourse.course_name || ""
    }`;

    const payload = {
      title: title.trim(),
      courseCode: selectedCourse.course_id || "",
      courseName: selectedCourse.course_name || "",
      date: ymd,
      dayCount: dc,
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
                selectedInst.instructor_name ||
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
      // ล้างฟอร์มบางส่วน
      setDateStr("");
      setDayCount(1);
      setStartTime("09:00");
      setEndTime("16:00");
      setRoom("");
      setInstructorId("");
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเรียก API");
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">สร้าง Class (manual)</h1>
      <p className="mt-1 text-sm text-admin-textMuted">
        เลือกคอร์สจาก public-courses แล้วกำหนดวันที่/เวลา/ห้อง และอาจารย์ผู้สอนของ
        Class ด้วยตัวเอง
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-3xl bg-admin-surface p-6 shadow-card"
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

        {/* แถววันที่ / จำนวนวัน */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-admin-text">
              วันอบรม (Day 1)
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-admin-text">
              จำนวนวันอบรม
            </label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={dayCount}
              onChange={(e) => setDayCount(e.target.value)}
            />
          </div>
        </div>

        {/* แถวเวลาเริ่ม / สิ้นสุด */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
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

          <div>
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
                t.name ||
                t.display_name ||
                t.fullname ||
                t.instructor_name ||
                id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-[11px] text-admin-textMuted">
            ถ้าไม่เลือก ระบบจะสร้าง Class โดยไม่มีชื่อผู้สอน (ไปกำหนดทีหลังได้)
          </p>
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
