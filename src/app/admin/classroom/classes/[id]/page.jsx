// src/app/admin/classroom/classes/[id]/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StudentsTable from "./StudentsTable";
import SyncStudentsButton from "./SyncStudentsButton";
import ReportPreviewButton from "./ReportPreviewButton";
import { ChevronLeft, MoreVertical } from "lucide-react";

/* ===== helpers เล็กน้อยไว้ format ข้อมูล ===== */

function formatDateTH(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // ถ้าไม่ใช่ date จริง ให้แสดง string เดิม
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

export default function ClassDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ===== state สำหรับ edit/delete =====
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    courseCode: "",
    room: "",
    //channel: "",
    trainerName: "",
    startDate: "",
    dayCount: 1,
  });

  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    if (!actionsOpen) return;

    const handleClickOutside = (e) => {
      // ถ้าคลิกไม่ได้อยู่ในกล่องเมนู -> ปิด
      if (!e.target.closest("[data-classdetail-actions]")) {
        setActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionsOpen]);

  // ===== โหลดข้อมูล Class (ใช้ list + filter เพราะยังไม่มี /api/admin/classes/[id]) =====
  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);

        const res = await fetch(`/api/admin/classes?id=${id}&withStudents=1`, {
          cache: "no-store",
        });
        const data = await res.json();

        let found = null;

        if (data && data._id) {
          found = data;
        } else if (data && data.ok && data.class) {
          found = data.class;
        } else if (data && data.ok && data.item) {
          found = data.item;
        } else if (Array.isArray(data)) {
          found = data.find((c) => c._id === id);
        } else if (Array.isArray(data.items)) {
          found = data.items.find((c) => c._id === id);
        }

        setClassData(found || null);
      } catch (err) {
        console.error("load class error", err);
        setClassData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ===== ค่าอนุพันธ์จาก classData =====
  const students = useMemo(() => {
    return classData?.students || [];
  }, [classData]);

  const dayCount = useMemo(() => {
    if (!classData) return 1;

    return (
      classData.dayCount ??
      classData.totalDays ??
      classData.days?.length ??
      classData.duration?.dayCount ??
      1
    );
  }, [classData]);

  const presentCount = useMemo(() => {
    return students.filter((s) => {
      const chk = s.checkin || {};
      return Object.values(chk).some((v) => !!v);
    }).length;
  }, [students]);

  // ===== loading / not found =====
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

  /* ===== ดึงค่า/คำนวณต่าง ๆ จาก classData ===== */

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

  // const channel =
  //   classData.channel || classData.trainingChannel || classData.mode || "";

  const trainerRaw =
    classData.trainers ||
    classData.instructors ||
    classData.teacherList ||
    null;

  const trainerName = Array.isArray(trainerRaw)
    ? trainerRaw
        .map((t) => (typeof t === "string" ? t : t.name || t.fullname || ""))
        .filter(Boolean)
        .join(", ")
    : classData.trainerName || classData.trainer || "";

  const studentsCount = students.length;
  const lateCount = students.filter((s) => s.late).length;

  const createdAt = classData.createdAt;
  const updatedAt = classData.updatedAt;

  /* ===== ฟังก์ชันเปิด / ปิด modal แก้ไข ===== */

  function openEditModal() {
    const dc =
      classData.dayCount ??
      classData.totalDays ??
      classData.days?.length ??
      classData.duration?.dayCount ??
      1;

    setEditForm({
      title: courseTitle || "",
      courseCode: courseCode || "",
      room: roomName || "",
      //channel: channel || "",
      trainerName: trainerName || "",
      startDate: startDate
        ? new Date(startDate).toISOString().slice(0, 10)
        : "",
      dayCount: dc || 1,
    });
    setEditOpen(true);
  }

  function closeEditModal() {
    if (editSaving) return;
    setEditOpen(false);
  }

  async function handleSaveEdit(e) {
    e?.preventDefault();
    if (!id) return;

    const confirmSave = window.confirm(
      "ยืนยันการบันทึกการแก้ไขข้อมูล Class นี้หรือไม่?"
    );
    if (!confirmSave) return;

    setEditSaving(true);
    try {
      const payload = {
        title: editForm.title,
        courseCode: editForm.courseCode,
        room: editForm.room,
        //channel: editForm.channel,
        trainerName: editForm.trainerName,
        date: editForm.startDate || null,
        dayCount: Number(editForm.dayCount) || 1,
      };

      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        console.error("update class failed", data);
        alert(data.error || "บันทึกการแก้ไขไม่สำเร็จ");
        return;
      }

      // sync state classData
      setClassData((prev) =>
        prev
          ? {
              ...prev,
              title: payload.title,
              courseTitle: payload.title,
              courseCode: payload.courseCode,
              room: payload.room,
              roomName: payload.room,
              //channel: payload.channel,
              trainingChannel: payload.channel,
              trainerName: payload.trainerName,
              trainer: payload.trainerName,
              date: payload.date
                ? new Date(payload.date).toISOString()
                : prev.date,
              startDate: payload.date
                ? new Date(payload.date).toISOString()
                : prev.startDate,
              dayCount: payload.dayCount,
              duration: {
                ...(prev.duration || {}),
                dayCount: payload.dayCount,
              },
            }
          : prev
      );

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
      `ต้องการลบ Class นี้จริงหรือไม่?\n\n${courseCode || ""} - ${
        courseTitle || ""
      }`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        console.error("delete class failed", data);
        alert(data.error || "ลบ Class ไม่สำเร็จ");
        setDeleting(false);
        return;
      }

      alert("ลบ Class เรียบร้อยแล้ว");
      router.push("/admin/classroom/classes");
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
          onClick={() => router.replace("/admin/classroom/classes")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full
               border border-admin-border bg-white text-admin-text
               hover:bg-admin-surfaceMuted"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* 🔵 ปุ่มหลัก: ดึงรายชื่อจากระบบลงทะเบียน (Primary) */}
          <SyncStudentsButton classId={id} />

          {/* ⚪ ปุ่มรอง: ดูตัวอย่างรายงาน / Export */}
          <ReportPreviewButton
            students={students}
            dayCount={dayCount}
            classInfo={classData}
          />

          {/* ⋮ Kebab menu: แก้ไข + ลบ */}
          <div className="relative" data-classdetail-actions>
            <button
              type="button"
              onClick={() => setActionsOpen((o) => !o)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full
                 border border-admin-border bg-white text-admin-text
                 hover:bg-admin-surfaceMuted"
              aria-label="เมนูการจัดการ Class"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {actionsOpen && (
              <div
                className="absolute right-0 mt-1 w-40 rounded-xl bg-white py-1 text-xs
                   shadow-lg ring-1 ring-black/5 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    openEditModal();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-admin-text
                     hover:bg-admin-surfaceMuted"
                >
                  แก้ไขข้อมูล Class
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    handleDeleteClass();
                  }}
                  disabled={deleting}
                  className="block w-full px-3 py-1.5 text-left text-red-600
                     hover:bg-red-50 disabled:opacity-60"
                >
                  {deleting ? "กำลังลบ..." : "ลบ Class นี้"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Header บนสุด: ชื่อ Course + ปุ่มต่าง ๆ ===== */}
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

          {/* {channel && (
            <div className="mt-0.5 text-xs text-admin-textMuted">
              ช่องทางอบรม: {channel}
            </div>
          )} */}

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

        {/* <div className="flex flex-wrap items-center gap-2">
        
          <ReportPreviewButton
            students={students}
            dayCount={dayCount}
            classInfo={classData}
          />

          <SyncStudentsButton classId={id} />

          <button
            type="button"
            onClick={openEditModal}
            className="rounded-lg border border-admin-border px-3 py-1.5 text-xs text-admin-text hover:bg-admin-surfaceMuted"
          >
            แก้ไขข้อมูล Class
          </button>

      
          <button
            type="button"
            onClick={handleDeleteClass}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "กำลังลบ..." : "ลบ Class นี้"}
          </button>
        </div> */}
      </div>

      {/* ===== แถบสรุปสั้น ๆ ของ Class / สถิตินักเรียน ===== */}
      <div className="grid gap-3 rounded-2xl border border-admin-border bg-admin-surface p-4 text-xs text-admin-text md:grid-cols-4">
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
      </div>

      {/* ===== Card รายละเอียดอื่น ๆ ของ Class (ถ้ามี) ===== */}
      {/* {(createdAt || updatedAt) && (
        <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 text-[11px] text-admin-textMuted">
          {createdAt && (
            <div>
              สร้างเมื่อ: {formatDateTH(createdAt)}{" "}
              {formatTimeTH(createdAt) && `เวลา ${formatTimeTH(createdAt)} น.`}
            </div>
          )}
          {updatedAt && (
            <div>
              แก้ไขล่าสุด: {formatDateTH(updatedAt)}{" "}
              {formatTimeTH(updatedAt) && `เวลา ${formatTimeTH(updatedAt)} น.`}
            </div>
          )}
        </div>
      )} */}

      {/* ===== Card รายชื่อนักเรียน + ตาราง Check-in ===== */}
      <div className="rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-sm">
        {/* <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-admin-text">
            รายชื่อนักเรียน ({students.length} คน)
          </div>
        </div> */}

        <StudentsTable students={students} dayCount={dayCount} />
      </div>

      {/* ===== Modal แก้ไขข้อมูล Class ===== */}
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

              {/* <div>
                <label className="block text-[11px] text-admin-textMuted">
                  ช่องทางอบรม (on_class / online / hybrid ...)
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={editForm.channel}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, channel: e.target.value }))
                  }
                />
              </div> */}

              <div>
                <label className="block text-[11px] text-admin-textMuted">
                  วิทยากร
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  value={editForm.trainerName}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      trainerName: e.target.value,
                    }))
                  }
                />
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
