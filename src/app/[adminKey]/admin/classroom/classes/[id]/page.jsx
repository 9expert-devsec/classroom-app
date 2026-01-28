// src/app/admin/classroom/classes/[id]/page.jsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentsTable from "./StudentsTable";
import SyncStudentsButton from "./SyncStudentsButton";
import ReportPreviewButton from "./ReportPreviewButton";
import { ChevronLeft, MoreVertical, FileSignature } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ===== helpers ===== */

function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
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
    timeZone: "Asia/Bangkok",
  });
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
  // รองรับหลาย shape
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

/* ===== Filter options ===== */

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "checked", label: "เช็คอินแล้ว" },
  { key: "not_checked", label: "ยังไม่เช็คอิน" },
  { key: "late", label: "เช็คอินสาย" },
  { key: "cancelled", label: "ยกเลิก" },
  { key: "postponed", label: "ขอเลื่อน" },
];

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ selection (เอาไว้ export/print เฉพาะที่เลือกต่อ)
  const [selectedIds, setSelectedIds] = useState([]);

  // ✅ filter (default: all)
  const [filterKey, setFilterKey] = useState("all");

  // ===== state สำหรับ edit/delete class =====
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
  });

  const [instructors, setInstructors] = useState([]);

  /* ===== โหลดข้อมูล Class (✅ ใช้ /api/admin/classes/[id] เป็นหลัก) ===== */

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

  /* ===== derived ===== */

  const students = useMemo(() => {
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

  // ✅ filter students
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

  // ✅ present: เช็กอินอย่างน้อย 1 วัน
  const presentCount = useMemo(() => {
    return students.filter((s) => hasAnyCheckin(s)).length;
  }, [students]);

  // ✅ lateCount: รวมทุกวัน
  const lateCount = useMemo(() => {
    return countLateAllDays(students);
  }, [students]);

  const receivedCount = useMemo(() => {
    return students.filter((s) => !!s.documentReceivedAt).length;
  }, [students]);

  const notReceivedCount = useMemo(() => {
    return Math.max(0, students.length - receivedCount);
  }, [students, receivedCount]);

  // ✅ report sync: ถ้าเลือกไว้ -> รายงานใช้เฉพาะที่เลือก, ถ้าไม่เลือก -> ใช้ตาม filter ปัจจุบัน
  const selectedStudents = useMemo(() => {
    const set = new Set((selectedIds || []).map(String));
    return (students || []).filter((s) => set.has(String(s?._id)));
  }, [students, selectedIds]);

  const reportStudents = useMemo(() => {
    if (selectedIds?.length) return selectedStudents;
    return filteredStudents;
  }, [selectedIds, selectedStudents, filteredStudents]);

  /* ===== loading / not found ===== */

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

  /* ===== class fields ===== */

  const courseTitle =
    classData.courseTitle || classData.course_name || classData.title || "";

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

  const startDate =
    classData.startDate || classData.date || classData.start || null;
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

  /* ===== edit modal ===== */

  function openEditModal() {
    const dc = pickPositiveInt(
      classData?.days?.length,
      classData?.duration?.dayCount,
      classData?.totalDays,
      classData?.dayCount,
    );

    setEditForm({
      title: courseTitle || "",
      courseCode: courseCode || "",
      room: roomName || "",
      trainerName: trainerName || "",
      startDate: startDate
        ? new Date(startDate).toISOString().slice(0, 10)
        : "",
      dayCount: dc,
    });

    setEditOpen(true);
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditOpen(false);
  }

  function openReceiveHome() {
    window.open("/classroom/receive", "_blank", "noopener,noreferrer");
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
      const payload = {
        title: editForm.title,
        courseCode: editForm.courseCode,
        room: editForm.room,
        trainerName: editForm.trainerName,
        date: editForm.startDate || null,
        dayCount: Number(editForm.dayCount) || 1,
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

  /* ===== render ===== */

  return (
    <div className="space-y-4 ">
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => router.replace("/a1exqwvCqTXP7s0/admin/classroom/classes")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full
               border border-admin-border bg-white text-admin-text
               hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openReceiveHome}
            className="inline-flex items-center gap-2 rounded-full border border-admin-border bg-white px-3 py-2 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
            title="เปิดหน้า รับเอกสาร (เลือกโหมด 3.1 / 3.2)"
          >
            <FileSignature className="h-4 w-4" />
            รับเอกสาร
          </button>

          <SyncStudentsButton classId={id} />

          {/* ✅ sync selection -> report: ถ้าเลือกไว้ ใช้เฉพาะที่เลือก, ถ้าไม่เลือก ใช้ตาม filter */}
          <ReportPreviewButton
            students={reportStudents}
            dayCount={dayCount}
            classInfo={classData}
            selectedStudentIds={selectedIds}
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-2xl border border-admin-border">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-admin-textMuted">
            CLASS DETAIL
          </div>
          <h1 className="text-lg font-semibold text-admin-text">
            {courseTitle}
          </h1>

          <div className="mt-0.5 text-xs text-admin-textMuted">
            {courseCode && (
              <>
                รหัสคอร์ส: <span className="font-medium">{courseCode}</span>
              </>
            )}
            {classCode && (
              <>
                {" "}
                • รอบที่: <span className="font-medium">{classCode}</span>
              </>
            )}
          </div>

          <div className="mt-0.5 text-xs text-admin-textMuted">
            ห้อง {roomName || "-"}
            {dateRangeText && <> • {dateRangeText}</>}
          </div>

          {timeRangeText && (
            <div className="mt-0.5 text-xs text-admin-textMuted">
              เวลาอบรม: {timeRangeText}
            </div>
          )}

          {!timeRangeText && (startDate || endDate) && (
            <div className="mt-0.5 text-xs text-admin-textMuted">
              ช่วงเวลา: {startDate && formatDateTH(startDate)}
              {endDate && ` - ${formatDateTH(endDate)}`}
            </div>
          )}

          {trainerName && (
            <div className="mt-0.5 text-xs text-admin-textMuted">
              วิทยากร: {trainerName}
            </div>
          )}
        </div>

        {(createdAt || updatedAt) && (
          <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 text-[11px] text-admin-textMuted">
            {createdAt && (
              <div>
                สร้างเมื่อ: {formatDateTH(createdAt)}{" "}
                {formatTimeTH(createdAt) &&
                  `เวลา ${formatTimeTH(createdAt)} น.`}
              </div>
            )}
            {updatedAt && (
              <div>
                แก้ไขล่าสุด: {formatDateTH(updatedAt)}{" "}
                {formatTimeTH(updatedAt) &&
                  `เวลา ${formatTimeTH(updatedAt)} น.`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* stats */}
      <div className="grid gap-3 rounded-2xl border border-admin-border bg-admin-surface p-4 text-xs text-admin-text md:grid-cols-6">
        <div>
          <div className="text-[11px] text-admin-textMuted">จำนวนวันอบรม</div>
          <div className="mt-1 text-base font-semibold">{dayCount} วัน</div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">
            จำนวนนักเรียนทั้งหมด
          </div>
          <div className="mt-1 text-base font-semibold">{studentsCount} คน</div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">
            เช็กอินอย่างน้อย 1 วัน
          </div>
          <div className="mt-1 text-base font-semibold">{presentCount} คน</div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">
            สถานะสาย (รวมทุกวัน)
          </div>
          <div className="mt-1 text-base font-semibold text-red-500">
            {lateCount} คน
          </div>
        </div>

        <div>
          <div className="text-[11px] text-admin-textMuted">รับเอกสารแล้ว</div>
          <div className="mt-1 text-base font-semibold text-emerald-600">
            {receivedCount} คน
          </div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">
            ยังไม่รับเอกสาร
          </div>
          <div className="mt-1 text-base font-semibold">
            {notReceivedCount} คน
          </div>
        </div>
      </div>

      {/* ✅ Filter bar */}
      <div className="rounded-2xl border border-admin-border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-admin-textMuted mr-2">Filter:</div>
          {FILTERS.map((f) => {
            const active = filterKey === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterKey(f.key)}
                className={[
                  "rounded-full px-3 py-1.5 text-xs border",
                  active
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white text-admin-text border-admin-border hover:bg-admin-surfaceMuted",
                ].join(" ")}
              >
                {f.label}
              </button>
            );
          })}

          <div className="ml-auto text-xs text-admin-textMuted">
            แสดง {filteredStudents.length} / {students.length} คน
            {selectedIds.length ? ` • เลือกแล้ว ${selectedIds.length} คน` : ""}
          </div>
        </div>
      </div>

      {/* table */}
      <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-sm">
        <StudentsTable
          classId={id}
          students={filteredStudents} // ✅ แสดงตาม filter
          dayCount={dayCount}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onReloadRequested={reloadClass}
        />
      </div>

      {/* edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
          onClick={closeEditModal}
        >
          <div
            className="w-[95vw] max-w-lg rounded-2xl bg-white p-4 shadow-xl"
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
                      setEditForm((f) => ({
                        ...f,
                        courseCode: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    ห้องอบรม
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    value={editForm.room}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, room: e.target.value }))
                    }
                  />
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
                    setEditForm((f) => ({
                      ...f,
                      trainerName: e.target.value,
                    }))
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    วันที่เริ่มอบรม
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    value={editForm.startDate}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, startDate: e.target.value }))
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
