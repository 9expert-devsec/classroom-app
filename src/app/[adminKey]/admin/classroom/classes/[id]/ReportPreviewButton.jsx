"use client";

import { useEffect, useMemo, useState } from "react";
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

/* ================= day label helpers ================= */

// normalize day item -> YYYY-MM-DD
function pickYmd(x) {
  if (!x) return "";
  if (typeof x === "string") return clean(x).slice(0, 10);

  if (typeof x === "object") {
    const v =
      x.date || x.ymd || x.day || x.value || x.startDate || x.start || "";
    return clean(v).slice(0, 10);
  }

  return clean(x).slice(0, 10);
}

function uniqueSortedYmd(list) {
  const arr = (list || []).map(pickYmd).filter(Boolean);
  return Array.from(new Set(arr)).sort();
}

function toYmdBKK(input) {
  if (!input) return "";
  try {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
  } catch {
    return "";
  }
}

function addDaysYmd(startYmd, add) {
  if (!startYmd) return "";
  const base = new Date(`${startYmd}T00:00:00+07:00`).getTime();
  const t = base + Number(add || 0) * 86400000;
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function formatHeaderDateTH(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function formatHeaderDateEN(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    })
    .replace(/,/g, "")
    .toUpperCase();
}

function pickClassYmdDays(classInfo, fallbackDayCount) {
  // 1) days[] (รองรับ object)
  const rawArr =
    classInfo?.days ||
    classInfo?.classDays ||
    classInfo?.trainingDays ||
    classInfo?.scheduleDays ||
    null;

  const fromDays = uniqueSortedYmd(Array.isArray(rawArr) ? rawArr : []);
  if (fromDays.length) return fromDays;

  // 2) fallback: startDate/date + dayCount (ต่อเนื่อง)
  const startRaw =
    classInfo?.startDate ||
    classInfo?.date ||
    classInfo?.start ||
    classInfo?.startAt ||
    classInfo?.start_at ||
    "";

  const startYmd = toYmdBKK(startRaw) || clean(startRaw).slice(0, 10);
  const n = Math.max(1, Number(fallbackDayCount || 1));

  const out = [];
  for (let i = 0; i < n; i++) out.push(addDaysYmd(startYmd, i));
  return out.filter(Boolean);
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
  if (!info) return "";
  return clean(info?.signatureUrl) || "";
}

function getIsLateForDay(stu, day) {
  const info = getCheckinInfo(stu, day);
  return Boolean(info?.isLate ?? false);
}

function getLearnTypeForDay(stu, day) {
  const key = `day${day}`;

  // 1) per-day map
  const byDay =
    clean(stu?.learnTypeByDay?.[key]) ||
    clean(stu?.learnTypePerDay?.[key]) ||
    clean(stu?.learnTypes?.[key]) ||
    "";

  if (byDay) return byDay.toLowerCase();

  // 2) timeline (from day X onward)
  const tl = Array.isArray(stu?.learnTypeTimeline)
    ? stu.learnTypeTimeline
    : Array.isArray(stu?.learnTypeHistory)
      ? stu.learnTypeHistory
      : [];

  if (tl.length) {
    const items = tl
      .map((x) => ({
        day: Number(
          x?.day ?? x?.fromDay ?? x?.startDay ?? x?.effectiveDay ?? 0,
        ),
        type: clean(x?.learnType ?? x?.type ?? x?.value ?? ""),
      }))
      .filter((x) => x.day > 0 && x.type)
      .sort((a, b) => a.day - b.day);

    let cur = "";
    for (const it of items) {
      if (it.day <= day) cur = it.type.toLowerCase();
      else break;
    }
    if (cur) return cur;
  }

  // 3) fallback
  return clean(
    stu?.learnType || stu?.trainingType || stu?.mode || "",
  ).toLowerCase();
}

function isLiveForDay(stu, day) {
  return getLearnTypeForDay(stu, day) === "live";
}

/* ================= aggregates ================= */

function countCheckedDays(stu, dayCount) {
  let c = 0;
  for (let d = 1; d <= (dayCount || 1); d++) {
    if (getCheckinChecked(stu, d)) c++;
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
  students = [], // current list (ตาม filter/search)
  selectedStudents = [], // selected subset
  totalStudentsCount, // total ทั้งคลาส
  dayCount = 1,
  dayDates = [], // ✅ source of truth จาก page.jsx
  classInfo,
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("checkin"); // "checkin" | "signature"
  const [scope, setScope] = useState("current"); // "current" | "selected"

  const hasSelection = (selectedStudents || []).length > 0;

  // เปิด modal: default เป็น "selected" ถ้ามีการเลือก
  useEffect(() => {
    if (!open) return;
    setScope(hasSelection ? "selected" : "current");
  }, [open, hasSelection]);

  const activeStudents = useMemo(() => {
    if (scope === "selected" && hasSelection) return selectedStudents || [];
    return students || [];
  }, [scope, hasSelection, selectedStudents, students]);

  const totalCount =
    Number.isFinite(Number(totalStudentsCount)) &&
    Number(totalStudentsCount) >= 0
      ? Number(totalStudentsCount)
      : classInfo?.students?.length || 0;

  // ✅ map วันอบรม -> label วันที่จริง (ใช้ dayDates ก่อน)
  const dayMeta = useMemo(() => {
    const ymds =
      Array.isArray(dayDates) && dayDates.length
        ? uniqueSortedYmd(dayDates)
        : pickClassYmdDays(classInfo, dayCount);

    return ymds.map((ymd, idx) => ({
      day: idx + 1,
      ymd,
      label: formatHeaderDateEN(ymd) || `DAY ${idx + 1}`,
    }));
  }, [dayDates, classInfo, dayCount]);

  const effectiveDayCount = dayMeta.length || dayCount || 1;

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

  function openReport() {
    setTab("checkin");
    setOpen(true);
  }

  /* ================= Export CSV ================= */

  function exportCheckinCsv() {
    if (!activeStudents.length) {
      alert("ยังไม่มีรายชื่อนักเรียนสำหรับ Export");
      return;
    }

    const headers = [
      "ลำดับ",
      "ชื่อ-สกุล",
      "บริษัท",
      "เลขที่ QT/IV/RP",
      "เช็กอิน (วัน)",
      ...dayMeta.map((x) => `${x.label} เวลา`),
      ...dayMeta.map((x) => `ลายเซ็น ${x.label} (URL)`),
    ];

    const rows = activeStudents.map((stu, idx) => {
      const checkedDays = countCheckedDays(stu, effectiveDayCount);

      const timeCells = dayMeta.map((x) => {
        const d = x.day;
        if (!getCheckinChecked(stu, d)) return "";
        const t = formatTimeTH(getCheckinTimeRaw(stu, d));
        const isLate = getIsLateForDay(stu, d);
        return `${isLate ? "LATE " : ""}${t || "✓"}`.trim();
      });

      const sigCells = dayMeta.map((x) => {
        const d = x.day;
        if (!getCheckinChecked(stu, d)) return "";
        return getCheckinSignatureUrl(stu, d) || "";
      });

      return [
        idx + 1,
        getStudentName(stu),
        stu.company || "",
        stu.paymentRef || "",
        checkedDays,
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

    const scopeTag =
      scope === "selected" && hasSelection
        ? `selected_${activeStudents.length}`
        : "filtered";
    const filename = `รายงานเช็กอิน_${courseCode || "class"}_${classCode || ""}_${scopeTag}.csv`;
    downloadCsv(csv, filename);
  }

  function exportSignatureCsv() {
    if (!activeStudents.length) {
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

    const rows = activeStudents.map((stu, idx) => {
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

    const scopeTag =
      scope === "selected" && hasSelection
        ? `selected_${activeStudents.length}`
        : "filtered";
    const filename = `รายงานลายเซ็น_${courseCode || "class"}_${classCode || ""}_${scopeTag}.csv`;
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
    const scopeLabel =
      scope === "selected" && hasSelection
        ? `เฉพาะที่เลือก ${activeStudents.length} คน`
        : `ตามตัวกรอง ${activeStudents.length} คน`;
    const subtitle = `${roomName ? `ห้อง ${roomName} • ` : ""}${scopeLabel}${
      totalCount ? ` (จากทั้งหมด ${totalCount} คน)` : ""
    }`;

    const thead = `
      <tr>
        <th style="width:24px;">ลำดับ</th>
        <th style="text-align:left;">ชื่อ-สกุล</th>
        <th style="text-align:left;">บริษัท</th>
        <th class="nowrap">เช็กอิน (วัน)</th>
        ${dayMeta
          .map((x) => {
            const h = formatHeaderDateTH(x.ymd) || x.label || "";
            return `<th class="nowrap">${escapeHtml(h)}</th>`;
          })
          .join("")}
      </tr>
    `;

    const rows = activeStudents
      .map((stu, idx) => {
        const name = getStudentName(stu);
        const nameEn = shouldShowENLine(stu) ? getStudentNameEN(stu) : "";
        const checkedDays = countCheckedDays(stu, effectiveDayCount);

        const dayCellsCombined = dayMeta
          .map((x) => {
            const d = x.day;
            if (!getCheckinChecked(stu, d)) {
              if (isLiveForDay(stu, d)) {
                return `<td class="center"><span class="badgeLive">LIVE CHECK</span></td>`;
              }
              return `<td class="center muted">-</td>`;
            }

            const t = formatTimeTH(getCheckinTimeRaw(stu, d));
            const isLate = getIsLateForDay(stu, d);
            const url = getCheckinSignatureUrl(stu, d);
            const line = isLate
              ? `<span class="badgeLate">เวลา</span>${t ? ` ${escapeHtml(t)}` : ""} <span class="badgeLate">สาย</span>`
              : `<span class="badgeOk">✓</span>${t ? ` ${escapeHtml(t)}` : ""}`;
            const cls = isLate ? "badgeLate" : "badgeOk";

            return `
              <td class="center">
                <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
                  <div><span class="${cls}">${line}</span></div>
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
                  ? `<div class="muted" style="font-size:10px;">${escapeHtml(nameEn)}</div>`
                  : ""
              }
            </td>
            <td>${escapeHtml(stu.company || "")}</td>
            <td class="center">${checkedDays}</td>
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
    const scopeLabel =
      scope === "selected" && hasSelection
        ? `เฉพาะที่เลือก ${activeStudents.length} คน`
        : `ตามตัวกรอง ${activeStudents.length} คน`;
    const subtitle = `${roomName ? `ห้อง ${roomName} • ` : ""}${scopeLabel}${
      totalCount ? ` (จากทั้งหมด ${totalCount} คน)` : ""
    }`;

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

    const rows = activeStudents
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
                  ? `<div class="muted" style="font-size:10px;">${escapeHtml(nameEn)}</div>`
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
                      ? `<img style="height:38px;width:120px;object-fit:contain;display:block;margin:0 auto;" src="${escapeHtml(receiveSigUrl)}" alt="sig"/>`
                      : `<span class="muted">-</span>`
                  }

                  ${
                    receivedAt
                      ? `<div class="muted nowrap">${escapeHtml(formatDateTimeTH(receivedAt))}</div>`
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
                ? `<img style="height:38px;width:120px;object-fit:contain;display:block;margin:0 auto;" src="${escapeHtml(staffCustomerUrl)}" alt="sig"/>`
                : `<span class="muted">-</span>`
            }</td>

            <td class="center">${
              staffStaffUrl
                ? `<img style="height:38px;width:120px;object-fit:contain;display:block;margin:0 auto;" src="${escapeHtml(staffStaffUrl)}" alt="sig"/>`
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

    waitImagesThenPrint(w, 2200);
  }

  function handlePrint() {
    if (tab === "signature") printSignatureReport();
    else printCheckinReport();
  }

  /* ================= UI (preview table in modal) ================= */

  const modalTitle = "รายงาน / Export";
  const modalTag = "PREVIEW • รายงาน";

  const colSpanCheckin = 4 + dayMeta.length;
  const colSpanSignature = 11;

  const scopeLabelShort =
    scope === "selected" && hasSelection
      ? `เฉพาะที่เลือก ${activeStudents.length} คน`
      : `ตามตัวกรอง ${activeStudents.length} คน`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton
          type="button"
          className="px-3 py-1.5"
          onClick={openReport}
        >
          ดูรายงาน / Export
        </SecondaryButton>
      </div>

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
                  {roomName ? `ห้อง ${roomName} • ` : ""}
                  {scopeLabelShort}
                  {Number.isFinite(totalCount) && totalCount > 0
                    ? ` (จากทั้งหมด ${totalCount} คน)`
                    : ""}
                </DialogDescription>

                {/* ✅ Toggle scope ถ้ามี selection */}
                {hasSelection && (
                  <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-admin-border bg-white text-[11px]">
                    <button
                      type="button"
                      onClick={() => setScope("selected")}
                      className={`px-2 py-1 ${
                        scope === "selected"
                          ? "bg-brand-primary text-white"
                          : "text-admin-text hover:bg-admin-surfaceMuted"
                      }`}
                    >
                      เฉพาะที่เลือก ({selectedStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("current")}
                      className={`px-2 py-1 ${
                        scope === "current"
                          ? "bg-brand-primary text-white"
                          : "text-admin-text hover:bg-admin-surfaceMuted"
                      }`}
                    >
                      ตามตัวกรอง ({students.length})
                    </button>
                  </div>
                )}
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
                    <col style={{ width: 50 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 95 }} />
                    {dayMeta.map((x) => (
                      <col key={`c-day-${x.day}`} style={{ width: 160 }} />
                    ))}
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
                        เช็กอิน (วัน)
                      </th>
                      {dayMeta.map((x) => (
                        <th
                          key={`h-${x.day}`}
                          className="border border-admin-border px-2 py-1 text-center"
                        >
                          {x.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {activeStudents.map((stu, idx) => {
                      const checkedDays = countCheckedDays(
                        stu,
                        effectiveDayCount,
                      );

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

                          <td className="border border-admin-border p-2 text-center">
                            {checkedDays}
                          </td>

                          {dayMeta.map((x) => {
                            const d = x.day;
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

                    {activeStudents.length === 0 && (
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
                    <col style={{ width: 50 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 150 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 160 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 180 }} />
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
                    {activeStudents.map((stu, idx) => {
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

                    {activeStudents.length === 0 && (
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
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
