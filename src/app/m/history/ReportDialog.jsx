"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Download, Image as ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";

import { sortAndAllocate, DEFAULT_COUPON_FACE_VALUE } from "@/lib/couponAllocation";
import { formatCouponCodeForDisplay } from "@/lib/couponCode";
import { buildReportFilename } from "@/lib/reportFilename";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function clean(x) {
  return String(x ?? "").trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format date in Thai Buddhist calendar short: "9 เม.ย. 2569" */
function fmtDateTHShort(ymd) {
  if (!ymd) return "-";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/** Format date in Thai long: "16 เมษายน 2569" */
function fmtDateTHLong(ymd) {
  if (!ymd) return "-";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

/** Get Thai day name: "จันทร์", "อังคาร", etc. */
function fmtDayNameTH(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("th-TH", {
    weekday: "long",
    timeZone: "Asia/Bangkok",
  });
}

/** Format datetime as "16 เม.ย. 2569 14:32 น." */
function fmtDateTimeNowTH() {
  const now = new Date();
  const datePart = now.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const timePart = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
  return `${datePart} ${timePart} น.`;
}

/** Format time as HH:MM:SS in Bangkok */
function fmtTimeBKK(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

/** Count calendar days between two YYYY-MM-DD strings (inclusive) */
function daysBetween(startYMD, endYMD) {
  const s = new Date(`${startYMD}T00:00:00+07:00`);
  const e = new Date(`${endYMD}T00:00:00+07:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
}

/** Generate a 6-char report ID from the alphabet: 23456789A-HJ-NP-Z */
const REPORT_ID_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateReportId() {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += REPORT_ID_CHARS[Math.floor(Math.random() * REPORT_ID_CHARS.length)];
  }
  return id;
}

/**
 * Wait for all <img> elements in the print window to load, then call
 * window.print(). Copied from ReportPreviewButton.jsx.
 */
function waitImagesThenPrint(win, timeoutMs = 1800) {
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

/* ------------------------------------------------------------------ */
/*  Data processing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Build per-day, per-bill structure with allocation from groupedDays.
 * Each bill's items get appliedAmount from DB if available, else computed.
 */
function buildReportData(groupedDays) {
  const days = [];

  for (const day of groupedDays) {
    const dayBills = [];

    for (const bill of day.bills) {
      const billTotal = Math.max(0, toNum(bill.billTotal, 0));

      // Check if any item has appliedAmount from DB
      const hasDbApplied = bill.items.some((it) => it.appliedAmount != null);

      let allocatedItems;
      if (hasDbApplied) {
        // Use DB values, sorted by redeemedAt asc for display
        const sorted = [...bill.items].sort((a, b) => {
          const at = new Date(a?.redeemedAt || 0).getTime();
          const bt = new Date(b?.redeemedAt || 0).getTime();
          if (at !== bt) return at - bt;
          return clean(a?.displayCode).localeCompare(clean(b?.displayCode), "en");
        });
        allocatedItems = sorted.map((it, idx) => ({
          ...it,
          _order: idx + 1,
          _faceValue: toNum(it.couponPrice, DEFAULT_COUPON_FACE_VALUE),
          _appliedAmount: toNum(it.appliedAmount, 0),
        }));
      } else {
        // Fallback: compute via sortAndAllocate
        allocatedItems = sortAndAllocate(bill.items, billTotal);
      }

      const appliedSum = allocatedItems.reduce(
        (sum, it) => sum + toNum(it._appliedAmount, 0),
        0,
      );
      const faceSum = allocatedItems.reduce(
        (sum, it) => sum + toNum(it._faceValue, DEFAULT_COUPON_FACE_VALUE),
        0,
      );

      dayBills.push({
        billCode: bill.billCode,
        redeemedAt: bill.redeemedAt,
        billTotal,
        couponCount: allocatedItems.length,
        faceSum,
        appliedSum,
        diff: Math.max(0, billTotal - appliedSum),
        items: allocatedItems,
      });
    }

    const dayApplied = dayBills.reduce((s, b) => s + b.appliedSum, 0);
    const dayBillTotal = dayBills.reduce((s, b) => s + b.billTotal, 0);
    const dayCouponCount = dayBills.reduce((s, b) => s + b.couponCount, 0);

    days.push({
      dayKey: day.dayKey,
      bills: dayBills,
      couponCount: dayCouponCount,
      appliedSum: dayApplied,
      billTotal: dayBillTotal,
      diff: Math.max(0, dayBillTotal - dayApplied),
    });
  }

  return days;
}

/* ------------------------------------------------------------------ */
/*  Print HTML builder                                                 */
/* ------------------------------------------------------------------ */

function buildPrintCss() {
  return `
<style>
  @page { size: A4 portrait; margin: 10mm; }

  @font-face {
    font-family: "LINESeedSansTH";
    src: url("/fonts/LINESeedSansTH_W_Rg.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: "LINESeedSansTH";
    src: url("/fonts/LINESeedSansTH_W_Bd.woff2") format("woff2");
    font-weight: 700;
    font-style: normal;
  }

  body {
    margin: 0;
    font-family: "LINESeedSansTH", "GoogleSans", system-ui, sans-serif;
    font-size: 11px;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  table {
    border-collapse: collapse;
    width: 100%;
    table-layout: auto;
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    vertical-align: middle;
    white-space: normal;
    word-break: break-word;
  }

  tr, .block { break-inside: avoid; page-break-inside: avoid; }
  .no-break-after { break-after: avoid; page-break-after: avoid; }
  .sectionGap { margin-top: 8mm; }
  .warn { color: #d97706; font-weight: 700; }

  /* Header */
  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6mm;
  }
  .report-header .left { display: flex; align-items: center; gap: 10px; }
  .report-header .logo {
    width: 48px; height: 48px; border-radius: 50%;
    object-fit: cover; border: 1px solid #e2e8f0;
  }
  .report-header .name { font-size: 16px; font-weight: 700; }
  .report-header .subtitle { font-size: 11px; color: #64748b; }
  .report-header .right { text-align: right; font-size: 10px; color: #64748b; }

  /* Summary cards */
  .cards {
    display: flex; gap: 8px; margin: 4mm 0 2mm 0;
  }
  .cards .card {
    flex: 1; text-align: center; padding: 8px;
    border: 1px solid #e2e8f0; border-radius: 8px;
    background: #f8fafc;
  }
  .cards .card .label { font-size: 10px; color: #64748b; }
  .cards .card .value { font-size: 18px; font-weight: 700; margin: 2px 0; }
  .cards .card .unit { font-size: 10px; color: #94a3b8; }

  .metrics { font-size: 10px; color: #64748b; margin-bottom: 3mm; }

  /* Summary table */
  .sumtbl th { background: #f8fafc; font-weight: 600; font-size: 10px; color: #475569; }
  .sumtbl .total td { background: #f1f5f9; font-weight: 700; }
  .text-right { text-align: right; }

  /* Day header */
  .day-header {
    background: #f1f5f9; border-radius: 6px; padding: 6px 10px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; font-weight: 600; color: #334155;
    margin-top: 5mm;
  }
  .day-header .stats { font-weight: 400; font-size: 10px; color: #64748b; }

  /* Bill block */
  .bill-meta {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 10px; color: #475569; margin: 3mm 0 1mm 0;
  }
  .bill-meta .left { font-weight: 600; }

  .bill-tbl th {
    background: #f8fafc; font-size: 10px; font-weight: 600; color: #475569;
    text-align: left;
  }
  .bill-tbl .subtotal td { background: #f8fafc; font-weight: 600; }
  .bill-tbl .mono { font-family: monospace; }

  /* Footer */
  .report-footer { margin-top: 5mm; font-size: 9px; color: #94a3b8; }
</style>`;
}

function buildPrintHtml({
  restaurantName,
  logoUrl,
  username,
  reportId,
  startDate,
  endDate,
  dayCount,
  grandCouponCount,
  grandApplied,
  grandBillTotal,
  customerPayMore,
  avgPerDay,
  reportData,
}) {
  const esc = escapeHtml;

  // -- Summary table rows --
  let summaryRows = "";
  reportData.forEach((day, i) => {
    const bg = i % 2 === 1 ? ' style="background:#fafbfc"' : "";
    summaryRows += `<tr${bg}>
      <td>${esc(fmtDateTHShort(day.dayKey))} <span style="color:#94a3b8">(${esc(fmtDayNameTH(day.dayKey))})</span></td>
      <td class="text-right">${esc(fmtMoney(day.couponCount))}</td>
      <td class="text-right">${esc(fmtMoney(day.appliedSum))}</td>
      <td class="text-right">${esc(fmtMoney(day.billTotal))}</td>
      <td class="text-right">+${esc(fmtMoney(day.diff))}</td>
    </tr>`;
  });

  // -- Detail sections --
  let detailHtml = "";
  reportData.forEach((day) => {
    // Day header — use no-break-after to keep it with first bill
    detailHtml += `
    <div class="day-header no-break-after">
      <div>${esc(fmtDateTHLong(day.dayKey))} (${esc(fmtDayNameTH(day.dayKey))})</div>
      <div class="stats">${esc(fmtMoney(day.couponCount))} คูปอง &middot; หักจริง ${esc(fmtMoney(day.appliedSum))} ฿ &middot; ยอดรวม ${esc(fmtMoney(day.billTotal))} ฿</div>
    </div>`;

    day.bills.forEach((bill) => {
      // Each bill as an atomic block
      detailHtml += `<div class="block">`;

      detailHtml += `
      <div class="bill-meta">
        <div class="left">บิล ${esc(bill.billCode || "ไม่มีรหัสบิล")} &middot; ${esc(fmtTimeBKK(bill.redeemedAt))}</div>
        <div>Face ${esc(fmtMoney(bill.faceSum))} ฿ &middot; หักจริง ${esc(fmtMoney(bill.appliedSum))} ฿ &middot; ยอดบิล ${esc(fmtMoney(bill.billTotal))} ฿ &middot; ส่วนต่าง ${esc(fmtMoney(bill.diff))} ฿</div>
      </div>`;

      detailHtml += `<table class="bill-tbl"><thead><tr>
        <th style="width:30px">#</th>
        <th>รหัสคูปอง</th>
        <th>เวลา</th>
        <th class="text-right">Face</th>
        <th class="text-right">หักจริง</th>
      </tr></thead><tbody>`;

      bill.items.forEach((it, idx) => {
        const face = toNum(it._faceValue, DEFAULT_COUPON_FACE_VALUE);
        const applied = toNum(it._appliedAmount, 0);
        const isPartial = applied < face;
        const bg = idx % 2 === 1 ? ' style="background:#fafbfc"' : "";

        detailHtml += `<tr${bg}>
          <td style="color:#64748b">${it._order || idx + 1}</td>
          <td class="mono">${esc(formatCouponCodeForDisplay(it.displayCode))}</td>
          <td>${esc(fmtTimeBKK(it.redeemedAt))}</td>
          <td class="text-right">${esc(fmtMoney(face))}</td>
          <td class="text-right${isPartial ? " warn" : ""}">${esc(fmtMoney(applied))}</td>
        </tr>`;
      });

      // Subtotal
      detailHtml += `<tr class="subtotal">
        <td colspan="3">รวม ${esc(fmtMoney(bill.couponCount))} คูปอง</td>
        <td class="text-right">${esc(fmtMoney(bill.faceSum))}</td>
        <td class="text-right">${esc(fmtMoney(bill.appliedSum))}</td>
      </tr></tbody></table>`;

      detailHtml += `</div>`; // close .block
    });
  });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>รายงานการใช้คูปอง - ${esc(restaurantName)}</title>
${buildPrintCss()}
</head>
<body>

<!-- Section 1: Header -->
<div class="report-header">
  <div class="left">
    ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" alt="">` : ""}
    <div>
      <div class="name">${esc(restaurantName || "Restaurant")}</div>
      <div class="subtitle">รายงานการใช้คูปอง 9Expert</div>
    </div>
  </div>
  <div class="right">
    <div>ช่วง: ${esc(fmtDateTHShort(startDate))} - ${esc(fmtDateTHShort(endDate))} (${dayCount} วัน)</div>
    <div>ออก ณ: ${esc(fmtDateTimeNowTH())}</div>
  </div>
</div>

<!-- Section 2: Summary cards -->
<div class="cards">
  <div class="card">
    <div class="label">คูปองที่ใช้</div>
    <div class="value">${esc(fmtMoney(grandCouponCount))}</div>
    <div class="unit">ใบ</div>
  </div>
  <div class="card">
    <div class="label">หักจริงรวม</div>
    <div class="value">${esc(fmtMoney(grandApplied))}</div>
    <div class="unit">บาท</div>
  </div>
  <div class="card">
    <div class="label">ยอดรวม</div>
    <div class="value">${esc(fmtMoney(grandBillTotal))}</div>
    <div class="unit">บาท</div>
  </div>
</div>

<!-- Section 3: Derived metrics -->
<div class="metrics">
  ลูกค้าจ่ายเพิ่ม: +${esc(fmtMoney(customerPayMore))} ฿ &middot; เฉลี่ย: ${esc(avgPerDay)} ใบ/วัน
</div>

<!-- Section 4: Daily summary table -->
<table class="sumtbl">
  <thead><tr>
    <th>วันที่</th>
    <th class="text-right">จำนวน</th>
    <th class="text-right">หักจริง</th>
    <th class="text-right">ยอดรวม</th>
    <th class="text-right">ส่วนต่าง</th>
  </tr></thead>
  <tbody>
    ${summaryRows}
    <tr class="total">
      <td>รวม</td>
      <td class="text-right">${esc(fmtMoney(grandCouponCount))}</td>
      <td class="text-right">${esc(fmtMoney(grandApplied))}</td>
      <td class="text-right">${esc(fmtMoney(grandBillTotal))}</td>
      <td class="text-right">+${esc(fmtMoney(Math.max(0, grandBillTotal - grandApplied)))}</td>
    </tr>
  </tbody>
</table>

<!-- Section 5: Detail per day -->
<div class="sectionGap">
  <div class="block" style="margin-bottom:3mm">
    <div style="font-size:14px;font-weight:700">รายละเอียดคูปอง</div>
    <div style="font-size:10px;color:#64748b;margin-top:2px">
      ${esc(restaurantName)} &middot; ${esc(fmtDateTHShort(startDate))} - ${esc(fmtDateTHShort(endDate))} &middot; Report ID: RPT-${esc(reportId)}
    </div>
  </div>
  ${detailHtml}
</div>

<!-- Section 6: Footer -->
<div class="report-footer">
  <div>Report ID: RPT-${esc(reportId)} &middot; สร้างโดย: ${esc(username)}</div>
  <div>9Expert Training</div>
</div>

</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportDialog({
  open,
  onOpenChange,
  groupedDays,
  summary,
  startDate,
  endDate,
  me,
}) {
  const summaryRef = useRef(null);
  const closeRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState("");

  // Stable report ID per dialog session
  const [reportId, setReportId] = useState("");
  useEffect(() => {
    if (open) {
      setReportId(generateReportId());
      setExportError("");
    }
  }, [open]);

  const restaurantName = me?.restaurant?.name || "";
  const logoUrl = me?.restaurant?.logoUrl || "";
  const username = me?.user?.name || me?.user?.username || "";

  const reportData = useMemo(() => buildReportData(groupedDays), [groupedDays]);

  // Compute grand totals from report data (per-coupon appliedAmount)
  const grandApplied = useMemo(
    () => reportData.reduce((s, d) => s + d.appliedSum, 0),
    [reportData],
  );
  const grandBillTotal = useMemo(
    () => reportData.reduce((s, d) => s + d.billTotal, 0),
    [reportData],
  );
  const grandCouponCount = useMemo(
    () => reportData.reduce((s, d) => s + d.couponCount, 0),
    [reportData],
  );

  // Consistency check
  useEffect(() => {
    if (!open || !summary) return;
    const apiCouponAmount = toNum(summary.couponAmount, 0);
    if (Math.abs(grandApplied - apiCouponAmount) > 1) {
      console.warn(
        `[Report] หักจริงรวม mismatch: computed=${grandApplied} vs API couponAmount=${apiCouponAmount}`,
      );
    }
  }, [open, summary, grandApplied]);

  const dayCount = daysBetween(startDate, endDate);
  const customerPayMore = Math.max(0, grandBillTotal - grandApplied);
  const avgPerDay = dayCount > 0 ? (grandCouponCount / dayCount).toFixed(1) : "0.0";

  const filenameBase = useMemo(
    () => ({
      restaurantName,
      startYMD: startDate,
      endYMD: endDate,
    }),
    [restaurantName, startDate, endDate],
  );

  /* ---------- PNG export ---------- */

  const handleExportPng = useCallback(async () => {
    try {
      setBusy(true);
      setExportError("");
      if (!summaryRef.current) throw new Error("Ref not available");
      const el = summaryRef.current;
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: { transform: "none" },
      });
      const filename = buildReportFilename({ ...filenameBase, ext: "png" });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("PNG export failed:", err);
      setExportError("ไม่สามารถสร้างไฟล์ PNG ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }, [filenameBase]);

  /* ---------- PDF export via window.print() ---------- */

  const handleExportPdf = useCallback(() => {
    try {
      setBusy(true);
      setExportError("");

      const w = window.open("", "_blank");
      if (!w) {
        setExportError(
          "ไม่สามารถเปิดหน้าต่างสำหรับพิมพ์ได้ กรุณาอนุญาต popup ของเว็บไซต์นี้",
        );
        setBusy(false);
        return;
      }

      const html = buildPrintHtml({
        restaurantName,
        logoUrl,
        username,
        reportId,
        startDate,
        endDate,
        dayCount,
        grandCouponCount,
        grandApplied,
        grandBillTotal,
        customerPayMore,
        avgPerDay,
        reportData,
      });

      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();

      waitImagesThenPrint(w, 1800);
    } catch (err) {
      console.error("PDF export failed:", err);
      setExportError("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }, [
    restaurantName,
    logoUrl,
    username,
    reportId,
    startDate,
    endDate,
    dayCount,
    grandCouponCount,
    grandApplied,
    grandBillTotal,
    customerPayMore,
    avgPerDay,
    reportData,
  ]);

  const busyText = "กำลังเตรียมไฟล์...";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4">
            <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
              {/* Close button */}
              <Dialog.Close asChild>
                <button
                  ref={closeRef}
                  className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>

              <Dialog.Title className="text-lg font-bold text-slate-900">
                รายงานการใช้คูปอง
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                ตรวจสอบข้อมูลแล้วกดบันทึกเป็นรูปหรือ PDF
              </Dialog.Description>

              {/* Export buttons */}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageIcon className="h-4 w-4" />
                  {busy ? busyText : "บันทึกเป็นรูป (PNG)"}
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-2xl bg-[#2B6CFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#255DE0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {busy ? busyText : "บันทึกเป็น PDF"}
                </button>
              </div>

              {exportError && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {exportError}
                </div>
              )}

              {/* ======== Summary (PNG content + on-screen preview) ======== */}
              <div className="mt-5">
                <div
                  ref={summaryRef}
                  className="rounded-2xl border border-slate-200 bg-white p-6 pb-8"
                  style={{ fontFamily: "inherit", overflow: "visible" }}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {logoUrl && (
                        <img
                          src={logoUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
                        />
                      )}
                      <div>
                        <div className="text-lg font-bold text-slate-900">
                          {restaurantName || "Restaurant"}
                        </div>
                        <div className="text-sm text-slate-500">
                          รายงานการใช้คูปอง 9Expert
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>
                        ช่วง: {fmtDateTHShort(startDate)} - {fmtDateTHShort(endDate)}{" "}
                        ({dayCount} วัน)
                      </div>
                      <div>ออก ณ: {fmtDateTimeNowTH()}</div>
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-500">คูปองที่ใช้</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {fmtMoney(grandCouponCount)}
                      </div>
                      <div className="text-xs text-slate-400">ใบ</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-500">หักจริงรวม</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {fmtMoney(grandApplied)}
                      </div>
                      <div className="text-xs text-slate-400">บาท</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-500">ยอดรวม</div>
                      <div className="mt-1 text-xl font-bold text-slate-900">
                        {fmtMoney(grandBillTotal)}
                      </div>
                      <div className="text-xs text-slate-400">บาท</div>
                    </div>
                  </div>

                  {/* Derived metrics */}
                  <div className="mt-3 text-xs text-slate-500">
                    ลูกค้าจ่ายเพิ่ม: +{fmtMoney(customerPayMore)} ฿ · เฉลี่ย: {avgPerDay} ใบ/วัน
                  </div>

                  {/* Daily summary table */}
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-xs text-slate-600">
                          <th className="border-b border-slate-200 px-3 py-2">วันที่</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">จำนวน</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">หักจริง</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">ยอดรวม</th>
                          <th className="border-b border-slate-200 px-3 py-2 text-right">ส่วนต่าง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((day, i) => (
                          <tr
                            key={day.dayKey}
                            className={i % 2 === 1 ? "bg-slate-50/50" : ""}
                          >
                            <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                              {fmtDateTHShort(day.dayKey)}{" "}
                              <span className="text-slate-400">
                                ({fmtDayNameTH(day.dayKey)})
                              </span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-right">
                              {fmtMoney(day.couponCount)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-right">
                              {fmtMoney(day.appliedSum)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-right">
                              {fmtMoney(day.billTotal)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 text-right">
                              +{fmtMoney(day.diff)}
                            </td>
                          </tr>
                        ))}
                        {/* Grand total row */}
                        <tr className="bg-slate-100 font-bold">
                          <td className="px-3 py-2 text-slate-900">รวม</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(grandCouponCount)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(grandApplied)}</td>
                          <td className="px-3 py-2 text-right">{fmtMoney(grandBillTotal)}</td>
                          <td className="px-3 py-2 text-right">
                            +{fmtMoney(Math.max(0, grandBillTotal - grandApplied))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 space-y-1 text-xs text-slate-400">
                    <div>* สำหรับรายละเอียดคูปอง ดูในไฟล์ PDF</div>
                    <div>
                      Report ID: RPT-{reportId} · สร้างโดย: {username}
                    </div>
                    <div>9Expert Training</div>
                  </div>
                </div>
              </div>

              {/* ======== Detail section (on-screen preview) ======== */}
              <div className="mt-5">
                <div className="text-sm font-bold text-slate-700">
                  รายละเอียดคูปอง (จะแสดงในไฟล์ PDF)
                </div>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="text-base font-bold text-slate-900">
                    รายละเอียดคูปอง
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {restaurantName} · {fmtDateTHShort(startDate)} - {fmtDateTHShort(endDate)} · Report ID: RPT-{reportId}
                  </div>

                  {/* Days — newest first */}
                  <div className="mt-4 space-y-5">
                    {reportData.map((day) => (
                      <div key={day.dayKey}>
                        {/* Day header */}
                        <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2">
                          <div className="text-sm font-semibold text-slate-700">
                            {fmtDateTHLong(day.dayKey)} ({fmtDayNameTH(day.dayKey)})
                          </div>
                          <div className="text-xs text-slate-500">
                            {day.couponCount} คูปอง · หักจริง {fmtMoney(day.appliedSum)} ฿ · ยอดรวม {fmtMoney(day.billTotal)} ฿
                          </div>
                        </div>

                        {/* Bills */}
                        <div className="mt-2 space-y-3">
                          {day.bills.map((bill, bi) => (
                            <div key={bill.billCode || `bill-${bi}`}>
                              {/* Bill header */}
                              <div className="flex items-center justify-between px-1 text-xs text-slate-600">
                                <div className="font-semibold">
                                  บิล {bill.billCode || "ไม่มีรหัสบิล"} · {fmtTimeBKK(bill.redeemedAt)}
                                </div>
                                <div>
                                  Face {fmtMoney(bill.faceSum)} ฿ · หักจริง {fmtMoney(bill.appliedSum)} ฿ · ยอดบิล {fmtMoney(bill.billTotal)} ฿ · ส่วนต่าง {fmtMoney(bill.diff)} ฿
                                </div>
                              </div>

                              {/* Coupon table */}
                              <div className="mt-1 overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-slate-50 text-left text-slate-600">
                                      <th className="border-b border-slate-200 px-3 py-1.5 w-8">#</th>
                                      <th className="border-b border-slate-200 px-3 py-1.5">รหัสคูปอง</th>
                                      <th className="border-b border-slate-200 px-3 py-1.5">เวลา</th>
                                      <th className="border-b border-slate-200 px-3 py-1.5 text-right">Face</th>
                                      <th className="border-b border-slate-200 px-3 py-1.5 text-right">หักจริง</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bill.items.map((it, idx) => {
                                      const face = toNum(it._faceValue, DEFAULT_COUPON_FACE_VALUE);
                                      const applied = toNum(it._appliedAmount, 0);
                                      const isPartial = applied < face;

                                      return (
                                        <tr
                                          key={it.displayCode || idx}
                                          className={idx % 2 === 1 ? "bg-slate-50/50" : ""}
                                        >
                                          <td className="border-b border-slate-100 px-3 py-1.5 text-slate-500">
                                            {it._order || idx + 1}
                                          </td>
                                          <td className="border-b border-slate-100 px-3 py-1.5 font-mono text-slate-700">
                                            {formatCouponCodeForDisplay(it.displayCode)}
                                          </td>
                                          <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">
                                            {fmtTimeBKK(it.redeemedAt)}
                                          </td>
                                          <td className="border-b border-slate-100 px-3 py-1.5 text-right text-slate-700">
                                            {fmtMoney(face)}
                                          </td>
                                          <td
                                            className={`border-b border-slate-100 px-3 py-1.5 text-right font-semibold ${
                                              isPartial
                                                ? "text-amber-600"
                                                : "text-slate-700"
                                            }`}
                                          >
                                            {fmtMoney(applied)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {/* Bill subtotal */}
                                    <tr className="bg-slate-50 font-semibold">
                                      <td
                                        colSpan={3}
                                        className="px-3 py-1.5 text-slate-700"
                                      >
                                        รวม {bill.couponCount} คูปอง
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-slate-700">
                                        {fmtMoney(bill.faceSum)}
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-slate-700">
                                        {fmtMoney(bill.appliedSum)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detail footer */}
                  <div className="mt-5 space-y-1 text-xs text-slate-400">
                    <div>
                      Report ID: RPT-{reportId} · สร้างโดย: {username}
                    </div>
                    <div>9Expert Training</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
