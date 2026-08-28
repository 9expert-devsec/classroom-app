// src/app/[adminKey]/admin/classroom/masterclass/classes/new/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { Calendar } from "@/components/ui/calendar";

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

// dd-mm-yy (พ.ศ.) จาก YYYY-MM-DD
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

function instructorKey(t) {
  return String(t?._id || t?.instructor_id || t?.code || t?.email || "");
}

function instructorName(t) {
  return String(
    t?.name || t?.display_name || t?.fullname || t?.name_th || "",
  ).trim();
}

function instructorEmail(t) {
  return String(t?.email || t?.instructor_email || "").trim();
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

export default function NewMasterclassClassPage() {
  const router = useRouter();
  const params = useParams();
  const adminKey = String(params?.adminKey || "");

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
  const [endTime, setEndTime] = useState("17:00");

  // ✅ สถานที่ (เก็บลง field room เดิม)
  const [venue, setVenue] = useState("");

  // ✅ อาจารย์หลายคน (checkbox list + search)
  const [instructorIds, setInstructorIds] = useState([]); // string[]
  const [instructorSearch, setInstructorSearch] = useState("");

  // ✅ banner ประจำ class (upload หรือ paste URL)
  const [classImageUrl, setClassImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c._id) === courseId) || null,
    [courses, courseId],
  );

  const selectedInstructors = useMemo(() => {
    const byKey = new Map(instructors.map((t) => [instructorKey(t), t]));
    return instructorIds.map((id) => byKey.get(id)).filter(Boolean);
  }, [instructors, instructorIds]);

  const filteredInstructors = useMemo(() => {
    const q = instructorSearch.trim().toLowerCase();
    if (!q) return instructors;
    return instructors.filter((t) => {
      const hay = `${instructorName(t)} ${instructorEmail(t)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [instructors, instructorSearch]);

  // โหลดคอร์ส Masterclass + instructor
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch("/api/admin/masterclass-courses?activeOnly=1", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "โหลดรายการคอร์สไม่สำเร็จ");
        }
        setCourses(safeArr(data.items));
      } catch (err) {
        console.error(err);
        alert("โหลดรายการคอร์ส Masterclass ไม่สำเร็จ");
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
        setInstructors(safeArr(rows));
      } catch (err) {
        console.error(err);
      }
    }

    loadCourses();
    loadInstructors();
  }, []);

  // ✅ auto-gen title: {COURSE_ID}-{dd}-{mm}-{yy}-{run}
  const genRef = useRef(0);
  useEffect(() => {
    async function run() {
      if (titleTouched) return;
      if (!selectedCourse) return;

      const code = String(selectedCourse.courseId || "").toUpperCase();
      if (!code) return;

      // ยังไม่เลือกวัน → ยังไม่บังคับ pattern (รอเลือกวันก่อน)
      if (!daysYMD.length) {
        setTitle(`${code} - ${selectedCourse.name || ""}`.trim());
        return;
      }

      const firstYMD = daysYMD[0];
      const ddmmyy = toDDMMYY_BE_fromYMD(firstYMD);
      const titlePrefix = `${code}-${ddmmyy}`;

      const my = ++genRef.current;
      const runNo = await guessNextRunNumber({
        dateYMD: firstYMD,
        titlePrefix,
      });

      if (my !== genRef.current) return;
      setTitle(`${titlePrefix}-${runNo}`);
    }

    run();
  }, [selectedCourse, daysYMD, titleTouched]);

  function toggleInstructor(key) {
    setInstructorIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        console.error(data);
        alert(data?.error || "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      setClassImageUrl(data.url);
    } catch (err) {
      console.error(err);
      alert("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleUrlChange(e) {
    const v = String(e.target.value || "").trim();
    setClassImageUrl(v);
  }

  function clearImage() {
    setClassImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    if (!selectedCourse) {
      alert("กรุณาเลือกคอร์ส Masterclass");
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

    const payload = {
      title: t,

      courseCode: selectedCourse.courseId || "",
      courseName: selectedCourse.name || "",

      date: dateStr,
      dayCount: dayCount || 1,
      days: daysYMD,

      startTime,
      endTime,

      room: venue.trim(),
      classImageUrl: classImageUrl || "",

      instructors: selectedInstructors.map((t2) => ({
        name: instructorName(t2),
        email: instructorEmail(t2),
      })),

      source: "manual",

      classKind: "masterclass",
      masterclassCourseId: selectedCourse._id,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));

      if (!res.ok || !out?.ok) {
        console.error(out);
        if (out?.error === "duplicate_class_title") {
          alert(
            "ชื่อ Class นี้ถูกใช้ไปแล้ว กรุณากดปุ่ม “ใช้ชื่ออัตโนมัติ” เพื่อ gen เลขลำดับใหม่ หรือแก้ชื่อเอง",
          );
        } else {
          alert(out?.error || "สร้าง Class ไม่สำเร็จ");
        }
        setSubmitting(false);
        return;
      }

      const newId = String(out?.item?._id || "");
      if (newId) {
        router.push(`/${adminKey}/admin/classroom/classes/${newId}`);
        return;
      }

      alert("สร้าง Class (Masterclass) สำเร็จแล้ว");
      router.push(`/${adminKey}/admin/classroom/classes`);
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเรียก API");
      setSubmitting(false);
    }
  }

  const previewSrc =
    classImageUrl &&
    (classImageUrl.startsWith("http://") ||
      classImageUrl.startsWith("https://"))
      ? classImageUrl
      : "";

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <h1 className="text-2xl font-semibold">สร้าง Class (Masterclass)</h1>
      <p className="mt-1 text-sm text-admin-textMuted">
        เลือกคอร์ส Masterclass, อัปโหลด Banner, ระบุสถานที่,
        เลือกอาจารย์ได้หลายคน และเลือกวันอบรมเองหลายวัน
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex-1 min-h-0 space-y-4 overflow-y-auto rounded-3xl bg-admin-surface p-6 shadow-card "
      >
        {/* เลือกคอร์ส Masterclass */}
        <div>
          <label className="block text-sm font-medium text-admin-text">
            เลือกคอร์ส (Masterclass) *
          </label>
          <select
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTitleTouched(false);
            }}
          >
            <option value="">-- กรุณาเลือกคอร์ส --</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.courseId} — {c.name}
              </option>
            ))}
          </select>
          {courses.length === 0 && (
            <p className="mt-1 text-[11px] text-admin-textMuted">
              ยังไม่มีคอร์ส Masterclass ที่เปิดใช้งาน —
              สร้างได้ที่เมนู New Course (Masterclass)
            </p>
          )}
        </div>

        {/* Banner ประจำ class */}
        <div className="rounded-2xl border border-admin-border bg-white p-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-admin-text">
              รูป Banner ประจำ Class
            </label>
            {classImageUrl && (
              <button
                type="button"
                onClick={clearImage}
                className="rounded-full border border-admin-border bg-white px-3 py-1 text-xs text-admin-text hover:bg-admin-surfaceMuted"
              >
                ลบรูป
              </button>
            )}
          </div>

          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-[11px] text-admin-textMuted">
                อัปโหลดไฟล์
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={imageUploading}
                className="mt-1 w-full text-sm"
              />
              {imageUploading && (
                <p className="mt-1 text-[11px] text-admin-textMuted">
                  กำลังอัปโหลด...
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] text-admin-textMuted">
                หรือวาง URL รูป
              </label>
              <input
                type="text"
                value={classImageUrl}
                onChange={handleUrlChange}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {previewSrc && (
            <div className="mt-3 overflow-hidden rounded-xl border border-admin-border">
              <img
                src={previewSrc}
                alt="preview"
                className="w-full object-cover max-h-56"
              />
            </div>
          )}
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
            placeholder="เช่น MC-AI-EXEC-26-01-69-1"
          />
          <p className="mt-1 text-[11px] text-admin-textMuted">
            * รูปแบบอัตโนมัติ: {"{COURSE_ID}"}-dd-mm-yy(พ.ศ.)-ลำดับ
            (ถ้าแก้ชื่อเองแล้ว ระบบจะไม่ gen ทับ)
          </p>
        </div>

        {/* สถานที่ */}
        <div>
          <label className="block text-sm font-medium text-admin-text">
            สถานที่
          </label>
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="เช่น Asia Hotel"
          />
        </div>

        {/* อาจารย์ผู้สอน (เลือกได้หลายคน) */}
        <div className="rounded-2xl border border-admin-border bg-white p-4">
          <label className="block text-sm font-medium text-admin-text">
            อาจารย์ผู้สอน (เลือกได้หลายคน)
          </label>

          {/* chips ของคนที่เลือกไว้ */}
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedInstructors.length ? (
              selectedInstructors.map((t) => {
                const key = instructorKey(t);
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-2 rounded-full bg-admin-surfaceMuted px-3 py-1 text-xs text-admin-text"
                  >
                    {instructorName(t) || key}
                    <button
                      type="button"
                      onClick={() => toggleInstructor(key)}
                      className="text-admin-textMuted hover:text-red-600"
                      aria-label="เอาออก"
                    >
                      ×
                    </button>
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-admin-textMuted">
                ยังไม่ได้เลือกอาจารย์
              </span>
            )}
          </div>

          <input
            type="text"
            value={instructorSearch}
            onChange={(e) => setInstructorSearch(e.target.value)}
            placeholder="ค้นหาอาจารย์..."
            className="mt-3 w-full rounded-xl border border-admin-border bg-white px-3 py-2 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />

          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-admin-border">
            {filteredInstructors.length ? (
              filteredInstructors.map((t) => {
                const key = instructorKey(t);
                const checked = instructorIds.includes(key);
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 border-b border-admin-border px-3 py-2 last:border-b-0 hover:bg-admin-surfaceMuted"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => toggleInstructor(key)}
                    />
                    <span className="text-sm text-admin-text">
                      {instructorName(t) || key}
                    </span>
                    {instructorEmail(t) && (
                      <span className="ml-auto text-[11px] text-admin-textMuted">
                        {instructorEmail(t)}
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-xs text-admin-textMuted">
                ไม่พบอาจารย์ที่ค้นหา
              </div>
            )}
          </div>
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
          disabled={submitting || !selectedCourse}
        >
          {submitting ? "กำลังสร้าง Class..." : "สร้าง Class"}
        </PrimaryButton>
      </form>
    </div>
  );
}
