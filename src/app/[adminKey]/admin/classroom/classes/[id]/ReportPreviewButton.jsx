// src/app/admin/classroom/classes/[id]/ReportPreviewButton.jsx
"use client";

import { useMemo, useState } from "react";
import SecondaryButton from "@/components/ui/SecondaryButton";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/* ================= helpers ================= */

function clean(s) {
  return String(s ?? "").trim();
}

function norm(s) {
  return clean(s).toLowerCase();
}

function getStudentName(stu) {
  return (
    clean(stu?.name) ||
    clean(stu?.thaiName) ||
    clean(stu?.engName) ||
    clean(stu?.nameTH) ||
    clean(stu?.nameEN) ||
    "-"
  );
}

function getStudentNameEN(stu) {
  return clean(stu?.nameEN) || clean(stu?.engName) || "";
}

function shouldShowENLine(stu) {
  const main = getStudentName(stu);
  const en = getStudentNameEN(stu);
  if (!en) return false;
  if (norm(en) === norm(main)) return false;
  return true;
}

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

function formatDateTimeTH(input) {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function downloadCsv(csvText, filename) {
  // ✅ ใส่ BOM กันภาษาไทยเพี้ยนใน Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ================= receive (3.1) helpers ================= */

function getReceiveTypeRaw(stu) {
  return clean(stu?.documentReceiveType) || clean(stu?.receiveType) || "";
}

function receiveTypeLabel(raw) {
  const x = String(raw || "").trim();
  if (!x) return "-";
  if (x === "on_class" || x === "on_site") return "มารับ ณ วันอบรม";
  if (x === "ems") return "ส่งทางไปรษณีย์";
  return x;
}

function getReceivedAt(stu) {
  return stu?.documentReceivedAt || stu?.receiveDate || null;
}

function getReceiveSignatureUrl(stu) {
  return (
    clean(stu?.documentReceiptSigUrl) ||
    clean(stu?.documentReceiveSigUrl) ||
    clean(stu?.documentSignatureUrl) ||
    clean(stu?.documentSigUrl) ||
    clean(stu?.receiveSignatureUrl) ||
    clean(stu?.receiveSigUrl) ||
    clean(stu?.documentReceiptSig?.url) ||
    clean(stu?.documentReceiveSig?.url) ||
    clean(stu?.receiveSig?.url) ||
    ""
  );
}

/* ================= staff receive (3.2) helpers ================= */

function getStaffReceiveUpdatedAt(stu) {
  return (
    stu?.staffReceiveUpdatedAt ||
    stu?.staffReceiveStaffSignedAt ||
    stu?.staffReceiveCustomerSignedAt ||
    null
  );
}

function getStaffReceiveCustomerSigUrl(stu) {
  return (
    clean(stu?.staffReceiveCustomerSigUrl) ||
    clean(stu?.staffReceiveCustomerSig?.url) ||
    clean(stu?.staffReceiveCustomerSig?.receiptSig?.url) ||
    ""
  );
}

function getStaffReceiveStaffSigUrl(stu) {
  return (
    clean(stu?.staffReceiveStaffSigUrl) ||
    clean(stu?.staffReceiveStaffSig?.url) ||
    ""
  );
}

function getStaffReceiveItems(stu) {
  const it = stu?.staffReceiveItems || null;
  if (!it) return null;
  return {
    check: !!it.check,
    withholding: !!it.withholding,
    other: clean(it.other),
  };
}

function staffItemsLabel(items) {
  if (!items) return "";
  const parts = [];
  if (items.check) parts.push("เช็ค");
  if (items.withholding) parts.push("หัก ณ ที่จ่าย");
  if (items.other) parts.push(`อื่นๆ: ${items.other}`);
  return parts.join(" • ");
}

/* ================= check-in helpers (รองรับหลาย shape) ================= */

function getCheckinInfo(stu, day) {
  const key = `day${day}`;
  const byNum = stu?.checkins?.[day];
  const byStrNum = stu?.checkins?.[String(day)];
  const byDayKey = stu?.checkins?.[key];

  // ✅ รองรับ API ใหม่ที่ส่ง checkinDaily[]
  if (Array.isArray(stu?.checkinDaily)) {
    const found = stu.checkinDaily.find((x) => Number(x.day) === Number(day));
    if (found && found.checkedIn) {
      return {
        signatureUrl: found.signatureUrl,
        time: found.time,
        isLate: found.isLate,
      };
    }
  }

  return byNum || byStrNum || byDayKey || null;
}

function getCheckinChecked(stu, day) {
  if (Array.isArray(stu?.checkinDaily)) {
    const found = stu.checkinDaily.find((x) => Number(x.day) === Number(day));
    return Boolean(found?.checkedIn);
  }
  const key = `day${day}`;
  return Boolean(stu?.checkin?.[key] ?? stu?.checkinStatus?.[key] ?? false);
}

function getCheckinTimeRaw(stu, day) {
  const key = `day${day}`;
  const info = getCheckinInfo(stu, day);
  return stu?.checkinTimes?.[key] || info?.time || null;
}

function getCheckinSignatureUrl(stu, day) {
  const info = getCheckinInfo(stu, day);
  return clean(info?.signatureUrl) || clean(stu?.signatureUrl) || "";
}

function getIsLateForDay(stu, day) {
  const info = getCheckinInfo(stu, day);
  return Boolean(info?.isLate ?? stu?.isLate ?? stu?.late ?? false);
}

/* ================= aggregates ================= */

function countCheckedDays(stu, dayCount) {
  let c = 0;
  for (let d = 1; d <= (dayCount || 1); d++) {
    if (getCheckinChecked(stu, d)) c++;
  }
  return c;
}

function countLateDays(stu, dayCount) {
  let c = 0;
  for (let d = 1; d <= (dayCount || 1); d++) {
    if (getCheckinChecked(stu, d) && getIsLateForDay(stu, d)) c++;
  }
  return c;
}

/* ================= print helpers ================= */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waitImagesThenPrint(win, timeoutMs = 1500) {
  try {
    const doc = win.document;
    const imgs = Array.from(doc.images || []);
    if (!imgs.length) {
      setTimeout(() => win.print(), 50);
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setTimeout(() => win.print(), 50);
    };

    let remaining = imgs.length;
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) finish();
    };

    imgs.forEach((img) => {
      if (img.complete) return onOne();
      img.addEventListener("load", onOne, { once: true });
      img.addEventListener("error", onOne, { once: true });
    });

    setTimeout(finish, timeoutMs);
  } catch {
    setTimeout(() => win.print(), 200);
  }
}

/* ================================================= */

export default function ReportPreviewButton({
  students = [],
  dayCount = 1,
  classInfo,
}) {
  const [open, setOpen] = useState(false);
  //const [mode, setMode] = useState("checkin"); // "checkin" | "signature"
  const [tab, setTab] = useState("checkin"); // "checkin" | "signature"

  const days = useMemo(
    () => Array.from({ length: dayCount || 1 }, (_, i) => i + 1),
    [dayCount],
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

  // function openCheckinReport() {
  //   setMode("checkin");
  //   setOpen(true);
  // }

  // function openSignatureReport() {
  //   setMode("signature");
  //   setOpen(true);
  // }

  function openReport() {
    setTab("checkin");
    setOpen(true);
  }

  /* ================= Export CSV ================= */

  function exportCheckinCsv() {
    if (!students.length) {
      alert("ยังไม่มีรายชื่อนักเรียนสำหรับ Export");
      return;
    }

    const headers = [
      "ลำดับ",
      "ชื่อ-สกุล",
      "บริษัท",
      "เลขที่ QT/IV/RP",
      "เช็กอิน (วัน)",
      "มาสาย (วัน)",
      ...days.map((d) => `DAY ${d} เวลา`),
      ...days.map((d) => `ลายเซ็น DAY ${d} (URL)`),
    ];

    const rows = students.map((stu, idx) => {
      const checkedDays = countCheckedDays(stu, dayCount);
      const lateDays = countLateDays(stu, dayCount);
      const timeCells = days.map((d) => {
        if (!getCheckinChecked(stu, d)) return "";
        const t = formatTimeTH(getCheckinTimeRaw(stu, d));
        const isLate = getIsLateForDay(stu, d);
        return `${isLate ? "LATE " : ""}${t || "✓"}`.trim();
      });
      const sigCells = days.map((d) => {
        if (!getCheckinChecked(stu, d)) return "";
        return getCheckinSignatureUrl(stu, d) || "";
      });

      return [
        idx + 1,
        getStudentName(stu),
        stu.company || "",
        stu.paymentRef || "",
        checkedDays,
        lateDays,
        ...timeCells,
        ...sigCells,
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
          .join(","),
      )
      .join("\r\n");

    const filename = `รายงานเช็กอิน_${courseCode || "class"}_${
      classCode || ""
    }.csv`;
    downloadCsv(csv, filename);
  }

  function exportSignatureCsv() {
    if (!students.length) {
      alert("ยังไม่มีรายชื่อนักเรียนสำหรับ Export");
      return;
    }

    const headers = [
      "ลำดับ",
      "ชื่อ-สกุล",
      "บริษัท",
      "เลขที่ QT/IV/RP",
      "ช่องทางรับเอกสาร (3.1)",
      "วัน-เวลารับเอกสาร (3.1)",
      "ลายเซ็นรับเอกสาร (3.1) (URL)",
      "บันทึกเมื่อ (3.2)",
      "รายการ (3.2)",
      "ลายเซ็นลูกค้า (3.2) (URL)",
      "ลายเซ็นจนท. (3.2) (URL)",
    ];

    const rows = students.map((stu, idx) => {
      const receiveTypeText = receiveTypeLabel(getReceiveTypeRaw(stu));
      const receivedAt = getReceivedAt(stu);
      const receiveSigUrl = getReceiveSignatureUrl(stu);

      const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
      const staffItemsText = staffItemsLabel(getStaffReceiveItems(stu));
      const staffCustomerUrl = getStaffReceiveCustomerSigUrl(stu);
      const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);

      return [
        idx + 1,
        getStudentName(stu),
        stu.company || "",
        stu.paymentRef || "",
        receiveTypeText || "",
        receivedAt ? formatDateTimeTH(receivedAt) : "",
        receiveSigUrl || "",
        staffUpdatedAt ? formatDateTimeTH(staffUpdatedAt) : "",
        staffItemsText || "",
        staffCustomerUrl || "",
        staffStaffUrl || "",
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
          .join(","),
      )
      .join("\r\n");

    const filename = `รายงานลายเซ็น_${courseCode || "class"}_${
      classCode || ""
    }.csv`;
    downloadCsv(csv, filename);
  }

  function handleExportCsv() {
    if (tab === "signature") exportSignatureCsv();
    else exportCheckinCsv();
  }

  /* ================= Print ================= */

  function buildPrintHead({ title, subtitle, generatedAt }) {
    return `
      <div class="topline">
        <div>${escapeHtml(generatedAt)}</div>
        <div>${escapeHtml(title)}</div>
      </div>
      <div class="titleblock">
        <div class="h1">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
      </div>
    `;
  }

  function basePrintCss() {
    return `
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 12px;
          color: #111827;
        }
        .topline{
          display:flex;
          justify-content:space-between;
          font-size:11px;
          color:#6b7280;
          margin-bottom:8px;
        }
        .titleblock{ margin-bottom:10px; }
        .h1{ font-size:18px; font-weight:800; margin:0; }
        .sub{ margin-top:4px; font-size:12px; color:#374151; }
        table{ border-collapse:collapse; width:100%; }
        th, td{ border:1px solid #e5e7eb; padding:5px 6px; vertical-align:top; }
        th{ background:#f3f4f6; font-size:11px; text-align:center; }
        td{ font-size:11px; }
        .right{ text-align:right; }
        .center{ text-align:center; }
        .muted{ color:#6b7280; }
        .badgeLate{ color:#b91c1c; font-weight:800; }
        .badgeOk{ color:#047857; font-weight:800; }
        .sigImg{
          display:block;
          height:38px;
          width:120px;
          object-fit:contain;
          margin:0 auto;
        }
        .sigImgSm{
          display:block;
          height:30px;
          width:100px;
          object-fit:contain;
          margin:0 auto;
        }
        .nowrap{ white-space:nowrap; }
      </style>
    `;
  }

  function printCheckinReport() {
    const w = window.open("", "_blank");
    if (!w) return;

    const now = new Date();
    const generatedAt = now.toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    });

    const title = courseTitle || courseCode || "รายงานเช็กอิน";
    const subtitle = `${roomName ? `ห้อง ${roomName} • ` : ""}ผู้เรียนทั้งหมด ${
      studentsCount || 0
    } คน`;

    const thead = `
      <tr>
        <th style="width:24px;">ลำดับ</th>
        <th style="text-align:left;">ชื่อ-สกุล</th>
        <th style="text-align:left;">บริษัท</th>
        <th class="nowrap">เช็กอิน (วัน)</th>
        <th class="nowrap">มาสาย (วัน)</th>
        ${days.map((d) => `<th class="nowrap">DAY ${d}</th>`).join("")}
      </tr>
    `;

    const rows = students
      .map((stu, idx) => {
        const name = getStudentName(stu);
        const nameEn = shouldShowENLine(stu) ? getStudentNameEN(stu) : "";
        const checkedDays = countCheckedDays(stu, dayCount);
        const lateDays = countLateDays(stu, dayCount);

        // const dayCells = days
        //   .map((d) => {
        //     if (!getCheckinChecked(stu, d)) {
        //       return `<td class="center muted">-</td>`;
        //     }
        //     const t = formatTimeTH(getCheckinTimeRaw(stu, d));
        //     const isLate = getIsLateForDay(stu, d);
        //     const mark = isLate ? "⏰" : "✓";
        //     const cls = isLate ? "badgeLate" : "badgeOk";
        //     return `<td class="center"><span class="${cls}">${mark}</span>${
        //       t ? ` ${escapeHtml(t)}` : ""
        //     }</td>`;
        //   })
        //   .join("");

        // const sigCells = days
        //   .map((d) => {
        //     if (!getCheckinChecked(stu, d)) {
        //       return `<td class="center muted">-</td>`;
        //     }
        //     const url = getCheckinSignatureUrl(stu, d);
        //     if (!url) return `<td class="center muted">-</td>`;
        //     return `<td class="center"><img class="sigImgSm" src="${escapeHtml(
        //       url,
        //     )}" alt="sig"/></td>`;
        //   })
        //   .join("");

        const dayCellsCombined = days
          .map((d) => {
            if (!getCheckinChecked(stu, d))
              return `<td class="center muted">-</td>`;
            const t = formatTimeTH(getCheckinTimeRaw(stu, d));
            const isLate = getIsLateForDay(stu, d);
            const url = getCheckinSignatureUrl(stu, d);
            const mark = isLate ? "⏰" : "✓";
            const cls = isLate ? "badgeLate" : "badgeOk";
            return `
     <td class="center">
       <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
         <div><span class="${cls}">${mark}</span>${t ? ` ${escapeHtml(t)}` : ""}</div>
         ${
           url
             ? `<img class="sigImgSm" src="${escapeHtml(url)}" alt="sig"/>`
             : `<span class="muted">-</span>`
         }
       </div>
     </td>
   `;
          })
          .join("");

        return `
          <tr>
            <td class="right">${idx + 1}</td>
            <td>
              <div>${escapeHtml(name)}</div>
              ${
                nameEn
                  ? `<div class="muted" style="font-size:10px;">${escapeHtml(
                      nameEn,
                    )}</div>`
                  : ""
              }
            </td>
            <td>${escapeHtml(stu.company || "")}</td>
            <td class="center">${checkedDays}</td>
            <td class="center">${lateDays}</td>
            ${dayCellsCombined}
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charSet="utf-8" />
          <title>Check-in Report</title>
          ${basePrintCss()}
        </head>
        <body>
          ${buildPrintHead({ title, subtitle, generatedAt })}
          <table>
            <thead>${thead}</thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();

    // ✅ รอรูปโหลดก่อนพิมพ์
    waitImagesThenPrint(w, 1800);
  }

  function printSignatureReport() {
    const w = window.open("", "_blank");
    if (!w) return;

    const now = new Date();
    const generatedAt = now.toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    });

    const title = courseTitle || courseCode || "รายงานลายเซ็น";
    const subtitle = `${roomName ? `ห้อง ${roomName} • ` : ""}ผู้เรียนทั้งหมด ${
      studentsCount || 0
    } คน`;

    const thead = `
      <tr>
        <th style="width:24px;">ลำดับ</th>
        <th style="text-align:left;">ชื่อ-สกุล</th>
        <th style="text-align:left;">บริษัท</th>
        <th class="nowrap">เลขที่ QT/IV/RP</th>

        <th class="nowrap">ช่องทางรับเอกสาร</th>
        <th class="nowrap">ลายเซ็นรับเอกสาร</th>

        <th class="nowrap">นำส่งเอกสารเมื่อ</th>
        <th class="nowrap">รายการนำส่ง</th>
        <th class="nowrap">ลายเซ็นลูกค้า</th>
        <th class="nowrap">ลายเซ็นจนท.</th>
      </tr>
    `;

    const rows = students
      .map((stu, idx) => {
        const name = getStudentName(stu);
        const nameEn = shouldShowENLine(stu) ? getStudentNameEN(stu) : "";

        const receiveTypeText = receiveTypeLabel(getReceiveTypeRaw(stu));
        const receivedAt = getReceivedAt(stu);
        const receiveSigUrl = getReceiveSignatureUrl(stu);

        const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
        const staffItemsText = staffItemsLabel(getStaffReceiveItems(stu));
        const staffCustomerUrl = getStaffReceiveCustomerSigUrl(stu);
        const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);

        return `
          <tr>
            <td class="right">${idx + 1}</td>
            <td>
              <div>${escapeHtml(name)}</div>
              ${
                nameEn
                  ? `<div class="muted" style="font-size:10px;">${escapeHtml(
                      nameEn,
                    )}</div>`
                  : ""
              }
            </td>
            <td>${escapeHtml(stu.company || "")}</td>
            <td class="center">${escapeHtml(stu.paymentRef || "")}</td>

            <td class="center">${escapeHtml(receiveTypeText || "-")}</td>

            <td class="center">
              <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
                  ${
                    receiveSigUrl
                      ? `<img class="sigImg" src="${escapeHtml(receiveSigUrl)}" alt="sig"/>`
                      : `<span class="muted">-</span>`
                  }

                  ${
                    receivedAt
                      ? `<div class="muted nowrap">${escapeHtml(
                          formatDateTimeTH(receivedAt),
                        )}</div>`
                      : ""
                  }
              </div>
            </td>

            <td class="center">${
              staffUpdatedAt
                ? escapeHtml(formatDateTimeTH(staffUpdatedAt))
                : "-"
            }</td>
            <td class="center">${escapeHtml(staffItemsText || "-")}</td>

            <td class="center">${
              staffCustomerUrl
                ? `<img class="sigImg" src="${escapeHtml(
                    staffCustomerUrl,
                  )}" alt="sig"/>`
                : `<span class="muted">-</span>`
            }</td>

            <td class="center">${
              staffStaffUrl
                ? `<img class="sigImg" src="${escapeHtml(
                    staffStaffUrl,
                  )}" alt="sig"/>`
                : `<span class="muted">-</span>`
            }</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charSet="utf-8" />
          <title>Signature Report</title>
          ${basePrintCss()}
        </head>
        <body>
          ${buildPrintHead({ title, subtitle, generatedAt })}
          <table>
            <thead>${thead}</thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();

    // ✅ รอรูปโหลดก่อนพิมพ์
    waitImagesThenPrint(w, 2200);
  }

  function handlePrint() {
    if (tab === "signature") printSignatureReport();
    else printCheckinReport();
  }

  /* ================= UI (preview table in modal) ================= */

  const modalTitle = "รายงาน / Export";

  const modalTag = "PREVIEW • รายงาน";

  const colSpanCheckin = 6 + days.length + days.length; // base 6 + time days + sig days
  const colSpanSignature = 11;

  return (
    <>
      {/* ✅ แยกปุ่ม preview เป็น 2 ส่วน */}
      {/* <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          type="button"
          className="px-3 py-1.5"
          onClick={openCheckinReport}
        >
          ดูรายงานเช็กอิน / Export
        </SecondaryButton>

        <SecondaryButton
          type="button"
          className="px-3 py-1.5"
          onClick={openSignatureReport}
        >
          ดูรายงานลายเซ็น / Export
        </SecondaryButton>
      </div> */}

      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          type="button"
          className="px3 py-1.5"
          onClick={openReport}
        >
          ดูรายงาน / Export
        </SecondaryButton>
      </div>

      {/* {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-[95vw] max-w-6xl overflow-auto rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            //header
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-admin-textMuted">
                  {modalTag}
                </div>
                <div className="text-sm font-semibold text-admin-text">
                  {courseTitle || courseCode || modalTitle}
                </div>
                <div className="text-xs text-admin-textMuted">
                  {roomName && <>ห้อง {roomName}</>} • ผู้เรียนทั้งหมด{" "}
                  {studentsCount} คน
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Export CSV (Excel)
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="rounded-full border border-admin-border px-4 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
                >
                  สั่ง Print (มีรูป)
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

            //table preview
            <div className="overflow-auto rounded-xl border border-admin-border">
              {mode === "checkin" ? (
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-admin-surfaceMuted text-[11px] text-admin-text">
                    <tr>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลำดับ
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        บริษัท
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        เลขที่ QT/IV/RP
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        เช็กอิน(วัน)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        มาสาย(วัน)
                      </th>

                      {days.map((d) => (
                        <th
                          key={`t-${d}`}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          DAY {d}
                        </th>
                      ))}

                      //✅ เพิ่มหัวคอลัมน์ “ลายเซ็น” ต่อวัน
                      {days.map((d) => (
                        <th
                          key={`sig-${d}`}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          ลายเซ็น DAY {d}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((stu, idx) => {
                      const checkedDays = countCheckedDays(stu, dayCount);
                      const lateDays = countLateDays(stu, dayCount);

                      return (
                        <tr key={stu._id || idx}>
                          <td className="border border-admin-border px-2 py-1 text-right">
                            {idx + 1}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {getStudentName(stu)}
                            {shouldShowENLine(stu) && (
                              <div className="text-[10px] text-admin-textMuted">
                                {getStudentNameEN(stu)}
                              </div>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {stu.company || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {stu.paymentRef || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {checkedDays}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {lateDays}
                          </td>

                          //DAY time
                          {days.map((d) => {
                            const checked = getCheckinChecked(stu, d);
                            if (!checked) {
                              return (
                                <td
                                  key={`t-${d}`}
                                  className="border border-admin-border px-2 py-1 text-center text-admin-textMuted"
                                >
                                  -
                                </td>
                              );
                            }

                            const t = formatTimeTH(getCheckinTimeRaw(stu, d));
                            const isLate = getIsLateForDay(stu, d);

                            return (
                              <td
                                key={`t-${d}`}
                                className="border border-admin-border px-2 py-1 text-center"
                              >
                                <span
                                  className={
                                    isLate
                                      ? "font-semibold text-red-600"
                                      : "font-semibold text-emerald-700"
                                  }
                                >
                                  {isLate ? "⏰" : "✓"}
                                </span>
                                {t ? ` ${t}` : ""}
                              </td>
                            );
                          })}

                          //✅ DAY signature image
                          {days.map((d) => {
                            const checked = getCheckinChecked(stu, d);
                            if (!checked) {
                              return (
                                <td
                                  key={`sig-${d}`}
                                  className="border border-admin-border px-2 py-1 text-center text-admin-textMuted"
                                >
                                  -
                                </td>
                              );
                            }

                            const url = getCheckinSignatureUrl(stu, d);

                            return (
                              <td
                                key={`sig-${d}`}
                                className="border border-admin-border px-2 py-1 text-center"
                              >
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt={`signature day ${d}`}
                                    className="mx-auto h-9 w-[110px] object-contain"
                                  />
                                ) : (
                                  <span className="text-admin-textMuted">
                                    -
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {students.length === 0 && (
                      <tr>
                        <td
                          colSpan={colSpanCheckin}
                          className="border border-admin-border px-2 py-4 text-center text-admin-textMuted"
                        >
                          ยังไม่มีรายชื่อนักเรียน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-admin-surfaceMuted text-[11px] text-admin-text">
                    <tr>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลำดับ
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        บริษัท
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        เลขที่ QT/IV/RP
                      </th>

                      <th className="border border-admin-border px-2 py-1 text-center">
                        ช่องทางรับเอกสาร (3.1)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        วัน-เวลา (3.1)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลายเซ็นรับเอกสาร (3.1)
                      </th>

                      <th className="border border-admin-border px-2 py-1 text-center">
                        บันทึกเมื่อ (3.2)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        รายการ (3.2)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลายเซ็นลูกค้า (3.2)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลายเซ็นจนท. (3.2)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((stu, idx) => {
                      const receiveTypeText = receiveTypeLabel(
                        getReceiveTypeRaw(stu),
                      );
                      const receivedAt = getReceivedAt(stu);
                      const receiveSigUrl = getReceiveSignatureUrl(stu);

                      const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
                      const staffItemsText = staffItemsLabel(
                        getStaffReceiveItems(stu),
                      );
                      const staffCustomerUrl =
                        getStaffReceiveCustomerSigUrl(stu);
                      const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);

                      return (
                        <tr key={stu._id || idx}>
                          <td className="border border-admin-border px-2 py-1 text-right">
                            {idx + 1}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {getStudentName(stu)}
                            {shouldShowENLine(stu) && (
                              <div className="text-[10px] text-admin-textMuted">
                                {getStudentNameEN(stu)}
                              </div>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {stu.company || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {stu.paymentRef || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {receiveTypeText || "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {receivedAt ? formatDateTimeTH(receivedAt) : "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {receiveSigUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={receiveSigUrl}
                                alt="receive sig"
                                className="mx-auto h-10 w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffUpdatedAt
                              ? formatDateTimeTH(staffUpdatedAt)
                              : "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffItemsText || "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffCustomerUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={staffCustomerUrl}
                                alt="customer sig"
                                className="mx-auto h-10 w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffStaffUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={staffStaffUrl}
                                alt="staff sig"
                                className="mx-auto h-10 w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {students.length === 0 && (
                      <tr>
                        <td
                          colSpan={colSpanSignature}
                          className="border border-admin-border px-2 py-4 text-center text-admin-textMuted"
                        >
                          ยังไม่มีรายชื่อนักเรียน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {mode === "checkin" ? (
              <div className="mt-2 text-[11px] text-admin-textMuted">
                หมายเหตุ: ลายเซ็นจะแสดงใน Print
                (รอโหลดรูปก่อนสั่งพิมพ์อัตโนมัติ)
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-admin-textMuted">
                หมายเหตุ: รายงานนี้แสดงลายเซ็น (3.1) และ (3.2) พร้อมรูปใน Print
              </div>
            )}
          </div>
        </div>
      )} */}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {modalTag}
                </div>

                <DialogTitle className="text-base">
                  {courseTitle || courseCode || modalTitle}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {roomName ? `ห้อง ${roomName} • ` : ""}ผู้เรียนทั้งหมด{" "}
                  {studentsCount} คน
                </DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-4">
                <SecondaryButton
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                >
                  Export CSV (Excel)
                </SecondaryButton>
                <SecondaryButton
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                >
                  สั่ง Print (มีรูป)
                </SecondaryButton>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex w-full flex-col"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="checkin">เช็คอิน</TabsTrigger>
                <TabsTrigger value="signature">รับเอกสาร</TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded-xl border border-admin-border">
              <TabsContent value="checkin" className="m-0">
                <table className="min-w-full border-collapse text-xs">
                  <colgroup>
                    <col style={{ width: 50 }} /> {/* ลำดับ */}
                    <col style={{ width: 150 }} /> {/* ชื่อ */}
                    <col style={{ width: 150 }} /> {/* บริษัท */}
                    {/* <col style={{ width: 140 }} /> */}
                    <col style={{ width: 90 }} /> {/* เช็กอิน(วัน) */}
                    <col style={{ width: 90 }} /> {/* มาสาย(วัน) */}
                    {/* {days.map((d) => (
                      <col key={`c-day-${d}`} style={{ width: 120 }} />
                    ))} */}
                    {days.map((d) => (
                      <col key={`c-sig-${d}`} style={{ width: 140 }} />
                    ))}
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-[#0a1f33] text-es text-white h-8">
                    <tr>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลำดับ
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        บริษัท
                      </th>
                      {/* <th className="border border-admin-border px-2 py-1 text-center">
                        เลขที่ QT/IV/RP
                      </th> */}
                      <th className="border border-admin-border px-2 py-1 text-center">
                        เช็กอิน (วัน)
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        มาสาย (วัน)
                      </th>

                      {/* {days.map((d) => (
                        <th
                          key={`t-${d}`}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          DAY {d}
                        </th>
                      ))} */}

                      {/* ✅ เพิ่มหัวคอลัมน์ “ลายเซ็น” ต่อวัน */}
                      {days.map((d) => (
                        <th
                          key={`sig-${d}`}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          DAY {d}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((stu, idx) => {
                      const checkedDays = countCheckedDays(stu, dayCount);
                      const lateDays = countLateDays(stu, dayCount);

                      return (
                        <tr key={stu._id || idx}>
                          <td className="border border-admin-border p-2 text-center">
                            {idx + 1}
                          </td>

                          <td className="border border-admin-border p-2">
                            {getStudentName(stu)}
                            {shouldShowENLine(stu) && (
                              <div className="text-[10px] text-admin-textMuted">
                                {getStudentNameEN(stu)}
                              </div>
                            )}
                          </td>

                          <td className="border border-admin-border p-2">
                            {stu.company || ""}
                          </td>

                          {/* <td className="border border-admin-border px-2 py-1 text-center">
                            {stu.paymentRef || ""}
                          </td> */}

                          <td className="border border-admin-border p-2 text-center">
                            {checkedDays}
                          </td>

                          <td className="border border-admin-border p-2 text-center">
                            {lateDays}
                          </td>

                          {/* DAY time */}
                          {/* {days.map((d) => {
                            const checked = getCheckinChecked(stu, d);
                            if (!checked) {
                              return (
                                <td
                                  key={`t-${d}`}
                                  className="border border-admin-border px-2 py-1 text-center text-admin-textMuted"
                                >
                                  -
                                </td>
                              );
                            }

                            const t = formatTimeTH(getCheckinTimeRaw(stu, d));
                            const isLate = getIsLateForDay(stu, d);

                            return (
                              <td
                                key={`t-${d}`}
                                className="border border-admin-border px-2 py-1 text-center"
                              >
                                <span
                                  className={
                                    isLate
                                      ? "font-semibold text-red-600"
                                      : "font-semibold text-emerald-700"
                                  }
                                >
                                  {isLate ? "⏰" : "✓"}
                                </span>
                                {t ? ` ${t}` : ""}
                              </td>
                            );
                          })} */}

                          {/* ✅ DAY signature image */}
                          {days.map((d) => {
                            const checked = getCheckinChecked(stu, d);
                            if (!checked) {
                              return (
                                <td
                                  key={`sig-${d}`}
                                  className="border border-admin-border p-2 text-center text-admin-textMuted"
                                >
                                  -
                                </td>
                              );
                            }

                            const url = getCheckinSignatureUrl(stu, d);
                            const t = formatTimeTH(getCheckinTimeRaw(stu, d));
                            const isLate = getIsLateForDay(stu, d);

                            return (
                              <td
                                key={`sig-${d}`}
                                className="border border-admin-border p-2 text-center"
                              >
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <span
                                      className={
                                        isLate
                                          ? "font-semibold text-red-600"
                                          : "font-semibold text-emerald-700"
                                      }
                                    >
                                      {isLate ? "⏰" : "✓"}
                                    </span>
                                    {t ? ` ${t}` : ""}
                                  </div>
                                  {url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={url}
                                      alt={`signature day ${d}`}
                                      className="mx-auto h-9 w-[110px] object-contain"
                                    />
                                  ) : (
                                    <span className="text-admin-textMuted">
                                      -
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}

                    {students.length === 0 && (
                      <tr>
                        <td
                          colSpan={colSpanCheckin}
                          className="border border-admin-border px-2 py-4 text-center text-admin-textMuted"
                        >
                          ยังไม่มีรายชื่อนักเรียน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TabsContent>

              <TabsContent value="signature" className="m-0">
                <table className="min-w-full border-collapse text-xs">
                  <colgroup>
                    {/* base */}
                    <col style={{ width: 50 }} /> {/* ลำดับ */}
                    <col style={{ width: 150 }} /> {/* ชื่อ-สกุล */}
                    <col style={{ width: 150 }} /> {/* บริษัท */}
                    <col style={{ width: 140 }} /> {/* เลขที่ QT/IV/RP */}
                    {/* 3.1 */}
                    <col style={{ width: 160 }} />{" "}
                    {/* ช่องทางรับเอกสาร (3.1) */}
                    {/* <col style={{ width: 160 }} /> วัน-เวลา (3.1) */}
                    <col style={{ width: 180 }} />{" "}
                    {/* ลายเซ็นรับเอกสาร (3.1) */}
                    {/* 3.2 */}
                    <col style={{ width: 160 }} /> {/* บันทึกเมื่อ (3.2) */}
                    <col style={{ width: 180 }} /> {/* รายการ (3.2) */}
                    <col style={{ width: 180 }} /> {/* ลายเซ็นลูกค้า (3.2) */}
                    <col style={{ width: 180 }} /> {/* ลายเซ็นจนท. (3.2) */}
                  </colgroup>
                  <thead className="sticky top-0 z-20 bg-[#0a1f33] text-xs text-white h-8">
                    <tr>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลำดับ
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-left">
                        บริษัท
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center">
                        เลขที่ QT/IV/RP
                      </th>

                      <th className="border border-admin-border px-2 py-1 text-center">
                        ช่องทางรับเอกสาร
                      </th>
                      {/* <th className="border border-admin-border px-2 py-1 text-center">
                        วัน-เวลา (3.1)
                      </th> */}
                      <th className="border border-admin-border px-2 py-1 text-center">
                        ลายเซ็นรับเอกสาร
                      </th>

                      <th className="border border-admin-border px-2 py-1 text-center bg-[#66ccff] text-[#0a1f33]">
                        นำส่งเอกสารเมื่อ
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center bg-[#66ccff] text-[#0a1f33]">
                        รายการนำส่ง
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center bg-[#66ccff] text-[#0a1f33]">
                        ลายเซ็นลูกค้า
                      </th>
                      <th className="border border-admin-border px-2 py-1 text-center bg-[#66ccff] text-[#0a1f33]">
                        ลายเซ็นจนท.
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((stu, idx) => {
                      const receiveTypeText = receiveTypeLabel(
                        getReceiveTypeRaw(stu),
                      );
                      const receivedAt = getReceivedAt(stu);
                      const receiveSigUrl = getReceiveSignatureUrl(stu);

                      const staffUpdatedAt = getStaffReceiveUpdatedAt(stu);
                      const staffItemsText = staffItemsLabel(
                        getStaffReceiveItems(stu),
                      );
                      const staffCustomerUrl =
                        getStaffReceiveCustomerSigUrl(stu);
                      const staffStaffUrl = getStaffReceiveStaffSigUrl(stu);

                      return (
                        <tr key={stu._id || idx}>
                          <td className="border border-admin-border px-2 py-1 text-center">
                            {idx + 1}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {getStudentName(stu)}
                            {shouldShowENLine(stu) && (
                              <div className="text-[10px] text-admin-textMuted">
                                {getStudentNameEN(stu)}
                              </div>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1">
                            {stu.company || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {stu.paymentRef || ""}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {receiveTypeText || "-"}
                          </td>

                          {/* <td className="border border-admin-border px-2 py-1 text-center">
                            {receivedAt ? formatDateTimeTH(receivedAt) : "-"}
                          </td> */}

                          <td className="border border-admin-border px-2 py-1 text-center">
                            <div className="flex flex-col gap-1">
                              {receiveSigUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={receiveSigUrl}
                                  alt="receive sig"
                                  className="mx-auto h-10 w-[120px] object-contain"
                                />
                              ) : (
                                <span className="text-admin-textMuted">-</span>
                              )}

                              {receivedAt ? formatDateTimeTH(receivedAt) : ""}
                            </div>
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffUpdatedAt
                              ? formatDateTimeTH(staffUpdatedAt)
                              : "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffItemsText || "-"}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffCustomerUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={staffCustomerUrl}
                                alt="customer sig"
                                className="mx-auto h-10 w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>

                          <td className="border border-admin-border px-2 py-1 text-center">
                            {staffStaffUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={staffStaffUrl}
                                alt="staff sig"
                                className="mx-auto h-10 w-[120px] object-contain"
                              />
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {students.length === 0 && (
                      <tr>
                        <td
                          colSpan={colSpanSignature}
                          className="border border-admin-border px-2 py-4 text-center text-admin-textMuted"
                        >
                          ยังไม่มีรายชื่อนักเรียน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TabsContent>
            </div>

            {/* {tab === "checkin" ? (
              <div className="mt-2 text-[11px] text-admin-textMuted">
                หมายเหตุ: ลายเซ็นจะแสดงใน Print
                (รอโหลดรูปก่อนสั่งพิมพ์อัตโนมัติ)
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-admin-textMuted">
                หมายเหตุ: รายงานนี้แสดงลายเซ็น (3.1) และ (3.2) พร้อมรูปใน Print
              </div>
            )} */}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
