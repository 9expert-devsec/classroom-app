// src/app/admin/classroom/food/report/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

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

/* ---------- Modal Preview สำหรับ Export / Print ---------- */

function FoodReportPreviewModal({ open, onClose, groups, date }) {
  if (!open) return null;

  const dateLabel = formatThaiDate(date);

  function handlePrint() {
    const title = `Food Report - ${dateLabel}`;

    const htmlRows = groups
      .map((g) => {
        const header =
          (g.courseCode || "") +
          (g.courseName || g.classTitle
            ? " - " + (g.courseName || g.classTitle)
            : "");

        const rows = g.students
          .map((row, idx) => {
            // รองรับทั้ง array และ string
            const addonsText = Array.isArray(row.addons)
              ? row.addons.length
                ? row.addons.join(", ")
                : "-"
              : row.addons || "-";

            return `
              <tr>
                <td style="border:1px solid #000;padding:4px;text-align:center;">${
                  idx + 1
                }</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.studentThaiName || row.studentEngName || "-"
                }</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.company || "-"
                }</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.restaurantName || "-"
                }</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.menuName || "-"
                }</td>
                <td style="border:1px solid #000;padding:4px;">${addonsText}</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.drink || "-"
                }</td>
                <td style="border:1px solid #000;padding:4px;">${
                  row.note || "-"
                }</td>
              </tr>
            `;
          })
          .join("");

        return `
          <h3 style="margin-top:24px;margin-bottom:4px;font-size:16px;">
            ${header || "ไม่ระบุ Class"}
          </h3>
          <div style="font-size:12px;margin-bottom:4px;">
            ผู้เรียนทั้งหมด ${g.students.length} คน
          </div>
          <table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:16px;">
            <thead>
              <tr>
                <th style="border:1px solid #000;padding:4px;">#</th>
                <th style="border:1px solid #000;padding:4px;">ชื่อผู้เรียน</th>
                <th style="border:1px solid #000;padding:4px;">บริษัท</th>
                <th style="border:1px solid #000;padding:4px;">ร้านอาหาร</th>
                <th style="border:1px solid #000;padding:4px;">เมนู</th>
                <th style="border:1px solid #000;padding:4px;">Add-on</th>
                <th style="border:1px solid #000;padding:4px;">เครื่องดื่ม</th>
                <th style="border:1px solid #000;padding:4px;">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      })
      .join("");

    const win = window.open("", "_blank");
    win.document.write(`
      <html>
        <head>
          <title>${title}</title>
        </head>
        <body style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;padding:24px;">
          <div style="font-size:12px;margin-bottom:8px;">
            ${new Date().toLocaleString("th-TH")}
          </div>
          <h2 style="margin:0 0 4px 0;">Food Report</h2>
          <div style="font-size:13px;margin-bottom:12px;">
            วันที่ ${dateLabel}
          </div>
          ${htmlRows}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function handleExportExcel() {
    const wb = XLSX.utils.book_new();

    groups.forEach((g, idx) => {
      const sheetName = (
        g.courseCode ||
        g.classTitle ||
        `Class${idx + 1}`
      ).substring(0, 28);

      const rows = g.students.map((row, i) => ({
        "#": i + 1,
        ชื่อผู้เรียน: row.studentThaiName || row.studentEngName || "",
        บริษัท: row.company || "",
        ร้านอาหาร: row.restaurantName || "",
        เมนู: row.menuName || "",
        "Add-on": Array.isArray(row.addons)
          ? row.addons.join(", ")
          : row.addons || "",
        เครื่องดื่ม: row.drink || "",
        หมายเหตุ: row.note || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || `Class${idx + 1}`);
    });

    XLSX.writeFile(wb, `FoodReport-${date}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="max-h-[90vh] w-[1100px] max-w-[95vw] overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-gray-500">
              {new Date().toLocaleString("th-TH")}
            </div>
            <h2 className="text-lg font-semibold">Food Report</h2>
            <div className="text-xs text-gray-500">
              วันที่ {formatThaiDate(date)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Export เป็น Excel
            </button>
            <button
              onClick={handlePrint}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              สั่ง Print
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300"
            >
              ปิด
            </button>
          </div>
        </div>

        {groups.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">
            ไม่มีข้อมูลอาหารสำหรับวันที่เลือก
          </div>
        )}

        {groups.map((g) => {
          const header =
            (g.courseCode || "") +
            (g.courseName || g.classTitle
              ? " - " + (g.courseName || g.classTitle)
              : "");
          return (
            <div key={g.classId || header} className="mb-6">
              <div className="mb-1 text-sm font-semibold text-gray-800">
                {header || "ไม่ระบุ Class"}
              </div>
              <div className="mb-2 text-xs text-gray-500">
                ผู้เรียนทั้งหมด {g.students.length} คน
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">ชื่อผู้เรียน</th>
                      <th className="px-3 py-2 text-left">บริษัท</th>
                      <th className="px-3 py-2 text-left">ร้านอาหาร</th>
                      <th className="px-3 py-2 text-left">เมนู</th>
                      <th className="px-3 py-2 text-left">Add-on</th>
                      <th className="px-3 py-2 text-left">เครื่องดื่ม</th>
                      <th className="px-3 py-2 text-left">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.students.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="border-t border-gray-200"
                      >
                        <td className="px-3 py-1.5">{idx + 1}</td>
                        <td className="px-3 py-1.5">
                          {row.studentThaiName || row.studentEngName || (
                            <span className="text-admin-textMuted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.company || (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.restaurantName || (
                            <span className="text-admin-textMuted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.menuName || (
                            <span className="text-admin-textMuted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.addons &&
                          String(row.addons).trim().length > 0 ? (
                            row.addons
                          ) : (
                            <span className="text-admin-textMuted">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.drink || (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {row.note || <span className="text-gray-400">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------- หน้า Food Report หลัก ---------------------- */

export default function FoodReportPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [classOptions, setClassOptions] = useState([]);
  const [classFilter, setClassFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  // โหลด class สำหรับ dropdown
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/admin/classes?limit=9999", {
          cache: "no-store",
        });
        const data = await res.json();
        const items =
          data.items || data.data || (Array.isArray(data) ? data : []);
        setClassOptions(items);
      } catch (e) {
        console.error("load classes error", e);
      }
    }
    loadClasses();
  }, []);

  // โหลด food orders ตามวันที่ + classFilter
  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("date", date);
        if (classFilter && classFilter !== "all") {
          params.set("classId", classFilter);
        }
        const res = await fetch(`/api/admin/food-orders?${params.toString()}`);
        const data = await res.json();
        setOrders(data.items || []);
      } catch (e) {
        console.error("load food-orders error", e);
        setOrders([]);
      }
      setLoading(false);
    }

    if (date) {
      loadOrders();
    }
  }, [date, classFilter]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;

    return orders.filter((o) => {
      const hay = [
        o.studentThaiName,
        o.studentEngName,
        o.company,
        o.restaurantName,
        o.menuName,
        o.addons,
        o.drink,
        o.note,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, search]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) {
      const key = o.classId || "no-class";
      if (!map.has(key)) {
        map.set(key, {
          classId: o.classId,
          classTitle: o.classTitle,
          courseCode: o.courseCode,
          courseName: o.courseName,
          students: [],
        });
      }
      map.get(key).students.push(o);
    }
    return Array.from(map.values());
  }, [filteredOrders]);

  const totalStudentCount = groups.reduce(
    (sum, g) => sum + g.students.length,
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Food Report</h1>
        <p className="text-sm text-admin-textMuted">
          รายงานรายการอาหารตาม Class แยกตามผู้เรียน ในแต่ละวัน
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl bg-admin-surface p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              วันที่
            </label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              Class
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">ทุก Class</option>
              {classOptions.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.courseCode
                    ? `${c.courseCode} - ${c.courseName || c.title || ""}`
                    : c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              ค้นหา (ชื่อผู้เรียน / ร้าน / เมนู / หมายเหตุ)
            </label>
            <input
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="พิมพ์คำที่ต้องการค้นหา..."
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-admin-border pt-3 text-xs text-admin-textMuted sm:flex-row sm:items-center sm:justify-between">
          <div>
            พบผู้เรียน {totalStudentCount} คน ใน {groups.length} class
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Export เป็น Excel
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg border border-admin-border px-3 py-1.5 text-xs font-medium hover:bg-admin-surfaceMuted"
            >
              สั่ง Print
            </button>
          </div>
        </div>
      </div>

      {/* ตารางบนหน้าปกติ */}
      <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
        {loading && (
          <div className="py-10 text-center text-xs text-admin-textMuted">
            กำลังโหลดข้อมูล...
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="py-10 text-center text-xs text-admin-textMuted">
            ไม่มีข้อมูลอาหารสำหรับวันที่เลือก
          </div>
        )}

        {!loading &&
          groups.map((g) => {
            const header =
              (g.courseCode || "") +
              (g.courseName || g.classTitle
                ? " - " + (g.courseName || g.classTitle)
                : "");
            return (
              <div key={g.classId || header} className="mb-6">
                <div className="mb-1 text-sm font-semibold text-admin-text">
                  {header || "ไม่ระบุ Class"}
                </div>
                <div className="mb-2 text-[11px] text-admin-textMuted">
                  ผู้เรียนทั้งหมด {g.students.length} คน
                </div>
                <div className="overflow-hidden rounded-xl border border-admin-border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-admin-surfaceMuted text-[11px] uppercase text-admin-textMuted">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">ชื่อผู้เรียน</th>
                        <th className="px-3 py-2 text-left">บริษัท</th>
                        <th className="px-3 py-2 text-left">ร้านอาหาร</th>
                        <th className="px-3 py-2 text-left">เมนู</th>
                        <th className="px-3 py-2 text-left">Add-on</th>
                        <th className="px-3 py-2 text-left">เครื่องดื่ม</th>
                        <th className="px-3 py-2 text-left">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.students.map((row, idx) => (
                        <tr
                          key={row.id || idx}
                          className="border-t border-admin-border"
                        >
                          <td className="px-3 py-1.5">{idx + 1}</td>
                          <td className="px-3 py-1.5">
                            {row.studentThaiName || row.studentEngName || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.company || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.restaurantName || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.menuName || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.addons &&
                            String(row.addons).trim().length > 0 ? (
                              row.addons
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.drink || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.note || (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
      </div>

      {/* Popup Preview */}
      <FoodReportPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        groups={groups}
        date={date}
      />
    </div>
  );
}
