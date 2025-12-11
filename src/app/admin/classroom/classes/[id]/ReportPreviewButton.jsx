// src/app/admin/classroom/classes/[id]/ReportPreviewButton.jsx
"use client";

import { useMemo, useState } from "react";

/* ===== helpers ===== */

function formatDateTH(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatTimeTH(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function getDayLabel(stu, day) {
  const checked = stu.checkin?.[`day${day}`];
  if (!checked) return "";
  const timeRaw =
    stu.checkinTimes?.[`day${day}`] || stu.checkins?.[day]?.time || null;
  const timeLabel = formatTimeTH(timeRaw);
  return timeLabel ? `✔ ${timeLabel}` : "✔";
}

function getStatusLabel(stu) {
  if (!stu.statusLabel || stu.statusLabel === "-") return "";
  return stu.statusLabel;
}

/* ========================================= */

export default function ReportPreviewButton({
  students = [],
  dayCount = 1,
  classInfo,
}) {
  const [open, setOpen] = useState(false);

  const days = useMemo(
    () => Array.from({ length: dayCount || 1 }, (_, i) => i + 1),
    [dayCount]
  );

  const courseTitle =
    classInfo?.courseTitle || classInfo?.course_name || classInfo?.title || "";

  const courseCode =
    classInfo?.courseCode || classInfo?.course_code || classInfo?.code || "";

  const classCode = classInfo?.classCode || classInfo?.class_code || "";

  const roomName =
    classInfo?.roomName ||
    classInfo?.room_name ||
    classInfo?.classroomName ||
    classInfo?.classroom ||
    classInfo?.room ||
    classInfo?.roomTitle ||
    classInfo?.roomInfo?.nameTH ||
    classInfo?.roomInfo?.name ||
    "";

  const studentsCount = students.length;

  /* ========== Export Excel (CSV) ========== */
  function handleExportExcel() {
    if (!students.length) {
      alert("ยังไม่มีรายชื่อนักเรียนสำหรับ Export");
      return;
    }

    const headers = [
      "#",
      "ชื่อ-สกุล (TH)",
      "ชื่อ-สกุล (EN)",
      "บริษัท",
      "เลขใบเสร็จ",
      "ช่องทางรับเอกสาร",
      "วันที่รับเอกสาร",
      ...days.map((d) => `DAY ${d}`),
      "สถานะสาย",
    ];

    const rows = students.map((stu, idx) => {
      const dayLabels = days.map((d) => getDayLabel(stu, d));
      return [
        idx + 1,
        stu.nameTH || stu.name || "",
        stu.nameEN || "",
        stu.company || "",
        stu.paymentRef || "",
        stu.receiveType || "",
        stu.receiveDate ? formatDateTH(stu.receiveDate) : "",
        ...dayLabels,
        getStatusLabel(stu),
      ];
    });

    const all = [headers, ...rows];
    const csv = all
      .map((row) =>
        row
          .map((cell) => {
            const text = (cell ?? "").toString().replace(/"/g, '""');
            return `"${text}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = `class-report_${courseCode || "class"}_${
      classCode || ""
    }.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ========== Print ========== */
  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;

    const now = new Date();
    const generatedAt = now.toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    });

    const headTitle = courseTitle || courseCode || "Class Report";
    const roomLine = roomName ? `ห้อง ${roomName}` : "";
    const studentLine = `ผู้เรียนทั้งหมด ${studentsCount} คน`;

    const tableHeader = `
      <tr>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">#</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">ชื่อ-สกุล (TH)</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">ชื่อ-สกุล (EN)</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">บริษัท</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">เลขใบเสร็จ</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">ช่องทางรับเอกสาร</th>
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">วันที่รับเอกสาร</th>
        ${days
          .map(
            (d) =>
              `<th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">DAY ${d}</th>`
          )
          .join("")}
        <th style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">สถานะสาย</th>
      </tr>
    `;

    const tableRows = students
      .map((stu, idx) => {
        const dayCells = days
          .map(
            (d) =>
              `<td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;text-align:center;">${getDayLabel(
                stu,
                d
              )}</td>`
          )
          .join("");

        return `
          <tr>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;text-align:right;">${
              idx + 1
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.nameTH || stu.name || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.nameEN || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.company || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.paymentRef || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.receiveType || ""
            }</td>
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${
              stu.receiveDate ? formatDateTH(stu.receiveDate) : ""
            }</td>
            ${dayCells}
            <td style="border:1px solid #ddd;padding:4px 6px;font-size:11px;">${getStatusLabel(
              stu
            )}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charSet="utf-8" />
          <title>Class Report</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 12px;
              color: #111827;
              margin: 20px;
            }
            h1 {
              font-size: 16px;
              margin: 0 0 4px 0;
            }
            .sub {
              font-size: 12px;
              margin: 0;
            }
            .meta {
              font-size: 11px;
              margin: 4px 0 10px 0;
              color: #6b7280;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
          </style>
        </head>
        <body>
          <div style="text-align:center;margin-bottom:8px;font-size:11px;color:#6b7280;">
            ${generatedAt} – Class Report
          </div>

          <div style="margin-bottom:12px;">
            <h1>${headTitle}</h1>
            ${roomLine ? `<p class="sub">${roomLine}</p>` : ""}
            <p class="sub">${studentLine}</p>
          </div>

          <table>
            <thead>${tableHeader}</thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  /* ========== UI Preview Modal ========== */

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-admin-border px-3 py-1.5 text-xs text-admin-text hover:bg-admin-surfaceMuted"
      >
        ดูตัวอย่างรายงาน / Export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-[95vw] max-w-5xl overflow-auto rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* header */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-admin-textMuted">
                  PREVIEW รายงานห้องอบรม
                </div>
                <div className="text-sm font-semibold text-admin-text">
                  {courseTitle || courseCode || "ไม่ระบุชื่อคอร์ส"}
                </div>
                <div className="text-xs text-admin-textMuted">
                  {roomName && <>ห้อง {roomName}</>} • ผู้เรียนทั้งหมด{" "}
                  {studentsCount} คน
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
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
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black"
                >
                  ปิด
                </button>
              </div>
            </div>

            {/* table preview */}
            <div className="overflow-auto rounded-xl border border-admin-border">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-admin-surfaceMuted text-[11px] text-admin-text">
                  <tr>
                    <th className="border border-admin-border px-2 py-1 text-center">
                      #
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      ชื่อ-สกุล (TH)
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      ชื่อ-สกุล (EN)
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      บริษัท
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      เลขใบเสร็จ
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      ช่องทางรับเอกสาร
                    </th>
                    <th className="border border-admin-border px-2 py-1 text-left">
                      วันที่รับเอกสาร
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        className="border border-admin-border px-2 py-1 text-center"
                      >
                        DAY {d}
                      </th>
                    ))}
                    <th className="border border-admin-border px-2 py-1 text-left">
                      สถานะสาย
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((stu, idx) => (
                    <tr key={stu._id || idx}>
                      <td className="border border-admin-border px-2 py-1 text-right">
                        {idx + 1}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.nameTH || stu.name || ""}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.nameEN || ""}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.company || ""}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.paymentRef || ""}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.receiveType || ""}
                      </td>
                      <td className="border border-admin-border px-2 py-1">
                        {stu.receiveDate ? formatDateTH(stu.receiveDate) : "-"}
                      </td>
                      {days.map((d) => (
                        <td
                          key={d}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          {getDayLabel(stu, d) || "-"}
                        </td>
                      ))}
                      <td className="border border-admin-border px-2 py-1">
                        {getStatusLabel(stu) || "-"}
                      </td>
                    </tr>
                  ))}

                  {students.length === 0 && (
                    <tr>
                      <td
                        colSpan={7 + days.length + 1}
                        className="border border-admin-border px-2 py-4 text-center text-admin-textMuted"
                      >
                        ยังไม่มีรายชื่อนักเรียน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
