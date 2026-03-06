"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";

/* ================= helpers ================= */

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDateTimeTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function todayYMD_BKK() {
  // en-CA => YYYY-MM-DD (Asia/Bangkok)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ✅ เงื่อนไขใหม่: ถ้าใช้ไม่ถึง/เท่ากับยอดคูปอง => payMore = 0
function payMoreOf(spent, couponTotal) {
  const s = Number(spent);
  const c = Number(couponTotal);
  if (!Number.isFinite(s) || !Number.isFinite(c)) return 0;
  return Math.max(0, s - c);
}

// กันข้อความใน CSV
function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, csvText) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openPrintWindow(title, html) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

const STATUS_OPTIONS = ["all", "issued", "redeemed", "void", "expired"];

/* ================= Modal ================= */

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>
          <button
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ================= main ================= */

export default function CouponsClient({ adminKey }) {
  // ✅ default = Bills
  const [view, setView] = useState("bills"); // "bills" | "coupons"

  const [q, setQ] = useState("");
  const [dayYMD, setDayYMD] = useState(() => todayYMD_BKK());
  const [status, setStatus] = useState("all");
  const [merchantId, setMerchantId] = useState("all");

  // Coupons view pagination (เพราะ API เดิม paginate เป็น “รายใบ”)
  const [page, setPage] = useState(1);
  const COUPON_LIMIT = 30;
  const BILL_LIMIT = 2000; // กัน bill แตกข้ามหน้า

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0); // total coupons (ตาม API)
  const [merchantOptions, setMerchantOptions] = useState([]);

  // modal qr
  const [qrOpen, setQrOpen] = useState(false);
  const [qrRow, setQrRow] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  const BASE = useMemo(() => {
    const env = clean(process.env.NEXT_PUBLIC_BASE_URL);
    if (env) return env.replace(/\/+$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  }, []);

  function makeCouponUrl(publicId) {
    const pid = clean(publicId);
    if (!pid) return "";
    return `${BASE}/coupon/${encodeURIComponent(pid)}`;
  }

  function openQrModal(row) {
    setQrRow(row);
    setCopyMsg("");
    setQrOpen(true);
  }

  async function copyToClipboard(text) {
    setCopyMsg("");
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg("คัดลอกแล้ว");
      setTimeout(() => setCopyMsg(""), 1200);
    } catch {
      setCopyMsg("คัดลอกไม่สำเร็จ");
      setTimeout(() => setCopyMsg(""), 1200);
    }
  }

  async function load() {
    setLoading(true);
    setErr("");

    const effectiveLimit = view === "bills" ? BILL_LIMIT : COUPON_LIMIT;
    const effectivePage = view === "bills" ? 1 : page;

    try {
      const sp = new URLSearchParams();
      sp.set("page", String(effectivePage));
      sp.set("limit", String(effectiveLimit));
      if (clean(q)) sp.set("q", clean(q));
      if (clean(dayYMD)) sp.set("day", clean(dayYMD));
      if (status && status !== "all") sp.set("status", status);
      if (merchantId && merchantId !== "all") sp.set("merchantId", merchantId);

      const r = await fetch(`/api/admin/coupons?${sp.toString()}`, {
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "LOAD_FAILED");

      setItems(Array.isArray(j.items) ? j.items : []);
      setTotal(Number(j.total || 0));
      setMerchantOptions(Array.isArray(j.merchants) ? j.merchants : []);
    } catch (e) {
      setErr(String(e?.message || "LOAD_FAILED"));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // reload
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, page, q, dayYMD, status, merchantId]);

  // reset page เมื่อ filter เปลี่ยน (เฉพาะ coupons view)
  useEffect(() => {
    if (view !== "coupons") return;
    setPage(1);
  }, [view, q, dayYMD, status, merchantId]);

  /* =================== Bills (default) =================== */

  // 1) group coupon rows -> bills
  const bills = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const map = new Map();

    for (const it of rows) {
      const billCode = clean(it.billCode);
      const key =
        billCode ||
        `SINGLE:${it.id || it._id || it.displayCode || Math.random()}`;

      if (!map.has(key)) {
        map.set(key, {
          billCode: billCode || "",
          billDayYMD: clean(it.billDayYMD) || clean(it.dayYMD) || "",
          courseName: clean(it.courseName),
          roomName: clean(it.roomName),
          merchantName: clean(it.merchantName),
          redeemedAt: it.redeemedAt || null,
          status: clean(it.status) || "",
          coupons: [],
          // metrics (จะคำนวณทีหลัง)
          couponTotal: 0,
          billTotal: 0,
          payMore: 0,
        });
      }

      const b = map.get(key);
      b.coupons.push(it);

      // เติม merchant/status/time ให้ “ล่าสุด” (เผื่อ data ไม่ครบ)
      if (!b.merchantName && clean(it.merchantName))
        b.merchantName = clean(it.merchantName);

      // status: ถ้ามี redeemed สักใบ ให้ถือว่า bill redeemed
      if (b.status !== "redeemed" && clean(it.status) === "redeemed")
        b.status = "redeemed";
      if (!b.status) b.status = clean(it.status);

      // redeemedAt: เอาเวลาล่าสุด
      const cur = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
      const nxt = it.redeemedAt ? new Date(it.redeemedAt).getTime() : 0;
      if (nxt > cur) b.redeemedAt = it.redeemedAt || b.redeemedAt;
    }

    const out = Array.from(map.values()).map((b) => {
      // coupon total = sum(couponPrice)
      const couponTotal = b.coupons.reduce((a, x) => {
        const p = Number(x.couponPrice ?? 180);
        return a + (Number.isFinite(p) ? p : 180);
      }, 0);

      // bill total:
      // - ถ้ามี billTotal field ใช้เลย
      // - ถ้าไม่มี ใช้ sum(spentAmount) (เพราะ batch เรา set ใบแรกเป็นยอดเต็ม ใบอื่น 0)
      const fieldBillTotal = b.coupons.reduce((mx, x) => {
        const v = Number(x.billTotal);
        return Number.isFinite(v) && v > mx ? v : mx;
      }, 0);

      const sumSpent = b.coupons.reduce((a, x) => {
        const s = Number(x.spentAmount ?? 0);
        return a + (Number.isFinite(s) ? s : 0);
      }, 0);

      const billTotal = fieldBillTotal > 0 ? fieldBillTotal : sumSpent;

      const payMore = payMoreOf(billTotal, couponTotal);

      return {
        ...b,
        couponTotal,
        billTotal,
        payMore,
        couponCount: b.coupons.length,
        title:
          [b.courseName, b.roomName, b.billDayYMD]
            .filter(Boolean)
            .join(" • ") || "Unknown class",
      };
    });

    // sort newest first (redeemedAt desc, else by billCode)
    out.sort((a, b) => {
      const ta = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
      const tb = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(b.billCode || "").localeCompare(
        String(a.billCode || ""),
        "th",
      );
    });

    return out;
  }, [items]);

  // 2) group bills by class title
  const billGroups = useMemo(() => {
    const map = new Map();
    for (const b of bills) {
      const key = clean(b.title) || "Unknown class";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }

    const out = Array.from(map.entries()).map(([title, rows]) => {
      const billCount = rows.length;
      const couponCount = rows.reduce((a, x) => a + (x.couponCount || 0), 0);
      const sumBillTotal = rows.reduce(
        (a, x) => a + (Number(x.billTotal) || 0),
        0,
      );
      const sumCouponTotal = rows.reduce(
        (a, x) => a + (Number(x.couponTotal) || 0),
        0,
      );
      const sumPayMore = rows.reduce((a, x) => a + (Number(x.payMore) || 0), 0);

      return {
        title,
        rows,
        stats: {
          billCount,
          couponCount,
          sumBillTotal,
          sumCouponTotal,
          sumPayMore,
        },
      };
    });

    out.sort((a, b) => a.title.localeCompare(b.title, "th"));
    return out;
  }, [bills]);

  const [openBills, setOpenBills] = useState({});
  function toggleBill(key) {
    setOpenBills((m) => ({ ...m, [key]: !m[key] }));
  }

  /* =================== Coupons view (รายใบ) =================== */

  const couponsGroupedByClass = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const map = new Map();

    for (const it of rows) {
      const title = [it.courseName, it.roomName, it.dayYMD]
        .map(clean)
        .filter(Boolean)
        .join(" • ");
      const key = title || "Unknown class";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }

    const out = Array.from(map.entries())
      .map(([title, rows]) => ({
        title,
        rows,
        stats: {
          issued: rows.filter((x) => x.status === "issued").length,
          redeemed: rows.filter((x) => x.status === "redeemed").length,
        },
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "th"));

    return out;
  }, [items]);

  const totalPages = useMemo(() => {
    if (view !== "coupons") return 1;
    return Math.max(1, Math.ceil(total / COUPON_LIMIT));
  }, [view, total]);

  /* =================== Export / Print =================== */

  async function fetchAllForExport() {
    const sp = new URLSearchParams();
    sp.set("page", "1");
    sp.set("limit", "2000");
    if (clean(q)) sp.set("q", clean(q));
    if (clean(dayYMD)) sp.set("day", clean(dayYMD));
    if (status && status !== "all") sp.set("status", status);
    if (merchantId && merchantId !== "all") sp.set("merchantId", merchantId);

    const r = await fetch(`/api/admin/coupons?${sp.toString()}`, {
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || "EXPORT_FAILED");
    return Array.isArray(j.items) ? j.items : [];
  }

  async function exportCsv() {
    try {
      const rows = await fetchAllForExport();

      if (view === "bills") {
        // rebuild bills from export rows (เพื่อให้ครบ)
        const map = new Map();
        for (const it of rows) {
          const billCode = clean(it.billCode);
          const key =
            billCode ||
            `SINGLE:${it.id || it._id || it.displayCode || Math.random()}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(it);
        }

        const header = [
          "BillCode",
          "dayYMD",
          "Class",
          "ร้าน",
          "สถานะ",
          "จำนวนคูปอง",
          "ยอดคูปองรวม",
          "ยอดบิลรวม",
          "ลูกค้าจ่ายเพิ่ม",
          "เวลาใช้ล่าสุด",
          "Refs",
          "ผู้ถือคูปอง",
        ];
        const lines = [header.map(csvEscape).join(",")];

        for (const [key, itemsInBill] of map.entries()) {
          const couponTotal = itemsInBill.reduce(
            (a, x) => a + (Number(x.couponPrice ?? 180) || 180),
            0,
          );

          const fieldBillTotal = itemsInBill.reduce((mx, x) => {
            const v = Number(x.billTotal);
            return Number.isFinite(v) && v > mx ? v : mx;
          }, 0);
          const sumSpent = itemsInBill.reduce(
            (a, x) => a + (Number(x.spentAmount ?? 0) || 0),
            0,
          );
          const billTotal = fieldBillTotal > 0 ? fieldBillTotal : sumSpent;

          const payMore = payMoreOf(billTotal, couponTotal);

          const day =
            clean(itemsInBill[0]?.billDayYMD) ||
            clean(itemsInBill[0]?.dayYMD) ||
            "";
          const classTitle = [
            itemsInBill[0]?.courseName,
            itemsInBill[0]?.roomName,
            day,
          ]
            .map(clean)
            .filter(Boolean)
            .join(" • ");

          const merchantName =
            clean(
              itemsInBill.find((x) => clean(x.merchantName))?.merchantName,
            ) || "-";
          const status2 = itemsInBill.some(
            (x) => clean(x.status) === "redeemed",
          )
            ? "redeemed"
            : clean(itemsInBill[0]?.status) || "";

          const maxRedeemedAt = itemsInBill.reduce((best, x) => {
            const t = x.redeemedAt ? new Date(x.redeemedAt).getTime() : 0;
            return t > best ? t : best;
          }, 0);
          const redeemedAtLabel = maxRedeemedAt
            ? fmtDateTimeTH(new Date(maxRedeemedAt).toISOString())
            : "-";

          const billCode2 = clean(itemsInBill[0]?.billCode) || "";
          const refs = itemsInBill
            .map((x) => clean(x.displayCode))
            .filter(Boolean)
            .join(" | ");
          const holders = itemsInBill
            .map((x) => clean(x.holderName))
            .filter(Boolean)
            .join(" | ");

          lines.push(
            [
              billCode2 || key,
              day,
              classTitle,
              merchantName,
              status2,
              itemsInBill.length,
              couponTotal,
              billTotal,
              payMore,
              redeemedAtLabel,
              refs,
              holders,
            ]
              .map(csvEscape)
              .join(","),
          );
        }

        const fname = `coupon-bills_${dayYMD || "all"}_${status || "all"}.csv`;
        downloadCsv(fname, lines.join("\n"));
        return;
      }

      // coupons export (รายใบ)
      const header = [
        "Ref",
        "ผู้ถือคูปอง",
        "คอร์ส",
        "ห้อง",
        "dayYMD",
        "สถานะ",
        "ร้านที่ใช้",
        "ยอดคูปอง",
        "ยอดจริง",
        "ลูกค้าจ่ายเพิ่ม",
        "เวลาใช้",
        "ลิงก์คูปอง",
        "BillCode",
      ];
      const lines = [header.map(csvEscape).join(",")];

      for (const it of rows) {
        const couponUrl = it.publicId ? makeCouponUrl(it.publicId) : "";
        const payMore = payMoreOf(
          Number(it.spentAmount || 0),
          Number(it.couponPrice ?? 180),
        );

        lines.push(
          [
            it.displayCode,
            it.holderName,
            it.courseName,
            it.roomName,
            it.dayYMD,
            it.status,
            it.merchantName || "",
            it.couponPrice ?? 180,
            it.spentAmount ?? 0,
            payMore,
            it.redeemedAt ? fmtDateTimeTH(it.redeemedAt) : "",
            couponUrl,
            it.billCode || "",
          ]
            .map(csvEscape)
            .join(","),
        );
      }

      const fname = `coupon-items_${dayYMD || "all"}_${status || "all"}.csv`;
      downloadCsv(fname, lines.join("\n"));
    } catch (e) {
      alert(String(e?.message || "EXPORT_FAILED"));
    }
  }

  function printPage() {
    if (view !== "bills") {
      // print coupons current page
      const rows = items || [];
      const title = "Coupon Items";

      const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${title}</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;}
h1{font-size:18px;margin:0 0 12px;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{border:1px solid #ddd;padding:6px;vertical-align:top;}
th{background:#f3f4f6;}
.right{text-align:right;}
</style></head><body>
<h1>${title}</h1>
<div style="margin:0 0 10px;font-size:12px;color:#444;">
Filter: day=${dayYMD || "all"} | status=${status} | merchant=${merchantId === "all" ? "all" : merchantId} | q=${clean(q) || "-"}
</div>
<table>
<thead><tr>
<th>Ref</th><th>ผู้ถือคูปอง</th><th>คอร์ส</th><th>ห้อง</th><th>dayYMD</th><th>สถานะ</th><th>ร้านที่ใช้</th>
<th class="right">ยอดจริง</th><th class="right">ลูกค้าจ่ายเพิ่ม</th><th>เวลาใช้</th>
</tr></thead>
<tbody>
${rows
  .map((it) => {
    const payMore = payMoreOf(
      Number(it.spentAmount || 0),
      Number(it.couponPrice ?? 180),
    );
    return `<tr>
<td>${it.displayCode || "-"}</td>
<td>${it.holderName || "-"}</td>
<td>${it.courseName || "-"}</td>
<td>${it.roomName || "-"}</td>
<td>${it.dayYMD || "-"}</td>
<td>${it.status || "-"}</td>
<td>${it.merchantName || "-"}</td>
<td class="right">${fmtMoney(it.spentAmount)}</td>
<td class="right">${payMore > 0 ? "+" : ""}${fmtMoney(payMore)}</td>
<td>${it.redeemedAt ? fmtDateTimeTH(it.redeemedAt) : "-"}</td>
</tr>`;
  })
  .join("")}
</tbody></table></body></html>`;

      openPrintWindow(title, html);
      return;
    }

    // print bills grouped
    const groups = billGroups;
    const title = "Coupon Bills";

    const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>${title}</title>
<style>
body{font-family:Arial,sans-serif;padding:16px;}
h1{font-size:18px;margin:0 0 12px;}
h2{font-size:14px;margin:18px 0 6px;}
.meta{margin:0 0 10px;font-size:12px;color:#444;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{border:1px solid #ddd;padding:6px;vertical-align:top;}
th{background:#f3f4f6;}
.right{text-align:right;}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;}
.b-red{background:#d1fae5;color:#047857;}
.b-issue{background:#dbeafe;color:#1d4ed8;}
</style></head><body>
<h1>${title}</h1>
<div class="meta">Filter: day=${dayYMD || "all"} | status=${status} | merchant=${merchantId === "all" ? "all" : merchantId} | q=${clean(q) || "-"}</div>

${groups
  .map((g) => {
    return `
<h2>${g.title}</h2>
<div class="meta">Bills ${g.stats.billCount} • Coupons ${g.stats.couponCount} • BillTotal ${fmtMoney(g.stats.sumBillTotal)} • PayMore ${fmtMoney(g.stats.sumPayMore)}</div>
<table>
<thead><tr>
<th>Bill</th><th>ร้าน</th><th>สถานะ</th><th class="right">คูปองรวม</th><th class="right">ยอดบิล</th><th class="right">จ่ายเพิ่ม</th><th>เวลาใช้</th><th>Refs</th>
</tr></thead>
<tbody>
${g.rows
  .map((b) => {
    const badge = b.status === "redeemed" ? "badge b-red" : "badge b-issue";
    const refs = b.coupons
      .map((x) => clean(x.displayCode))
      .filter(Boolean)
      .join(", ");
    return `<tr>
<td>${clean(b.billCode) || "-"}</td>
<td>${b.merchantName || "-"}</td>
<td><span class="${badge}">${b.status || "-"}</span></td>
<td class="right">${fmtMoney(b.couponTotal)}</td>
<td class="right">${fmtMoney(b.billTotal)}</td>
<td class="right">${b.payMore > 0 ? "+" : ""}${fmtMoney(b.payMore)}</td>
<td>${b.redeemedAt ? fmtDateTimeTH(b.redeemedAt) : "-"}</td>
<td>${refs}</td>
</tr>`;
  })
  .join("")}
</tbody></table>
`;
  })
  .join("")}

</body></html>`;

    openPrintWindow(title, html);
  }

  const couponUrl = qrRow?.publicId ? makeCouponUrl(qrRow.publicId) : "";

  /* =================== UI =================== */

  const headerTotalLabel = useMemo(() => {
    if (view === "bills") {
      const billCount = bills.length;
      const couponCount = items.length;
      return `รวม ${billCount.toLocaleString("th-TH")} บิล • ${couponCount.toLocaleString("th-TH")} คูปอง`;
    }
    return `รวม ${total.toLocaleString("th-TH")} รายการ`;
  }, [view, bills.length, items.length, total]);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Coupon Tracking</h1>
          <p className="text-sm text-slate-500">
            ดูแบบ Bills (default) หรือ Coupons (รายใบ)
          </p>
        </div>
        <a
          className="text-sm font-semibold text-blue-600 hover:underline"
          href={`/${adminKey}/admin/classroom`}
        >
          ← กลับ Dashboard
        </a>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setView("bills")}
          className={cx(
            "rounded-xl px-3 py-2 text-sm font-semibold border",
            view === "bills"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
          )}
        >
          Bills (default)
        </button>
        <button
          type="button"
          onClick={() => setView("coupons")}
          className={cx(
            "rounded-xl px-3 py-2 text-sm font-semibold border",
            view === "coupons"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
          )}
        >
          Coupons (รายใบ)
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">
              ค้นหา (ชื่อ/Ref/คอร์ส)
            </div>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="เช่น 9XP4364 หรือ John"
            />
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">
              วันที่ (dayYMD){" "}
              <span className="text-slate-400">(default วันนี้)</span>
            </div>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={dayYMD}
              onChange={(e) => setDayYMD(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 text-xs text-blue-600 hover:underline"
              onClick={() => setDayYMD(todayYMD_BKK())}
            >
              ตั้งเป็น “วันนี้”
            </button>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">สถานะ</div>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-500 mb-1">ร้าน</div>
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
            >
              <option value="all">ทั้งหมด</option>
              {merchantOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <div>{headerTotalLabel}</div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
              onClick={exportCsv}
              disabled={loading}
            >
              Export CSV
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
              onClick={printPage}
              disabled={loading}
            >
              Print
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
              onClick={load}
              disabled={loading}
            >
              {loading ? "กำลังโหลด..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4 space-y-4">
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
            กำลังโหลด...
          </div>
        ) : view === "bills" ? (
          billGroups.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              ไม่พบรายการ
            </div>
          ) : (
            billGroups.map((g) => (
              <div
                key={g.title}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* group header */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border-b">
                  <div>
                    <div className="text-sm font-semibold">{g.title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Bills {g.stats.billCount} • Coupons {g.stats.couponCount}
                      {" • "}BillTotal {fmtMoney(g.stats.sumBillTotal)}฿{" • "}
                      PayMore{" "}
                      <span
                        className={
                          g.stats.sumPayMore > 0
                            ? "text-red-600"
                            : "text-slate-500"
                        }
                      >
                        {g.stats.sumPayMore > 0 ? "+" : ""}
                        {fmtMoney(g.stats.sumPayMore)}฿
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Bill</th>
                        <th className="text-left px-3 py-2">สถานะ</th>
                        <th className="text-left px-3 py-2">ร้าน</th>
                        <th className="text-right px-3 py-2">จำนวนคูปอง</th>
                        <th className="text-right px-3 py-2">คูปองรวม</th>
                        <th className="text-right px-3 py-2">ยอดบิล</th>
                        <th className="text-right px-3 py-2">
                          ลูกค้าจ่ายเพิ่ม
                        </th>
                        <th className="text-left px-3 py-2">เวลาใช้</th>
                        <th className="text-left px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((b) => {
                        const key =
                          b.billCode ||
                          `SINGLE:${b.title}:${b.redeemedAt || ""}:${b.couponCount}`;
                        const opened = !!openBills[key];

                        return (
                          <>
                            <tr key={key} className="border-t">
                              <td className="px-3 py-2 font-semibold">
                                {b.billCode || "-"}
                              </td>

                              <td className="px-3 py-2">
                                <span
                                  className={cx(
                                    "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                                    b.status === "redeemed"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : b.status === "issued"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-slate-100 text-slate-700",
                                  )}
                                >
                                  {b.status || "-"}
                                </span>
                              </td>

                              <td className="px-3 py-2">
                                {b.merchantName || "-"}
                              </td>

                              <td className="px-3 py-2 text-right">
                                {fmtMoney(b.couponCount)}
                              </td>

                              <td className="px-3 py-2 text-right">
                                {fmtMoney(b.couponTotal)}
                              </td>

                              <td className="px-3 py-2 text-right">
                                {fmtMoney(b.billTotal)}
                              </td>

                              <td
                                className={cx(
                                  "px-3 py-2 text-right",
                                  b.payMore > 0
                                    ? "text-red-600"
                                    : "text-slate-500",
                                )}
                              >
                                {b.payMore > 0 ? "+" : ""}
                                {fmtMoney(b.payMore)}
                              </td>

                              <td className="px-3 py-2">
                                {fmtDateTimeTH(b.redeemedAt)}
                              </td>

                              <td className="px-3 py-2">
                                <div className="flex gap-2">
                                  <button
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                                    onClick={() => toggleBill(key)}
                                  >
                                    {opened ? "ซ่อนรายการ" : "ดูคูปอง"}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {opened ? (
                              <tr className="border-t bg-slate-50/60">
                                <td colSpan={9} className="px-3 py-3">
                                  <div className="text-xs text-slate-500 mb-2">
                                    รายการคูปองในบิลนี้ ({b.coupons.length})
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="min-w-[980px] w-full text-xs bg-white border border-slate-200 rounded-xl overflow-hidden">
                                      <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                          <th className="text-left px-3 py-2">
                                            Ref
                                          </th>
                                          <th className="text-left px-3 py-2">
                                            ผู้ถือคูปอง
                                          </th>
                                          <th className="text-left px-3 py-2">
                                            สถานะ
                                          </th>
                                          <th className="text-right px-3 py-2">
                                            ยอดคูปอง
                                          </th>
                                          <th className="text-left px-3 py-2">
                                            เวลาใช้
                                          </th>
                                          <th className="text-left px-3 py-2">
                                            Actions
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {b.coupons.map((it) => {
                                          const couponUrl2 = it.publicId
                                            ? makeCouponUrl(it.publicId)
                                            : "";
                                          return (
                                            <tr
                                              key={it.id}
                                              className="border-t"
                                            >
                                              <td className="px-3 py-2 font-semibold">
                                                {it.displayCode || "-"}
                                              </td>
                                              <td className="px-3 py-2">
                                                {it.holderName || "-"}
                                              </td>
                                              <td className="px-3 py-2">
                                                <span
                                                  className={cx(
                                                    "inline-flex rounded-full px-2 py-0.5 font-semibold",
                                                    it.status === "redeemed"
                                                      ? "bg-emerald-100 text-emerald-700"
                                                      : it.status === "issued"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-slate-100 text-slate-700",
                                                  )}
                                                >
                                                  {it.status || "-"}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                {fmtMoney(
                                                  it.couponPrice ?? 180,
                                                )}
                                              </td>
                                              <td className="px-3 py-2">
                                                {fmtDateTimeTH(it.redeemedAt)}
                                              </td>
                                              <td className="px-3 py-2">
                                                <div className="flex gap-2">
                                                  <button
                                                    className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                                                    disabled={!it.publicId}
                                                    onClick={() =>
                                                      openQrModal(it)
                                                    }
                                                  >
                                                    View QR
                                                  </button>
                                                  <button
                                                    className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
                                                    disabled={!couponUrl2}
                                                    onClick={() =>
                                                      copyToClipboard(
                                                        couponUrl2,
                                                      )
                                                    }
                                                  >
                                                    Copy link
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )
        ) : // coupons view
        couponsGroupedByClass.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
            ไม่พบรายการ
          </div>
        ) : (
          <>
            {couponsGroupedByClass.map((g) => (
              <div
                key={g.title}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 border-b">
                  <div className="text-sm font-semibold">{g.title}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    รวม {g.rows.length} • issued {g.stats.issued} • redeemed{" "}
                    {g.stats.redeemed}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-white text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Ref</th>
                        <th className="text-left px-3 py-2">ผู้ถือคูปอง</th>
                        <th className="text-left px-3 py-2">คอร์ส</th>
                        <th className="text-left px-3 py-2">ห้อง</th>
                        <th className="text-left px-3 py-2">dayYMD</th>
                        <th className="text-left px-3 py-2">สถานะ</th>
                        <th className="text-left px-3 py-2">ร้านที่ใช้</th>
                        <th className="text-right px-3 py-2">ยอดจริง</th>
                        <th className="text-right px-3 py-2">
                          ลูกค้าจ่ายเพิ่ม
                        </th>
                        <th className="text-left px-3 py-2">เวลาใช้</th>
                        <th className="text-left px-3 py-2">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {g.rows.map((it) => {
                        const payMore = payMoreOf(
                          Number(it.spentAmount || 0),
                          Number(it.couponPrice ?? 180),
                        );
                        return (
                          <tr key={it.id} className="border-t">
                            <td className="px-3 py-2 font-semibold">
                              {it.displayCode || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {it.holderName || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {it.courseName || "-"}
                            </td>
                            <td className="px-3 py-2">{it.roomName || "-"}</td>
                            <td className="px-3 py-2">{it.dayYMD || "-"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={cx(
                                  "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                                  it.status === "redeemed"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : it.status === "issued"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-slate-100 text-slate-700",
                                )}
                              >
                                {it.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {it.merchantName || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {fmtMoney(it.spentAmount)}
                            </td>
                            <td
                              className={cx(
                                "px-3 py-2 text-right",
                                payMore > 0 ? "text-red-600" : "text-slate-500",
                              )}
                            >
                              {payMore > 0 ? "+" : ""}
                              {fmtMoney(payMore)}
                            </td>
                            <td className="px-3 py-2">
                              {fmtDateTimeTH(it.redeemedAt)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                                  onClick={() => openQrModal(it)}
                                  disabled={!it.publicId}
                                >
                                  View QR
                                </button>
                                <button
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                                  disabled={!it.publicId}
                                  onClick={() =>
                                    copyToClipboard(makeCouponUrl(it.publicId))
                                  }
                                >
                                  Copy link
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* pagination เฉพาะ coupons view */}
            <div className="mt-4 flex items-center justify-between px-3 py-3 border border-slate-200 rounded-2xl bg-white">
              <div className="text-sm text-slate-500">
                หน้า {page} / {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  ก่อนหน้า
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* QR Modal */}
      <Modal
        open={qrOpen}
        title="แสดง QR / ลิงก์คูปอง"
        onClose={() => setQrOpen(false)}
      >
        {!qrRow ? (
          <div className="text-sm text-slate-500">ไม่มีข้อมูล</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ref</span>
                <span className="font-semibold">
                  {qrRow.displayCode || "-"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">ผู้ถือคูปอง</span>
                <span className="font-medium">{qrRow.holderName || "-"}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">คอร์ส</span>
                <span className="font-medium text-right">
                  {qrRow.courseName || "-"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">สถานะ</span>
                <span className="font-semibold">{qrRow.status || "-"}</span>
              </div>
              {qrRow.billCode ? (
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Bill</span>
                  <span className="font-semibold">{qrRow.billCode}</span>
                </div>
              ) : null}
            </div>

            {!couponUrl ? (
              <div className="text-sm text-red-600">
                ไม่มี publicId สำหรับสร้างลิงก์
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4">
                <QRCode value={couponUrl} size={190} />
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500 mb-1">ลิงก์คูปอง</div>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={couponUrl}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  disabled={!couponUrl}
                  onClick={() => copyToClipboard(couponUrl)}
                >
                  Copy
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  disabled={!couponUrl}
                  onClick={() => window.open(couponUrl, "_blank")}
                >
                  Open
                </button>
              </div>
              {copyMsg ? (
                <div className="mt-2 text-xs text-emerald-600">{copyMsg}</div>
              ) : null}
              <div className="mt-2 text-xs text-slate-500">
                * กรณีลูกค้าทำลิงก์หาย ให้แอดมินเปิด QR นี้ให้ลูกค้าสแกนใหม่
                หรือ copy link ส่งให้
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setQrOpen(false)}
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
