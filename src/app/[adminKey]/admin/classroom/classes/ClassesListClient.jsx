// src/app/admin/classroom/classes/ClassesListClient.jsx
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

/* ---------------- date helpers ---------------- */

function toISODate(d) {
  // YYYY-MM-DD (local)
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

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

function normalizeISODate(x) {
  const s = String(x || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}

function isoToDate(iso) {
  const s = normalizeISODate(iso);
  if (!s) return null;
  // สำคัญ: เติมเวลาเพื่อให้เป็น local (ไม่โดนตีเป็น UTC)
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function uniqueSortDates(arr) {
  const map = new Map();
  for (const d of arr || []) {
    if (!d || Number.isNaN(d.getTime())) continue;
    map.set(toISODate(d), d);
  }
  const keys = Array.from(map.keys()).sort();
  return keys.map((k) => isoToDate(k)).filter(Boolean);
}

function formatDateRange(cls) {
  // ✅ ถ้ามี days ใช้ days เป็น source of truth
  if (Array.isArray(cls.days) && cls.days.length > 0) {
    const sorted = [...cls.days].map(normalizeISODate).filter(Boolean).sort();
    if (sorted.length === 0) return "-";
    if (sorted.length === 1) return formatThaiDate(sorted[0]);
    return `${formatThaiDate(sorted[0])} - ${formatThaiDate(
      sorted[sorted.length - 1],
    )}`;
  }

  // fallback แบบเดิม: date + dayCount (ต่อเนื่อง)
  const startStr = cls.date || cls.startDate || cls.start_date;
  const dayCount = cls.duration?.dayCount || cls.dayCount || 1;

  if (!startStr) return "-";

  const dStart = new Date(startStr);
  if (Number.isNaN(dStart.getTime())) return "-";

  const dEnd = new Date(dStart);
  dEnd.setDate(dEnd.getDate() + (Number(dayCount) - 1));

  if (Number(dayCount) <= 1) return formatThaiDate(dStart);
  return `${formatThaiDate(dStart)} - ${formatThaiDate(dEnd)}`;
}

function safeArr(x) {
  return Array.isArray(x) ? x : [];
}

export default function ClassesListClient({ initialClasses, total }) {
  const router = useRouter();

  // 🔹 เก็บ list class แบบแก้ไขได้
  const [classes, setClasses] = useState(initialClasses || []);

  // ✅ refresh state
  const [refreshing, setRefreshing] = useState(false);

  const refreshClasses = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "GET",
        cache: "no-store",
        headers: { "content-type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        console.error("refresh classes failed", data);
        alert(data.error || "โหลด Class ล่าสุดไม่สำเร็จ");
        return;
      }

      const rows =
        data.items ||
        data.data ||
        data.classes ||
        (Array.isArray(data) ? data : []);

      setClasses(safeArr(rows));
    } catch (err) {
      console.error(err);
      alert("โหลด Class ล่าสุดไม่สำเร็จ");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ✅ auto refresh ตอนเข้า page (กันเคส initialClasses เก่า/ติด cache)
  useEffect(() => {
    refreshClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ auto refresh เมื่อกลับมาที่ tab นี้
  useEffect(() => {
    function onFocus() {
      refreshClasses();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshClasses]);

  // 🔹 state filter + page
  const [search, setSearch] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [title, setTitle] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ✅ preset filter
  const [rangePreset, setRangePreset] = useState("today");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [openMenuId, setOpenMenuId] = useState(null);

  // ปิดเมนูเมื่อคลิกนอกเมนู
  useEffect(() => {
    if (openMenuId === null) return;

    function handleClickOutside(e) {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        !target.closest("[data-class-actions-menu]")
      ) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  // ✅ ตั้ง Default = Today ตอน mount (ครั้งแรก)
  useEffect(() => {
    const today = new Date();
    const iso = toISODate(today);
    setDateFrom(iso);
    setDateTo(iso);
    setRangePreset("today");
  }, []);

  function applyPreset(preset) {
    const today = new Date();
    const end = toISODate(today);

    if (preset === "today") {
      const iso = toISODate(today);
      setDateFrom(iso);
      setDateTo(iso);
      setRangePreset("today");
      setPage(1);
      return;
    }

    if (preset === "week") {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      setDateFrom(toISODate(from));
      setDateTo(end);
      setRangePreset("week");
      setPage(1);
      return;
    }

    if (preset === "month") {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      setDateFrom(toISODate(from));
      setDateTo(end);
      setRangePreset("month");
      setPage(1);
      return;
    }

    setRangePreset("custom");
    setPage(1);
  }

  /* ================== EDIT / DELETE STATE ================== */

  const [editingClass, setEditingClass] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    courseCode: "",
    room: "",
    selectedDays: [],
    dayCount: 1,
  });

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  /* ================== FILTER ================== */

  const filtered = useMemo(() => {
    return safeArr(classes).filter((cls) => {
      const q = search.trim().toLowerCase();
      const cc = courseCode.trim().toLowerCase();
      const tt = title.trim().toLowerCase();

      if (cc && !(cls.courseCode || "").toLowerCase().includes(cc)) {
        return false;
      }
      if (tt && !(cls.title || "").toLowerCase().includes(tt)) {
        return false;
      }

      // ✅ date range filter: ถ้ามี days -> เช็ค overlap
      if (dateFrom || dateTo) {
        const from = dateFrom ? new Date(dateFrom + "T00:00:00") : null;
        const to = dateTo ? new Date(dateTo + "T23:59:59") : null;

        const within = (iso) => {
          const s = normalizeISODate(iso);
          if (!s) return false;
          const d = new Date(s + "T00:00:00");
          if (Number.isNaN(d.getTime())) return false;
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        };

        if (Array.isArray(cls.days) && cls.days.length > 0) {
          if (!cls.days.some(within)) return false;
        } else {
          const dRaw = cls.date || cls.startDate || cls.start_date;
          const dStart = new Date(dRaw);
          if (Number.isNaN(dStart.getTime())) return false;

          const dayCount =
            Number(cls.duration?.dayCount || cls.dayCount || 1) || 1;
          const dEnd = new Date(dStart);
          dEnd.setDate(dEnd.getDate() + (dayCount - 1));
          dEnd.setHours(23, 59, 59, 999);

          // overlap check: [dStart,dEnd] ทับกับ [from,to] ไหม
          if (from && dEnd < from) return false;
          if (to && dStart > to) return false;
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
    let selectedDays = [];

    if (Array.isArray(cls.days) && cls.days.length > 0) {
      selectedDays = cls.days.map(isoToDate).filter(Boolean);
    } else {
      const dayCount =
        cls.duration?.dayCount ||
        cls.dayCount ||
        (Array.isArray(cls.days) ? cls.days.length : cls.days) ||
        1;

      const startStr = normalizeISODate(
        cls.date || cls.startDate || cls.start_date,
      );

      if (startStr) {
        const dStart = isoToDate(startStr);
        if (dStart) {
          selectedDays = Array.from(
            { length: Number(dayCount) || 1 },
            (_, i) => {
              const d = new Date(dStart);
              d.setDate(d.getDate() + i);
              return d;
            },
          );
        }
      }
    }

    selectedDays = uniqueSortDates(selectedDays);

    setEditingClass(cls);
    setEditForm({
      title: cls.title || "",
      courseCode: cls.courseCode || "",
      room: cls.room || cls.roomName || "",
      selectedDays,
      dayCount: Math.max(1, selectedDays.length || 1),
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

    const ok = window.confirm("ยืนยันการบันทึกการแก้ไข Class นี้หรือไม่?");
    if (!ok) return;

    const selected = uniqueSortDates(editForm.selectedDays || []);

    if (selected.length === 0) {
      alert("กรุณาเลือกวันอบรมอย่างน้อย 1 วัน");
      return;
    }

    const days = selected.map(toISODate);
    const startIso = days[0];
    const dayCount = days.length;

    setSaving(true);
    try {
      const payload = {
        title: editForm.title,
        courseCode: editForm.courseCode,
        room: editForm.room,
        days,
        date: startIso,
        dayCount,
      };

      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        console.error("update class failed", data);
        alert(data.error || "บันทึกการแก้ไขไม่สำเร็จ");
        return;
      }

      setClasses((prev) =>
        safeArr(prev).map((c) =>
          (c._id || c.id) === id
            ? {
                ...c,
                title: payload.title,
                courseCode: payload.courseCode,
                room: payload.room,
                roomName: payload.room,
                days,
                date: payload.date || c.date,
                startDate: payload.date || c.startDate,
                dayCount: payload.dayCount,
                duration: {
                  ...(c.duration || {}),
                  dayCount: payload.dayCount,
                },
              }
            : c,
        ),
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

    const ok = window.confirm(
      `ต้องการลบ Class นี้จริงหรือไม่?\n\n${cls.courseCode || ""} - ${cls.title || ""}`,
    );
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/classes/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        console.error("delete class failed", data);
        alert(data.error || "ลบ Class ไม่สำเร็จ");
        return;
      }

      setClasses((prev) => safeArr(prev).filter((c) => (c._id || c.id) !== id));
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-admin-textMuted">ช่วงเวลา:</div>

          <button
            type="button"
            onClick={() => applyPreset("today")}
            className={cx(
              "h-8 rounded-xl px-3 text-xs ring-1 transition",
              rangePreset === "today"
                ? "bg-brand-primary text-white ring-brand-primary"
                : "bg-white text-admin-text ring-admin-border hover:bg-admin-surfaceMuted",
            )}
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => applyPreset("week")}
            className={cx(
              "h-8 rounded-xl px-3 text-xs ring-1 transition",
              rangePreset === "week"
                ? "bg-brand-primary text-white ring-brand-primary"
                : "bg-white text-admin-text ring-admin-border hover:bg-admin-surfaceMuted",
            )}
          >
            Week
          </button>

          <button
            type="button"
            onClick={() => applyPreset("month")}
            className={cx(
              "h-8 rounded-xl px-3 text-xs ring-1 transition",
              rangePreset === "month"
                ? "bg-brand-primary text-white ring-brand-primary"
                : "bg-white text-admin-text ring-admin-border hover:bg-admin-surfaceMuted",
            )}
          >
            Month
          </button>

          <button
            type="button"
            onClick={() => applyPreset("custom")}
            className={cx(
              "h-8 rounded-xl px-3 text-xs ring-1 transition",
              rangePreset === "custom"
                ? "bg-brand-primary text-white ring-brand-primary"
                : "bg-white text-admin-text ring-admin-border hover:bg-admin-surfaceMuted",
            )}
          >
            Custom
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs text-admin-textMuted">
              ทั้งหมด {classes.length} class — หลัง filter เหลือ{" "}
              {filtered.length} class
            </div>

            <button
              type="button"
              onClick={refreshClasses}
              disabled={refreshing}
              className={cx(
                "inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs ring-1 transition",
                refreshing
                  ? "bg-admin-surfaceMuted text-admin-textMuted ring-admin-border"
                  : "bg-white text-admin-text ring-admin-border hover:bg-admin-surfaceMuted",
              )}
              title="โหลดรายการจาก DB ใหม่"
            >
              <RefreshCw
                className={cx("h-4 w-4", refreshing && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              ค้นหา
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              placeholder="ค้นหา (ชื่อ Class / รหัสคอร์ส / ห้อง / อาจารย์)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
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
                setRangePreset("custom");
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
                setRangePreset("custom");
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <div className="w-full overflow-auto max-h-[calc(100vh-240px)]">
        <table className="w-full table-fixed text-base sm:text-sm">
          <thead className="sticky top-0 z-10 bg-admin-surfaceMuted text-[14px] uppercase text-admin-textMuted">
            <tr>
              <th className="w-[200px] px-3 py-2 text-left">วันที่อบรม</th>
              <th className=" px-3 py-2 text-left">ชื่อ CLASS</th>
              <th className="w-[120px] px-3 py-2 text-center">ห้องอบรม</th>
              <th className="w-[200px] px-3 py-2 text-left">ผู้สอน</th>
              <th className="w-[150px] px-3 py-2 text-center">จำนวนนักเรียน</th>
              <th className="w-[100px] px-3 py-2 text-right">จัดการ</th>
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
                  ? cls.instructors[0].name ||
                    cls.instructors[0].fullname ||
                    "-"
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

                  <td className="px-3 py-2 text-admin-textMuted text-center">
                    {room}
                  </td>

                  <td className="px-3 py-2 text-admin-textMuted">
                    {instructor}
                  </td>

                  <td className="px-3 py-2 text-center">{studentCount}</td>

                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full
                          border border-admin-border bg-white text-admin-text
                          hover:bg-admin-surfaceMuted focus:outline-none"
                          aria-label="เมนูการจัดการ"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-32 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                      >
                        <DropdownMenuItem asChild>
                          <Link href={`/a1exqwvCqTXP7s0/admin/classroom/classes/${id}`}>
                            เปิดดู
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem onSelect={() => openEditModal(cls)}>
                          แก้ไข
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onSelect={() => handleDelete(cls)}
                          disabled={deletingId === id}
                        >
                          {deletingId === id ? "กำลังลบ..." : "ลบ"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
      </div>

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
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
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
                      setEditForm((f) => ({ ...f, courseCode: e.target.value }))
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
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-admin-textMuted">
                    ช่วงวันที่อบรม (เลือกข้ามวันได้)
                  </label>

                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cx(
                            "h-9 w-full justify-start rounded-xl border-admin-border bg-white px-3 text-xs font-normal shadow-sm",
                            (!editForm.selectedDays ||
                              editForm.selectedDays.length === 0) &&
                              "text-admin-textMuted",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editForm.selectedDays?.length ? (
                            (() => {
                              const sorted = uniqueSortDates(
                                editForm.selectedDays,
                              );
                              const first = sorted[0];
                              const last = sorted[sorted.length - 1];
                              return (
                                <>
                                  {formatThaiDate(first)} -{" "}
                                  {formatThaiDate(last)}{" "}
                                  <span className="ml-2 text-admin-textMuted">
                                    ({sorted.length} วัน)
                                  </span>
                                </>
                              );
                            })()
                          ) : (
                            <>เลือกวันอบรม (เลือกข้ามวันได้)</>
                          )}
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={8}
                        className="z-[9999] w-auto rounded-2xl p-2"
                      >
                        <Calendar
                          mode="multiple"
                          numberOfMonths={2}
                          selected={editForm.selectedDays}
                          onSelect={(days) => {
                            const arr = uniqueSortDates(
                              Array.isArray(days) ? days : [],
                            );
                            setEditForm((f) => ({
                              ...f,
                              selectedDays: arr,
                              dayCount: Math.max(1, arr.length),
                            }));
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-2 text-xs text-admin-textMuted">
                      <span>จำนวนวัน:</span>
                      <span className="font-semibold text-admin-text">
                        {editForm.dayCount || 1}
                      </span>
                      <span>วัน</span>
                    </div>
                  </div>

                  <div className="mt-1 text-[11px] text-admin-textMuted">
                    * ระบบจะคำนวณจำนวนวันอัตโนมัติจาก “จำนวนวันที่เลือก”
                  </div>
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
