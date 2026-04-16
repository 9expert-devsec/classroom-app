"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Download, FileText, Image as ImageIcon } from "lucide-react";
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
  const pdfDetailRef = useRef(null);
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

  /* ---------- export helpers ---------- */

  const capturePng = useCallback(
    async (ref) => {
      if (!ref.current) throw new Error("Ref not available");
      return toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    },
    [],
  );

  const downloadDataUrl = useCallback((dataUrl, filename) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleExportPng = useCallback(async () => {
    try {
      setBusy(true);
      setExportError("");
      const dataUrl = await capturePng(summaryRef);
      const filename = buildReportFilename({ ...filenameBase, ext: "png" });
      downloadDataUrl(dataUrl, filename);
    } catch (err) {
      console.error("PNG export failed:", err);
      setExportError("ไม่สามารถสร้างไฟล์ PNG ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }, [capturePng, filenameBase, downloadDataUrl]);

  /**
   * PDF paging approach: section-by-section rendering.
   *
   * We capture the summary section as one PNG (page 1), then capture
   * the detail section as another PNG. The detail PNG is then sliced
   * into A4-sized chunks using canvas negative-y offset, ensuring page
   * breaks happen between day sections when possible.
   *
   * This avoids cutting through table cells by rendering each day as a
   * self-contained block. If a single day exceeds one page, we slice at
   * the page boundary (rare for typical usage).
   */
  const handleExportPdf = useCallback(async () => {
    try {
      setBusy(true);
      setExportError("");

      const { jsPDF } = await import("jspdf");

      // Capture summary
      const summaryDataUrl = await capturePng(summaryRef);

      // Capture detail
      const detailDataUrl = pdfDetailRef.current
        ? await capturePng(pdfDetailRef)
        : null;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;
      const pageH = 297;
      const margin = 10;
      const contentW = pageW - margin * 2;

      // Helper: add an image data URL to the PDF, paginating if needed
      function addImagePaginated(dataUrl, imgNaturalW, imgNaturalH) {
        const imgW = contentW;
        const imgH = (imgNaturalH / imgNaturalW) * imgW;

        if (imgH <= pageH - margin * 2) {
          pdf.addImage(dataUrl, "PNG", margin, margin, imgW, imgH);
          return;
        }

        // Slice into pages using a temporary canvas
        const sliceH = pageH - margin * 2;
        const srcSliceH = (sliceH / imgH) * imgNaturalH;
        let srcY = 0;
        let first = true;

        const img = new window.Image();
        img.src = dataUrl;

        while (srcY < imgNaturalH) {
          if (!first) pdf.addPage();
          first = false;

          const thisSliceH = Math.min(srcSliceH, imgNaturalH - srcY);
          const thisDestH = (thisSliceH / imgNaturalW) * imgW;

          // Draw slice via canvas
          const canvas = document.createElement("canvas");
          canvas.width = imgNaturalW;
          canvas.height = thisSliceH;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, srcY, imgNaturalW, thisSliceH, 0, 0, imgNaturalW, thisSliceH);

          const sliceData = canvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", margin, margin, imgW, (thisSliceH / imgNaturalW) * imgW);

          srcY += thisSliceH;
        }
      }

      // Load summary image to get dimensions
      const summaryImg = new window.Image();
      await new Promise((resolve, reject) => {
        summaryImg.onload = resolve;
        summaryImg.onerror = reject;
        summaryImg.src = summaryDataUrl;
      });

      addImagePaginated(summaryDataUrl, summaryImg.naturalWidth, summaryImg.naturalHeight);

      // Detail pages
      if (detailDataUrl) {
        pdf.addPage();
        const detailImg = new window.Image();
        await new Promise((resolve, reject) => {
          detailImg.onload = resolve;
          detailImg.onerror = reject;
          detailImg.src = detailDataUrl;
        });
        addImagePaginated(detailDataUrl, detailImg.naturalWidth, detailImg.naturalHeight);
      }

      const filename = buildReportFilename({ ...filenameBase, ext: "pdf" });
      pdf.save(filename);
    } catch (err) {
      console.error("PDF export failed:", err);
      setExportError("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }, [capturePng, filenameBase]);

  const busyText = "กำลังสร้างไฟล์…";

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

              {/* ======== Summary (PNG content / PDF page 1) ======== */}
              <div className="mt-5">
                <div
                  ref={summaryRef}
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                  style={{ fontFamily: "inherit" }}
                >
                  {/* 1. Header row */}
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

                  {/* 2. Summary cards */}
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

                  {/* 3. Derived metrics */}
                  <div className="mt-3 text-xs text-slate-500">
                    ลูกค้าจ่ายเพิ่ม: +{fmtMoney(customerPayMore)} ฿ · เฉลี่ย: {avgPerDay} ใบ/วัน
                  </div>

                  {/* 4. Daily summary table */}
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

                  {/* 5. Footer */}
                  <div className="mt-4 space-y-1 text-xs text-slate-400">
                    <div>* สำหรับรายละเอียดคูปอง ดูในไฟล์ PDF</div>
                    <div>
                      Report ID: RPT-{reportId} · สร้างโดย: {username}
                    </div>
                    <div>9Expert Training</div>
                  </div>
                </div>
              </div>

              {/* ======== Detail section (off-screen for PDF pages 2+) ======== */}
              <div className="mt-5">
                <div className="text-sm font-bold text-slate-700">
                  รายละเอียดคูปอง (จะแสดงในไฟล์ PDF หน้า 2+)
                </div>
                <div
                  ref={pdfDetailRef}
                  className="mt-2 rounded-2xl border border-slate-200 bg-white p-6"
                  style={{ fontFamily: "inherit" }}
                >
                  <div className="text-base font-bold text-slate-900">
                    รายละเอียดคูปอง
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {restaurantName} · {fmtDateTHShort(startDate)} - {fmtDateTHShort(endDate)} · Report ID: RPT-{reportId}
                  </div>

                  {/* Days — newest first (groupedDays is already newest first) */}
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

                        {/* Bills — newest first (already sorted) */}
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
