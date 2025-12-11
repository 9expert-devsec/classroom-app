"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

function formatThaiDate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatDateRange(cls) {
  const startStr = cls.date || cls.startDate || cls.start_date;
  const dayCount =
    cls.duration?.dayCount || cls.dayCount || cls.days || 1;

  if (!startStr) return "-";

  const dStart = new Date(startStr);
  if (Number.isNaN(dStart.getTime())) return "-";

  const dEnd = new Date(dStart);
  dEnd.setDate(dEnd.getDate() + (dayCount - 1));

  if (dayCount <= 1) return formatThaiDate(dStart);
  return `${formatThaiDate(dStart)} - ${formatThaiDate(dEnd)}`;
}

export default function ClassesListClient({ initialClasses, total }) {
  // 🔹 เก็บ list class แบบแก้ไขได้
  const [classes, setClasses] = useState(initialClasses || []);

  // 🔹 state filter + page
  const [search, setSearch] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 🔹 state สำหรับ Edit popup
  const [editingClass, setEditingClass] = useState(null); // object Class ที่กำลังแก้ไข
  const [editForm, setEditForm] = useState({
    title: "",
    courseCode: "",
    room: "",
    date: "",
    dayCount: 1,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* ================== FILTER ================== */

  const filtered = useMemo(() => {
    return classes.filter((cls) => {
      const q = search.trim().toLowerCase();
      const cc = courseCode.trim().toLowerCase();
      const tt = title.trim().toLowerCase();

      if (cc && !(cls.courseCode || "").toLowerCase().includes(cc)) {
        return false;
      }
      if (tt && !(cls.title || "").toLowerCase().includes(tt)) {
        return false;
      }

      if (dateFrom || dateTo) {
        const d = new Date(cls.date);
        if (!Number.isNaN(d.getTime())) {
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
        }
      }

      if (q) {
        const instructor =
          cls.instructors && cls.instructors[0]
            ? cls.instructors[0].name || cls.instructors[0].fullname || ""
            : "";
        const haystack = [cls.title, cls.courseCode, cls.room, instructor]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [classes, search, courseCode, title, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  function goPrev() {
    setPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPage((p) => Math.min(totalPages, p + 1));
  }

  /* ================== EDIT / DELETE HANDLERS ================== */

  function openEditModal(cls) {
    const id = cls._id || cls.id;

    const dayCount =
      cls.duration?.dayCount ||
      cls.dayCount ||
      (Array.isArray(cls.days) ? cls.days.length : cls.days) ||
      1;

    setEditingClass(cls);
    setEditForm({
      title: cls.title || "",
      courseCode: cls.courseCode || "",
      room: cls.room || cls.roomName || "",
      date: (cls.date || cls.startDate || "").slice(0, 10) || "",
      dayCount: dayCount || 1,
    });
  }

  function closeEditModal() {
    if (saving) return;
    setEditingClass(null);
  }

  async function handleSaveEdit(e) {
    e?.preventDefault();
    if (!editingClass) return;

    const id = editingClass._id || editingClass.id;
    if (!id) return;

    // ✅ popup ยืนยันก่อนบันทึก
    const ok = window.confirm("ยืนยันการบันทึกการแก้ไข Class นี้หรือไม่?");
    if (!ok) return;

    setSaving(true);
    try {
      const payload = {
        title: editForm.title,
        courseCode: editForm.courseCode,
        room: editForm.room,
        date: editForm.date || null,
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

      // อัปเดต state ฝั่ง client
      setClasses((prev) =>
        prev.map((c) =>
          (c._id || c.id) === id
            ? {
                ...c,
                title: payload.title,
                courseCode: payload.courseCode,
                room: payload.room,
                roomName: payload.room,
                date: payload.date || c.date,
                startDate: payload.date || c.startDate,
                dayCount: payload.dayCount,
                duration: {
                  ...(c.duration || {}),
                  dayCount: payload.dayCount,
                },
              }
            : c
        )
      );

      alert("บันทึกการแก้ไขเรียบร้อยแล้ว");
      setEditingClass(null);
    } catch (err) {
      console.error("update class error", err);
      alert("เกิดข้อผิดพลาดระหว่างบันทึกการแก้ไข");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cls) {
    const id = cls._id || cls.id;
    if (!id) return;

    // ✅ popup ยืนยันก่อนลบ
    const ok = window.confirm(
      `ต้องการลบ Class นี้จริงหรือไม่?\n\n${cls.courseCode || ""} - ${
        cls.title || ""
      }`
    );
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        console.error("delete class failed", data);
        alert(data.error || "ลบ Class ไม่สำเร็จ");
        return;
      }

      setClasses((prev) => prev.filter((c) => (c._id || c.id) !== id));
      alert("ลบ Class เรียบร้อยแล้ว");
    } catch (err) {
      console.error("delete class error", err);
      alert("เกิดข้อผิดพลาดระหว่างลบ Class");
    } finally {
      setDeletingId(null);
    }
  }

  /* ================== RENDER ================== */

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
      {/* Filter bar */}
      <div className="mb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              รหัสคอร์ส
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={courseCode}
              onChange={(e) => {
                setCourseCode(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              ชื่อ CLASS
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              จากวันที่
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              ถึงวันที่
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-admin-textMuted">
            ทั้งหมด {classes.length} class — หลัง filter เหลือ {filtered.length} class
          </div>
          <input
            className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary sm:w-80"
            placeholder="ค้นหา (ชื่อ Class / รหัสคอร์ส / ห้อง / อาจารย์)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <table className="min-w-full text-xs sm:text-sm">
        <thead className="bg-admin-surfaceMuted text-[11px] uppercase text-admin-textMuted">
          <tr>
            <th className="px-3 py-2 text-left">วันที่เริ่ม - วันที่จบ</th>
            <th className="px-3 py-2 text-left">ชื่อ CLASS</th>
            <th className="px-3 py-2 text-left">ห้องอบรม</th>
            <th className="px-3 py-2 text-left">ผู้สอน</th>
            <th className="px-3 py-2 text-right">จำนวนนักเรียน</th>
            <th className="px-3 py-2 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((cls) => {
            const id = cls._id || cls.id;
            const studentCount =
              cls.studentsCount ??
              cls.studentCount ??
              cls.students_count ??
              (Array.isArray(cls.students) ? cls.students.length : 0);

            const room = cls.room || cls.roomName || "-";

            const instructor =
              cls.instructors && cls.instructors.length > 0
                ? cls.instructors[0].name || cls.instructors[0].fullname || "-"
                : "-";

            return (
              <tr
                key={id}
                className="border-t border-admin-border hover:bg-admin-surfaceMuted/60"
              >
                <td className="px-3 py-2 text-admin-textMuted">
                  {formatDateRange(cls)}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {cls.title || "ไม่ตั้งชื่อ"}
                  </div>
                  <div className="text-[11px] text-admin-textMuted">
                    {cls.courseCode || cls.course_id || ""}
                  </div>
                </td>
                <td className="px-3 py-2 text-admin-textMuted">{room}</td>
                <td className="px-3 py-2 text-admin-textMuted">{instructor}</td>
                <td className="px-3 py-2 text-right">{studentCount}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/classroom/classes/${id}`}
                      className="text-xs font-medium text-brand-primary hover:underline"
                    >
                      เปิดดู
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditModal(cls)}
                      className="rounded-lg border border-admin-border px-2 py-1 text-[11px] text-admin-text hover:bg-admin-surfaceMuted"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cls)}
                      disabled={deletingId === id}
                      className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {deletingId === id ? "กำลังลบ..." : "ลบ"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {visible.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="px-3 py-4 text-center text-admin-textMuted"
              >
                ยังไม่มี Class ตรงตามเงื่อนไข
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="mt-4 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="rounded-lg border border-admin-border px-3 py-1 disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-admin-textMuted">
            หน้า {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= totalPages}
            className="rounded-lg border border-admin-border px-3 py-1 disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* ===== Modal แก้ไข Class ===== */}
      {editingClass && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-admin-textMuted">
                    วันที่เริ่ม
                  </label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, date: e.target.value }))
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
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
