// src/app/admin/classroom/food/report/FoodReportClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

function formatDateTH(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/**
 * order รูปแบบที่เราคาดหวังจาก API
 * {
 *   _id,
 *   date,              // วันที่
 *   classId,
 *   className,
 *   courseCode,
 *   roomName,
 *   studentName,
 *   restaurantName,
 *   menuName,
 *   addons: [string],
 *   drink,
 *   note,
 * }
 */

export default function FoodReportClient({ initialDate, initialOrders }) {
  const [date, setDate] = useState(initialDate);
  const [orders, setOrders] = useState(initialOrders || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  // โหลดใหม่เมื่อเปลี่ยนวันที่
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (date) qs.set("date", date);
        const res = await fetch(`/api/admin/food-orders?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setOrders(data.items || data.data || (Array.isArray(data) ? data : []));
      } catch (err) {
        console.error(err);
        alert("โหลดข้อมูล Food Report ไม่สำเร็จ");
      }
      setLoading(false);
    }
    load();
  }, [date]);

  // รายชื่อ class สำหรับ filter
  const classOptions = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          className: o.className || "-",
          courseCode: o.courseCode || "",
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  // filter ตาม search / classFilter
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (classFilter && (o.classId || o.className) !== classFilter) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        o.studentName,
        o.className,
        o.courseCode,
        o.restaurantName,
        o.menuName,
        o.drink,
        o.note,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [orders, search, classFilter]);

  // group ตาม class
  const groups = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          key,
          className: o.className || "-",
          courseCode: o.courseCode || "",
          roomName: o.roomName || "",
          items: [],
        });
      }
      map.get(key).items.push(o);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className, "th")
    );
  }, [filteredOrders]);

  /* ===== Export Excel (CSV) ===== */
  function handleExport() {
    if (!filteredOrders.length) {
      alert("ยังไม่มีข้อมูลสำหรับ Export");
      return;
    }

    const headers = [
      "วันที่",
      "รหัสคอร์ส",
      "ชื่อ Class",
      "ห้อง",
      "ชื่อผู้เรียน",
      "ร้านอาหาร",
      "เมนู",
      "Add-on",
      "เครื่องดื่ม",
      "หมายเหตุ",
    ];

    const rows = filteredOrders.map((o) => [
      formatDateTH(o.date || date),
      o.courseCode || "",
      o.className || "",
      o.roomName || "",
      o.studentName || "",
      o.restaurantName || "",
      o.menuName || "",
      Array.isArray(o.addons) ? o.addons.join(" / ") : "",
      o.drink || "",
      o.note || "",
    ]);

    const all = [headers, ...rows];
    const csv = all
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const labelDate = date || new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `food-report_${labelDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ===== Print ===== */
  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;

    const thDate = formatDateTH(date);
    const generatedAt = new Date().toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const sectionsHtml = groups
      .map((g) => {
        const rowsHtml = g.items
          .map(
            (o, idx) => `
          <tr>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;text-align:right;">${
              idx + 1
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              o.studentName || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              o.restaurantName || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              o.menuName || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              Array.isArray(o.addons) ? o.addons.join(" / ") : ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              o.drink || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              o.note || ""
            }</td>
          </tr>
        `
          )
          .join("");

        return `
          <h2 style="font-size:14px;margin:18px 0 4px 0;">
            ${g.courseCode ? `${g.courseCode} – ` : ""}${g.className}
          </h2>
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">
            ${g.roomName ? `ห้อง ${g.roomName} • ` : ""}ผู้เรียน ${
          g.items.length
        } คน
          </div>
          <table style="border-collapse:collapse;width:100%;margin-bottom:8px;">
            <thead>
              <tr>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">#</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">ชื่อผู้เรียน</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">ร้านอาหาร</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">เมนู</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">Add-on</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">เครื่องดื่ม</th>
                <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="7" style="border:1px solid #ddd;padding:6px;font-size:11px;text-align:center;color:#9ca3af;">ไม่มีข้อมูล</td></tr>`}
            </tbody>
          </table>
        `;
      })
      .join("<hr style='margin:12px 0;border:none;border-top:1px solid #e5e7eb;' />");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charSet="utf-8" />
          <title>Food Report</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 12px;
              color: #111827;
              margin: 20px;
            }
          </style>
        </head>
        <body>
          <div style="text-align:center;font-size:11px;color:#6b7280;margin-bottom:8px;">
            ${generatedAt} – Food Report (${thDate})
          </div>
          ${sectionsHtml || `<div style="font-size:12px;color:#6b7280;">ไม่มีข้อมูลอาหารสำหรับวันนี้</div>`}
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-card">
      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-[11px] text-admin-textMuted">
              วันที่
            </label>
            <input
              type="date"
              className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] text-admin-textMuted">
              Class
            </label>
            <select
              className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">ทุก Class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode ? `${c.courseCode} – ` : ""}
                  {c.className}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 md:items-end">
          <input
            className="w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary md:w-72"
            placeholder="ค้นหา (ชื่อผู้เรียน / ร้าน / เมนู / หมายเหตุ)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Export เป็น Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full border border-admin-border px-4 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
            >
              สั่ง Print
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mb-3 text-xs text-admin-textMuted">
          กำลังโหลดข้อมูล...
        </div>
      )}

      {/* Grouped tables */}
      {groups.length === 0 && !loading && (
        <div className="py-6 text-center text-sm text-admin-textMuted">
          ไม่มีข้อมูลอาหารสำหรับวันที่เลือก
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div
            key={g.key}
            className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-admin-text">
                  {g.courseCode && (
                    <span className="mr-1 text-admin-textMuted">
                      {g.courseCode}
                    </span>
                  )}
                  {g.className}
                </div>
                <div className="text-[11px] text-admin-textMuted">
                  {g.roomName && <>ห้อง {g.roomName} • </>}
                  ผู้เรียน {g.items.length} คน
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-admin-surfaceMuted text-[11px] text-admin-textMuted">
                  <tr>
                    <th className="border border-admin-border px-2 py-1 text-center">
                      #
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      ชื่อผู้เรียน
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      ร้านอาหาร
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      เมนู
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      Add-on
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      เครื่องดื่ม
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((o, idx) => (
                    <tr key={o._id || idx}>
                      <td className="border border-admin-border px-2 py-1 text-center">
                        {idx + 1}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {o.studentName || "-"}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {o.restaurantName || "-"}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {o.menuName || "-"}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {Array.isArray(o.addons)
                          ? o.addons.join(" / ")
                          : "-"}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {o.drink || "-"}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {o.note || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
