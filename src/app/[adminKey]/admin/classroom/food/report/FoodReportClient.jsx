// src/app/admin/classroom/food/report/FoodReportClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";

const TD = "border border-admin-border px-1.5 py-1 align-top"; // ลด padding
const TH = "border border-admin-border px-1.5 py-1 align-top";
const TRUNC = "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function toYMD(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ✅ make a BKK date (start of day, +07:00) from "YYYY-MM-DD" or ISO/date
function toBkkDate(d) {
  if (!d) return null;

  const ymd =
    typeof d === "string"
      ? String(d).slice(0, 10)
      : typeof d === "object"
        ? toYMD(d)
        : "";

  if (!ymd) return null;

  const dt = new Date(`${ymd}T00:00:00.000+07:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ✅ 18 Feb 2026
function formatDateEN(d) {
  const dt = toBkkDate(d);
  if (!dt) return "-";
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

// ✅ dd/mm/yyyy
function formatDateDMY(d) {
  const dt = toBkkDate(d);
  if (!dt) return "-";
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

// เทียบวันแบบ BKK (ทำง่าย ๆ ด้วย +07:00)
function startOfDayBKK(ymd) {
  if (!ymd) return null;
  const dt = new Date(`${ymd}T00:00:00.000+07:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function diffDaysBKK(aDate, bDate) {
  const a = new Date(aDate);
  const b = new Date(bDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;

  const aYMD = toYMD(a);
  const bYMD = toYMD(b);
  const sa = startOfDayBKK(aYMD);
  const sb = startOfDayBKK(bYMD);
  if (!sa || !sb) return 0;
  const ms = sb.getTime() - sa.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/* ---------- ✅ CLEAN CLASS TITLE ---------- */
function normalizeWs(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ตัด prefix รหัสคอร์ส เช่น "GOO-ADK - ..." หรือ "GOO-ADK – ..."
function cleanClassTitle(title, courseCode) {
  let t = normalizeWs(String(title || "").replace(/\n+/g, " "));
  const code = normalizeWs(courseCode || "");
  if (!t) return "-";

  // กันเคสซ้ำๆ เช่น "GOO-ADK - GOO-ADK - Title"
  if (code) {
    const re = new RegExp(`^(?:${escapeRegExp(code)}\\s*[-–—:]\\s*)+`, "i");
    t = t.replace(re, "").trim();
  }

  return t || "-";
}

/** Modal เบา ๆ */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="close overlay"
      />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-admin-text">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
            aria-label="close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Summary builder (สำหรับหน้าแรกของ Print) ---------- */
/** ✅ สรุป “ชื่ออาหาร” (รวม COUPON + ไม่รับอาหาร ด้วย) */
function buildSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    const choice = String(
      o.choiceType || o.food?.choiceType || "",
    ).toLowerCase();

    // ยึด choiceType ก่อน
    let isCoupon =
      choice === "coupon" || o.isCoupon === true || o.food?.coupon === true;
    let isNoFood =
      choice === "nofood" || o.isNoFood === true || o.food?.noFood === true;

    // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มีจริง ๆ
    if (!choice) {
      const noteLower = String(o.note || o.food?.note || "").toLowerCase();
      if (noteLower.includes("coupon")) isCoupon = true;
      if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
    }

    if (isCoupon) add("Cash Coupon", 1);
    else if (isNoFood) add("ไม่รับอาหาร", 1);
    else add(String(o.menuName || "-").trim() || "-", 1);
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildAddonSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    const choice = String(
      o.choiceType || o.food?.choiceType || "",
    ).toLowerCase();

    let isCoupon =
      choice === "coupon" || o.isCoupon === true || o.food?.coupon === true;

    let isNoFood =
      choice === "nofood" || o.isNoFood === true || o.food?.noFood === true;

    // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มี
    if (!choice) {
      const noteLower = String(o.note || o.food?.note || "").toLowerCase();
      if (noteLower.includes("coupon")) isCoupon = true;
      if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
    }

    if (isCoupon || isNoFood) return;

    // addons อาจอยู่ทั้ง o.addons และ o.food.addons
    const rawAddons = o.addons ?? o.food?.addons;

    const addons = Array.isArray(rawAddons)
      ? rawAddons
      : typeof rawAddons === "string"
        ? rawAddons
            .split("/")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];

    addons.forEach((a) => add(a, 1));
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildDrinkSummaryItems(rows) {
  const items = new Map();

  const add = (label, n = 1) => {
    const key = String(label || "").trim();
    if (!key) return;
    items.set(key, (items.get(key) || 0) + n);
  };

  rows.forEach((o) => {
    const choice = String(
      o.choiceType || o.food?.choiceType || "",
    ).toLowerCase();

    let isCoupon =
      choice === "coupon" || o.isCoupon === true || o.food?.coupon === true;

    let isNoFood =
      choice === "nofood" || o.isNoFood === true || o.food?.noFood === true;

    // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มี
    if (!choice) {
      const noteLower = String(o.note || o.food?.note || "").toLowerCase();
      if (noteLower.includes("coupon")) isCoupon = true;
      if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
    }

    if (isCoupon || isNoFood) return;

    const drink = String(o.drink ?? o.food?.drink ?? "").trim();
    if (drink && drink !== "-") add(drink, 1);
  });

  return Array.from(items.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function FoodReportClient({ initialDate, initialOrders }) {
  const [date, setDate] = useState(initialDate);
  const [orders, setOrders] = useState(initialOrders || []);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");

  // all | food | coupon | noFood
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [openEdit, setOpenEdit] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const [foodOptions, setFoodOptions] = useState([]);
  const [optLoading, setOptLoading] = useState(false);
  const [addonOptions, setAddonOptions] = useState([]); // [{id,name}]
  const [drinkOptions, setDrinkOptions] = useState([]); // [{id,name}]

  const [editChoiceType, setEditChoiceType] = useState("noFood"); // food | noFood | coupon
  const [editRestaurantId, setEditRestaurantId] = useState("");
  const [editMenuId, setEditMenuId] = useState("");
  const [editAddons, setEditAddons] = useState([]);
  const [editDrink, setEditDrink] = useState("");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);

      const res = await fetch(`/api/admin/food-orders?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      setOrders(data.items || []);
      setSummary(data.summary || null);

      setSelectedIds((prev) => {
        const next = new Set();
        const allowed = new Set(
          (data.items || []).map((x) => String(x.id || x._id)),
        );
        prev.forEach((id) => {
          if (allowed.has(String(id))) next.add(String(id));
        });
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("โหลดข้อมูล Food Report ไม่สำเร็จ");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ✅ class options (ใช้ชื่อที่ clean แล้ว)
  const classOptions = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        const raw = o.className || o.classTitle || "-";
        map.set(key, {
          id: key,
          className: cleanClassTitle(raw, o.courseCode),
          rawClassName: raw,
          courseCode: o.courseCode || "",
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return orders.filter((o) => {
      const key = o.classId || o.className || "unknown";
      if (classFilter && key !== classFilter) return false;

      const choice = String(
        o.choiceType || o.food?.choiceType || "",
      ).toLowerCase();

      let isCoupon =
        choice === "coupon" || o.isCoupon === true || o.food?.coupon === true;

      let isNoFood =
        choice === "nofood" || o.isNoFood === true || o.food?.noFood === true;

      // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มี
      if (!choice) {
        const noteLower = String(o.note || o.food?.note || "").toLowerCase();
        if (noteLower.includes("coupon")) isCoupon = true;
        if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
      }

      if (statusFilter === "coupon" && !isCoupon) return false;
      if (statusFilter === "noFood" && !isNoFood) return false;
      if (statusFilter === "food" && (isCoupon || isNoFood)) return false;

      if (!q) return true;

      const addonsArr = Array.isArray(o.addons)
        ? o.addons
        : Array.isArray(o.food?.addons)
          ? o.food.addons
          : [];

      const haystack = [
        o.studentName,
        o.studentThaiName,
        o.studentEngName,
        o.company,
        o.className,
        o.courseCode,
        o.roomName,
        isNoFood ? "ไม่รับอาหาร" : "",
        isCoupon ? "COUPON" : "",
        o.restaurantName ?? o.food?.restaurantName,
        o.menuName ?? o.food?.menuName,
        addonsArr.length ? addonsArr.join(" ") : "",
        o.drink ?? o.food?.drink,
        o.note ?? o.food?.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [orders, search, classFilter, statusFilter]);

  // ✅ groups (ใช้ชื่อคลาสที่ clean แล้ว)
  const groups = useMemo(() => {
    const map = new Map();
    filteredOrders.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        const raw = o.className || o.classTitle || "-";
        map.set(key, {
          key,
          className: cleanClassTitle(raw, o.courseCode),
          courseCode: o.courseCode || "",
          roomName: o.roomName || "",
          items: [],
        });
      }
      map.get(key).items.push(o);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className, "th"),
    );
  }, [filteredOrders]);

  /* ---------------- selection helpers ---------------- */
  const selectedCount = selectedIds.size;

  const selectedRows = useMemo(() => {
    const set = selectedIds;
    return filteredOrders.filter((o) => set.has(String(o.id || o._id)));
  }, [filteredOrders, selectedIds]);

  function toggleSelectRow(rowId) {
    const id = String(rowId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredOrders.forEach((o) => next.add(String(o.id || o._id)));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelectGroup(group) {
    const ids = group.items.map((o) => String(o.id || o._id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  /* ---------------- export/print helpers ---------------- */
  function buildCsv(rows) {
    const headers = [
      "วันที่",
      "รหัสคอร์ส",
      "ชื่อ Class",
      "ห้อง",
      "ชื่อผู้เรียน",
      "บริษัท",
      "สถานะ",
      "ร้านอาหาร",
      "เมนู",
      "Add-on",
      "เครื่องดื่ม",
      "หมายเหตุ",
    ];

    const outRows = rows.map((o) => {
      const choice = String(
        o.choiceType || o.food?.choiceType || "",
      ).toLowerCase();

      let isCoupon =
        choice === "coupon" || o.isCoupon === true || o.food?.coupon === true;

      let isNoFood =
        choice === "nofood" || o.isNoFood === true || o.food?.noFood === true;

      // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มี
      if (!choice) {
        const noteLower = String(o.note || o.food?.note || "").toLowerCase();
        if (noteLower.includes("coupon")) isCoupon = true;
        if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
      }

      const status = isCoupon ? "COUPON" : isNoFood ? "ไม่รับอาหาร" : "อาหาร";

      const rest = isCoupon
        ? "-"
        : isNoFood
          ? "-"
          : (o.restaurantName ?? o.food?.restaurantName ?? "");

      const menu = isCoupon
        ? "-"
        : isNoFood
          ? "-"
          : (o.menuName ?? o.food?.menuName ?? "");

      const addonsArr = Array.isArray(o.addons)
        ? o.addons
        : Array.isArray(o.food?.addons)
          ? o.food.addons
          : [];

      const drink = o.drink ?? o.food?.drink ?? "";
      const note = o.note ?? o.food?.note ?? "";

      const classTitle = cleanClassTitle(
        o.className || o.classTitle || "",
        o.courseCode,
      );

      return [
        formatDateDMY(o.date || date), // ✅ dd/mm/yyyy
        o.courseCode || "",
        classTitle,
        o.roomName || "",
        o.studentName || o.studentThaiName || o.studentEngName || "",
        o.company || "",
        status,
        rest,
        menu,
        addonsArr.length ? addonsArr.join(" / ") : "",
        drink,
        note,
      ];
    });

    const all = [headers, ...outRows];
    return all
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");
  }

  function downloadCsv(csv, filename) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportAll() {
    if (!filteredOrders.length) return alert("ยังไม่มีข้อมูลสำหรับ Export");
    const labelDate = date || new Date().toISOString().slice(0, 10);
    downloadCsv(buildCsv(filteredOrders), `food-report_${labelDate}.csv`);
  }

  function handleExportSelected() {
    if (!selectedRows.length) return alert("ยังไม่ได้เลือกรายชื่อ");
    const labelDate = date || new Date().toISOString().slice(0, 10);
    downloadCsv(
      buildCsv(selectedRows),
      `food-report_selected_${labelDate}.csv`,
    );
  }

  function handlePrintRows(rows) {
    const w = window.open("", "_blank");
    if (!w) return;

    // group by class for print
    const map = new Map();
    rows.forEach((o) => {
      const key = o.classId || o.className || "unknown";
      if (!map.has(key)) {
        const raw = o.className || o.classTitle || "-";
        map.set(key, {
          key,
          className: cleanClassTitle(raw, o.courseCode),
          courseCode: o.courseCode || "",
          roomName: o.roomName || "",
          items: [],
        });
      }
      map.get(key).items.push(o);
    });

    const printGroups = Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className, "th"),
    );

    const printDate = formatDateEN(date); // ✅ 18 Feb 2026
    const generatedAt = new Date().toLocaleString("th-TH", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // ---------- PAGE 1: SUMMARY ----------
    const summaryItems = buildSummaryItems(rows);
    const addonSummaryItems = buildAddonSummaryItems(rows);
    const drinkSummaryItems = buildDrinkSummaryItems(rows);

    const addonRowsHtml = addonSummaryItems
      .map(
        (x, idx) => `
    <tr>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
      <td style="border:1px solid #999;padding:6px;">${x.label}</td>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
    </tr>
  `,
      )
      .join("");

    const drinkRowsHtml = drinkSummaryItems
      .map(
        (x, idx) => `
    <tr>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
      <td style="border:1px solid #999;padding:6px;">${x.label}</td>
      <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
    </tr>
  `,
      )
      .join("");

    const classNames = Array.from(
      new Set(
        rows
          .map((r) =>
            cleanClassTitle(r.className || r.classTitle || "", r.courseCode),
          )
          .map((x) => String(x || "").trim())
          .filter(Boolean),
      ),
    );

    const classListHtml =
      classNames.length === 0
        ? `<span style="font-weight:700;">ทุกคลาส</span>`
        : classNames
            .map(
              (n) =>
                `<div style="margin-top:2px;font-weight:700;">• ${esc(n)}</div>`,
            )
            .join("");

    const summaryRowsHtml = summaryItems
      .map(
        (x, idx) => `
        <tr>
          <td style="border:1px solid #999;padding:6px;text-align:center;width:60px;">${idx + 1}</td>
          <td style="border:1px solid #999;padding:6px;">${x.label}</td>
          <td style="border:1px solid #999;padding:6px;text-align:center;width:120px;">${x.count}</td>
        </tr>
      `,
      )
      .join("");

    const summaryPageHtml = `
      <div class="page">
        <div style="text-align:center;margin-top:6px;">
          <div style="font-size:22px;font-weight:800;letter-spacing:.2px;">ใบสั่งอาหาร (Summary)</div>
          <div style="margin-top:6px;font-size:14px;">
            หลักสูตร/คลาส :
            <div style="margin-top:4px;line-height:1.25;">
              ${classListHtml}
            </div>
          </div>
          <div style="margin-top:6px;font-size:14px;">
            วันที่ : <span style="font-weight:700;">${printDate}</span>
          </div>
        </div>

        <div style="margin-top:18px;border:1px solid #999;border-radius:10px;overflow:hidden;">
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="border:1px solid #999;padding:8px;">No.</th>
                <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่ออาหาร</th>
                <th style="border:1px solid #999;padding:8px;">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              ${
                summaryRowsHtml ||
                `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="border:1px solid #999;border-radius:8px;overflow:hidden;">
            <div style="background:#f3f4f6;padding:8px;font-weight:800;text-align:center;">Add-on</div>
            <table style="border-collapse:collapse;width:100%;font-size:13px;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="border:1px solid #999;padding:8px;">No.</th>
                  <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่อ Add-on</th>
                  <th style="border:1px solid #999;padding:8px;">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  addonRowsHtml ||
                  `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>
          </div>

          <div style="border:1px solid #999;border-radius:8px;overflow:hidden;">
            <div style="background:#f3f4f6;padding:8px;font-weight:800;text-align:center;">เครื่องดื่ม</div>
            <table style="border-collapse:collapse;width:100%;font-size:13px;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="border:1px solid #999;padding:8px;">No.</th>
                  <th style="border:1px solid #999;padding:8px;text-align:left;">ชื่อเครื่องดื่ม</th>
                  <th style="border:1px solid #999;padding:8px;">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                ${
                  drinkRowsHtml ||
                  `<tr><td colspan="3" style="border:1px solid #999;padding:10px;text-align:center;color:#666;">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:10px;font-size:11px;color:#6b7280;text-align:right;">
          สร้างเมื่อ ${generatedAt}
        </div>
      </div>

      <div class="page-break"></div>
    `;

    // ---------- CLASS PAGES ----------
    const classPagesHtml = printGroups
      .map((g, gi) => {
        const rowsHtml = g.items
          .map((o, idx) => {
            const choice = String(
              o.choiceType || o.food?.choiceType || "",
            ).toLowerCase();

            let isCoupon =
              choice === "coupon" ||
              o.isCoupon === true ||
              o.food?.coupon === true;

            let isNoFood =
              choice === "nofood" ||
              o.isNoFood === true ||
              o.food?.noFood === true;

            // fallback legacy: ใช้ note เฉพาะตอน choiceType ไม่มี
            if (!choice) {
              const noteLower = String(
                o.note || o.food?.note || "",
              ).toLowerCase();
              if (noteLower.includes("coupon")) isCoupon = true;
              if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
            }

            const rest = isCoupon
              ? "-"
              : isNoFood
                ? "-"
                : (o.restaurantName ?? o.food?.restaurantName ?? "");

            const menu = isCoupon
              ? "Cash Coupon"
              : isNoFood
                ? "ไม่รับอาหาร"
                : (o.menuName ?? o.food?.menuName ?? "");

            const addonsArr = Array.isArray(o.addons)
              ? o.addons
              : Array.isArray(o.food?.addons)
                ? o.food.addons
                : [];

            const addons = addonsArr.length ? addonsArr.join(" / ") : "";

            const drink = o.drink ?? o.food?.drink ?? "";

            const note =
              (o.note ?? o.food?.note ?? "") ||
              (isCoupon ? "COUPON" : isNoFood ? "ไม่รับอาหาร" : "");

            // ✅ ตัดคอลัมน์ "บริษัท" ออกจาก Print
            return `
              <tr>
                <td class="td num">${idx + 1}</td>
                <td class="td">${o.studentName || "-"}</td>
                
                <td class="td">${menu}</td>
                <td class="td">${addons}</td>
                <td class="td">${drink}</td>
                <td class="td">${note}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="page class-page">
            <table class="class-table">
              <colgroup>
                <col class="c-num" />
                <col class="c-student" />
                <col class="c-menu" />
                <col class="c-addon" />
                <col class="c-drink" />
                <col class="c-note" />
                </colgroup>
              <thead>
                <tr>
                  <th colspan="7" class="class-head">
                    <div class="class-title">${g.className}</div>
                    <div class="class-sub">
                      ${g.roomName ? `ห้อง ${g.roomName} • ` : ""}ผู้เรียน ${g.items.length} คน • ${printDate}
                    </div>
                  </th>
                </tr>
                <tr>
                  <th class="th num">#</th>
                  <th class="th">ชื่อผู้เรียน</th>
                  <th class="th">เมนู</th>
                  <th class="th">Add-on</th>
                  <th class="th">เครื่องดื่ม</th>
                  <th class="th">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rowsHtml ||
                  `<tr><td colspan="7" class="td empty">ไม่มีข้อมูล</td></tr>`
                }
              </tbody>
            </table>

            <div class="footer">สร้างเมื่อ ${generatedAt}</div>
          </div>

          ${gi === printGroups.length - 1 ? "" : `<div class="page-break"></div>`}
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="utf-8" />
          <title>Food Report</title>
          <style>
            @page { size: A4 portrait;  margin: 10mm 9mm 10mm 17mm;  }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 12px;
              color: #111827;
              margin: 0;
            }
            .page { padding: 0; margin: 0; }
            .page-break { page-break-after: always; break-after: page; height: 0; }

            .class-table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
            .class-table thead { display: table-header-group; }
            .class-table tfoot { display: table-footer-group; }
            tr { page-break-inside: avoid; break-inside: avoid; }

            .class-head { border: 1px solid #111827; padding: 10px; text-align: left; }
            .class-title { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
            .class-sub { font-size: 11px; color: #6b7280; }

            .th, .td { border: 1px solid #111827; padding: 5px 6px; font-size: 12px; vertical-align: top; overflow: hidden; word-break: break-word;}
            .th { background: #f3f4f6; font-weight: 700; }
            .num { width: 54px; text-align: right; }
            .empty { text-align: center; color: #6b7280; padding: 10px; }

            .footer { margin-top: 8px; font-size: 11px; color: #6b7280; text-align: right; }

            .c-num     { width: 4%; }
            .c-student { width: 30%; }
            .c-menu   { width: 24%; }
            .c-addon   { width: 12%; }
            .c-drink   { width: 10%; }
            .c-note    { width: 20%; }

            .trunc{white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}


            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; break-after: page; }
            }
          </style>
        </head>
        <body>
          ${summaryPageHtml}
          ${classPagesHtml}
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();

    const doPrint = () => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        console.error(e);
      }
    };

    w.onload = () => setTimeout(doPrint, 80);
    setTimeout(doPrint, 500);
  }

  function handlePrintAll() {
    if (!filteredOrders.length) return;
    handlePrintRows(filteredOrders);
  }

  function handlePrintSelected() {
    if (!selectedRows.length) return alert("ยังไม่ได้เลือกรายชื่อ");
    handlePrintRows(selectedRows);
  }

  /* ---------------- edit actions ---------------- */
  const currentRestaurant = useMemo(() => {
    if (!editRestaurantId) return null;
    return (
      (foodOptions || []).find(
        (r) => String(r.id) === String(editRestaurantId),
      ) || null
    );
  }, [foodOptions, editRestaurantId]);

  const currentMenu = useMemo(() => {
    if (!currentRestaurant || !editMenuId) return null;
    return (
      (currentRestaurant.menus || []).find(
        (m) => String(m.id) === String(editMenuId),
      ) || null
    );
  }, [currentRestaurant, editMenuId]);

  const addonMap = useMemo(() => {
    const m = new Map();
    (addonOptions || []).forEach((x) => m.set(String(x.id), x));
    return m;
  }, [addonOptions]);

  const drinkMap = useMemo(() => {
    const m = new Map();
    (drinkOptions || []).forEach((x) => m.set(String(x.id), x));
    return m;
  }, [drinkOptions]);

  const currentAddonChoices = useMemo(() => {
    const ids = Array.isArray(currentMenu?.addonIds)
      ? currentMenu.addonIds
      : [];
    const fromIds = ids
      .map((id) => addonMap.get(String(id)))
      .filter(Boolean)
      .map((x) => x.name);

    if (fromIds.length) return fromIds;
    if (Array.isArray(currentMenu?.addons)) return currentMenu.addons;
    return [];
  }, [currentMenu, addonMap]);

  const currentDrinkChoices = useMemo(() => {
    const ids = Array.isArray(currentMenu?.drinkIds)
      ? currentMenu.drinkIds
      : [];
    const fromIds = ids
      .map((id) => drinkMap.get(String(id)))
      .filter(Boolean)
      .map((x) => x.name);

    if (fromIds.length) return fromIds;
    if (Array.isArray(currentMenu?.drinks)) return currentMenu.drinks;
    return [];
  }, [currentMenu, drinkMap]);

  function openEditRow(row) {
    setEditingRow(row);
    const f = row.food || {};

    const choice = String(row.choiceType || f.choiceType || "").toLowerCase();

    // 1) ใช้ choiceType/flag ก่อน (กันเพี้ยนจาก note)
    let isCoupon =
      choice === "coupon" || row.isCoupon === true || f.coupon === true;

    let isNo =
      choice === "nofood" || row.isNoFood === true || f.noFood === true;

    // 2) fallback ไปดู note เฉพาะตอน "ไม่มี choiceType"
    if (!choice) {
      const noteLower = String(row.note || f.note || "").toLowerCase();
      if (noteLower.includes("coupon")) isCoupon = true;
      if (noteLower.includes("ไม่รับอาหาร")) isNo = true;
    }

    // set choiceType UI
    setEditChoiceType(isCoupon ? "coupon" : isNo ? "noFood" : "food");

    // ดึงค่าจาก food ก่อน แล้วค่อย fallback ไป row
    const restaurantId = String(f.restaurantId ?? row.restaurantId ?? "");
    const menuId = String(f.menuId ?? row.menuId ?? "");

    setEditRestaurantId(isCoupon || isNo ? "" : restaurantId);
    setEditMenuId(isCoupon || isNo ? "" : menuId);

    // addons/drink/note (food ก่อน)
    const addons = Array.isArray(f.addons)
      ? f.addons
      : Array.isArray(row.addons)
        ? row.addons
        : [];

    setEditAddons(addons);
    setEditDrink(String(f.drink ?? row.drink ?? ""));
    setEditNote(String(f.note ?? row.note ?? ""));

    setFoodOptions([]);
    setOpenEdit(true);

    if (!isCoupon && !isNo) {
      loadFoodOptionsForRow(row).catch((e) => console.error(e));
    }
  }

  useEffect(() => {
    if (!openEdit) return;
    if (editChoiceType !== "food") return;
    if (!editingRow) return;

    if ((foodOptions || []).length === 0 && !optLoading) {
      loadFoodOptionsForRow(editingRow).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEdit, editChoiceType]);

  async function loadFoodOptionsForRow(row) {
    setOptLoading(true);
    try {
      const reportYMD = date;
      const classDate = row.classDate || null;

      let day = 1;
      if (classDate && reportYMD) {
        const d = diffDaysBKK(classDate, `${reportYMD}T00:00:00.000+07:00`) + 1;
        if (Number.isFinite(d) && d > 0) day = d;
      }

      const qs = new URLSearchParams();
      if (row.studentId) qs.set("studentId", row.studentId);
      if (row.classId) qs.set("classId", row.classId);
      qs.set("day", String(day));

      const res = await fetch(`/api/admin/food/today?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      const items = Array.isArray(data.items) ? data.items : [];
      setFoodOptions(items);

      // ✅ addons: รองรับหลาย key + ฝังใน items
      const directAddons =
        (Array.isArray(data.addons) && data.addons) ||
        (Array.isArray(data.addonOptions) && data.addonOptions) ||
        (Array.isArray(data.options?.addons) && data.options.addons) ||
        [];

      const nestedAddons = items.flatMap((r) =>
        Array.isArray(r.addons)
          ? r.addons
          : Array.isArray(r.addonOptions)
            ? r.addonOptions
            : [],
      );

      const mergedAddons = [...directAddons, ...nestedAddons];
      const uniqAddons = [];
      const seenAddon = new Set();
      mergedAddons.forEach((x) => {
        const id = String(x?.id || x?._id || "");
        if (!id || seenAddon.has(id)) return;
        seenAddon.add(id);
        uniqAddons.push({ id, name: x?.name || x?.title || "-" });
      });
      setAddonOptions(uniqAddons);

      // ✅ drinks: รองรับหลาย key + ฝังใน items
      const directDrinks =
        (Array.isArray(data.drinks) && data.drinks) ||
        (Array.isArray(data.drinkOptions) && data.drinkOptions) ||
        (Array.isArray(data.options?.drinks) && data.options.drinks) ||
        [];

      const nestedDrinks = items.flatMap((r) =>
        Array.isArray(r.drinks)
          ? r.drinks
          : Array.isArray(r.drinkOptions)
            ? r.drinkOptions
            : [],
      );

      const mergedDrinks = [...directDrinks, ...nestedDrinks];
      const uniqDrinks = [];
      const seenDrink = new Set();
      mergedDrinks.forEach((x) => {
        const id = String(x?.id || x?._id || "");
        if (!id || seenDrink.has(id)) return;
        seenDrink.add(id);
        uniqDrinks.push({ id, name: x?.name || x?.title || "-" });
      });
      setDrinkOptions(uniqDrinks);
    } catch (err) {
      console.error(err);
      setFoodOptions([]);
      setAddonOptions([]);
      setDrinkOptions([]);
    } finally {
      setOptLoading(false);
    }
  }

  function toggleAddon(name) {
    setEditAddons((prev) => {
      const set = new Set(prev);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return Array.from(set);
    });
  }

  async function saveEdit() {
    if (!editingRow?.studentId) return;

    setSavingEdit(true);
    try {
      const reportYMD = date;
      const classDate = editingRow.classDate || null;

      let day = 1;
      if (classDate && reportYMD) {
        const d = diffDaysBKK(classDate, `${reportYMD}T00:00:00.000+07:00`) + 1;
        if (Number.isFinite(d) && d > 0) day = d;
      }

      const cleanedNote = ["ไม่รับอาหาร", "COUPON"].includes(
        String(editNote || "").trim(),
      )
        ? ""
        : String(editNote || "");

      const payloadBase = {
        studentId: editingRow.studentId,
        classId: editingRow.classId || "",
        day,
      };

      // ✅ map ชื่อ -> id เพื่อให้ API validate ผ่าน
      const addonIds = (Array.isArray(editAddons) ? editAddons : [])
        .map((name) => {
          const hit = (addonOptions || []).find(
            (x) => String(x?.name) === String(name),
          );
          return hit ? String(hit.id) : "";
        })
        .filter(Boolean);

      const drinkId = (() => {
        const hit = (drinkOptions || []).find(
          (x) => String(x?.name) === String(editDrink),
        );
        return hit ? String(hit.id) : "";
      })();

      let payload;

      if (editChoiceType === "coupon") {
        payload = {
          ...payloadBase,
          choiceType: "coupon",
          coupon: true,
          noFood: true, // backward compat (API ก็เซ็ต noFood true อยู่แล้ว)
          restaurantId: "",
          menuId: "",
          addonIds: [],
          drinkId: "",
          addons: [],
          drink: "",
          note: cleanedNote,
        };
      } else if (editChoiceType === "noFood") {
        payload = {
          ...payloadBase,
          choiceType: "noFood",
          coupon: false,
          noFood: true,
          restaurantId: "",
          menuId: "",
          addonIds: [],
          drinkId: "",
          addons: [],
          drink: "",
          note: cleanedNote,
        };
      } else {
        // food
        payload = {
          ...payloadBase,
          choiceType: "food",
          coupon: false,
          noFood: false,
          restaurantId: editRestaurantId || "",
          menuId: editMenuId || "",
          addonIds, // ✅ สำคัญ
          drinkId, // ✅ สำคัญ (เมนูมี drinkIds แล้วบังคับ)
          // legacy strings (เก็บไว้ให้ report/export เดิม)
          addons: Array.isArray(editAddons) ? editAddons : [],
          drink: editDrink || "",
          note: cleanedNote,
        };
      }

      const res = await fetch("/api/checkin/food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(out);
        alert(out.error || "บันทึกไม่สำเร็จ");
        setSavingEdit(false);
        return;
      }

      setOpenEdit(false);
      setEditingRow(null);
      await load();
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
    setSavingEdit(false);
  }

  /* ---------------- derived counts (ตาม filter) ---------------- */
  const filteredCounts = useMemo(() => {
    let noFoodCount = 0;
    let couponCount = 0;
    let foodCount = 0;

    filteredOrders.forEach((o) => {
      const choice = String(o.choiceType || "").toLowerCase();

      let isCoupon = choice === "coupon" || o.isCoupon === true;
      let isNoFood = choice === "nofood" || o.isNoFood === true;

      // fallback ไปดู note เฉพาะตอน choiceType ว่าง
      if (!choice) {
        const noteLower = String(o.note || "").toLowerCase();
        if (noteLower.includes("coupon")) isCoupon = true;
        if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
      }

      if (isCoupon) couponCount += 1;
      else if (isNoFood) noFoodCount += 1;
      else foodCount += 1;
    });

    return {
      noFoodCount,
      couponCount,
      foodCount,
      total: filteredOrders.length,
    };
  }, [filteredOrders]);

  /* ---------------- render ---------------- */
  return (
    <div className="w-full min-w-0 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Summary */}
      <div className="mb-4 shrink-0 rounded-2xl border border-admin-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-admin-text">
              สรุปเมนูรวม
            </div>
            <div className="text-[11px] text-admin-textMuted">
              วันที่ {formatDateEN(date)} • รวม{" "}
              <span className="font-semibold text-admin-text">
                {filteredCounts.total}
              </span>{" "}
              รายการ (ตาม filter)
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-admin-border px-3 py-1 text-[11px]">
              เลือกแล้ว <span className="font-semibold">{selectedCount}</span>{" "}
              คน
            </div>

            <button
              type="button"
              onClick={selectAllFiltered}
              className="rounded-full border border-admin-border px-3 py-1 text-[11px] hover:bg-admin-surfaceMuted"
            >
              เลือกทั้งหมด (ตาม filter)
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-admin-border px-3 py-1 text-[11px] hover:bg-admin-surfaceMuted"
            >
              ล้างที่เลือก
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-admin-surfaceMuted p-3">
            <div className="text-[11px] text-admin-textMuted">อาหาร</div>
            <div className="text-lg font-semibold text-admin-text">
              {filteredCounts.foodCount}
            </div>
          </div>

          <div className="rounded-2xl bg-admin-surfaceMuted p-3">
            <div className="text-[11px] text-admin-textMuted">COUPON</div>
            <div className="text-lg font-semibold text-admin-text">
              {filteredCounts.couponCount}
            </div>
          </div>

          <div className="rounded-2xl bg-admin-surfaceMuted p-3">
            <div className="text-[11px] text-admin-textMuted">ไม่รับอาหาร</div>
            <div className="text-lg font-semibold text-admin-text">
              {filteredCounts.noFoodCount}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-admin-surfaceMuted p-3">
          <div className="text-[11px] text-admin-textMuted">
            Top เมนู (จาก API)
          </div>
          <div
            className="mt-2 space-y-1 overflow-y-auto pr-1"
            style={{ maxHeight: "86px" }}
          >
            {(summary?.menuCounts || []).slice(0, 8).map((x, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="truncate pr-3">{x.label}</span>
                <span className="font-semibold">{x.count}</span>
              </div>
            ))}
            {!summary?.menuCounts?.length && (
              <div className="text-[11px] text-admin-textMuted">
                ไม่มีข้อมูล
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-admin-surface p-4 shadow-card flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Filter bar */}
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between shrink-0">
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-[11px] text-admin-textMuted">
                วันที่
              </label>
              <input
                type="date"
                lang="en-GB"
                className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {date && (
                <div className="mt-1 text-[11px] text-admin-textMuted">
                  {formatDateDMY(date)}
                </div>
              )}
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
                    {c.className}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-admin-textMuted">
                สถานะ
              </label>
              <select
                className="mt-1 rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="food">เฉพาะอาหาร</option>
                <option value="coupon">เฉพาะ COUPON</option>
                <option value="noFood">เฉพาะ ไม่รับอาหาร</option>
              </select>
            </div>
          </div>

          <div className="flex flex-1 min-w-0 flex-col gap-2 md:items-end">
            <input
              className="w-full max-w-full rounded-lg border border-admin-border bg-white px-3 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary md:w-96"
              placeholder="ค้นหา (ชื่อผู้เรียน / ร้าน / เมนู / หมายเหตุ)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportAll}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Export ทั้งหมด (ตาม filter)
              </button>

              <button
                type="button"
                onClick={handleExportSelected}
                className={cx(
                  "rounded-full border px-4 py-1.5 text-xs font-medium",
                  selectedRows.length
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
                    : "border-admin-border text-admin-textMuted",
                )}
              >
                Export เฉพาะที่เลือก
              </button>

              <button
                type="button"
                onClick={handlePrintAll}
                className="rounded-full border border-admin-border px-4 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-surfaceMuted"
              >
                Print ทั้งหมด (ตาม filter)
              </button>

              <button
                type="button"
                onClick={handlePrintSelected}
                className={cx(
                  "rounded-full border px-4 py-1.5 text-xs font-medium",
                  selectedRows.length
                    ? "border-admin-border text-admin-text hover:bg-admin-surfaceMuted"
                    : "border-admin-border text-admin-textMuted",
                )}
              >
                Print เฉพาะที่เลือก
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mb-3 text-xs text-admin-textMuted shrink-0">
            กำลังโหลดข้อมูล...
          </div>
        )}

        {/* Grouped tables */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
          <div className="space-y-6">
            {groups.map((g) => {
              const groupIds = g.items.map((o) => String(o.id || o._id));
              const groupAllSelected = groupIds.every((id) =>
                selectedIds.has(id),
              );
              const groupSomeSelected = groupIds.some((id) =>
                selectedIds.has(id),
              );

              return (
                <div
                  key={g.key}
                  className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-admin-text">
                        {g.className}
                      </div>
                      <div className="text-[11px] text-admin-textMuted">
                        {g.roomName && <>ห้อง {g.roomName} • </>}
                        ผู้เรียน {g.items.length} คน
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleSelectGroup(g)}
                      className="rounded-full border border-admin-border px-3 py-1 text-[11px] hover:bg-admin-surfaceMuted"
                      title="เลือก/ยกเลิกเลือกทั้งกลุ่ม"
                    >
                      {groupAllSelected
                        ? "ยกเลิกเลือกทั้งกลุ่ม"
                        : groupSomeSelected
                          ? "เลือกที่เหลือในกลุ่ม"
                          : "เลือกทั้งกลุ่ม"}
                    </button>
                  </div>

                  <div className="min-w-0 overflow-x-hidden">
                    <table className="w-full table-fixed border-collapse text-xs">
                      <colgroup>
                        <col className="w-[44px]" /> {/* เลือก */}
                        <col className="w-[44px]" /> {/* # */}
                        <col className="w-[22%]" /> {/* ชื่อผู้เรียน */}
                        <col className="w-[14%]" /> {/* ร้านอาหาร */}
                        <col className="w-[16%]" /> {/* เมนู */}
                        <col className="w-[12%]" /> {/* Add-on */}
                        <col className="w-[10%]" /> {/* เครื่องดื่ม */}
                        <col className="w-[16%]" /> {/* หมายเหตุ */}
                        <col className="w-[84px]" /> {/* Action */}
                      </colgroup>

                      <thead className="bg-admin-surfaceMuted text-[11px] text-admin-textMuted">
                        <tr>
                          <th
                            className={cx(TH, "text-center whitespace-nowrap")}
                          >
                            เลือก
                          </th>
                          <th
                            className={cx(TH, "text-center whitespace-nowrap")}
                          >
                            ลำดับ
                          </th>
                          <th className={cx(TH, "text-left", TRUNC)}>
                            ชื่อผู้เรียน
                          </th>
                          <th className={cx(TH, "text-left", TRUNC)}>
                            ร้านอาหาร
                          </th>
                          <th className={cx(TH, "text-left", TRUNC)}>เมนู</th>
                          <th className={cx(TH, "text-left", TRUNC)}>Add-on</th>
                          <th className={cx(TH, "text-left", TRUNC)}>
                            เครื่องดื่ม
                          </th>
                          <th className={cx(TH, "text-left", TRUNC)}>
                            หมายเหตุ
                          </th>
                          <th
                            className={cx(TH, "text-center whitespace-nowrap")}
                          >
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody className="[&>tr>td]:min-w-0">
                        {g.items.map((o, idx) => {
                          const rowId = String(o.id || o._id);
                          const checked = selectedIds.has(rowId);

                          // ===== status detection: choiceType first, note fallback only if choiceType empty =====
                          const choiceRaw =
                            o.choiceType ?? o.food?.choiceType ?? "";
                          const choice = String(choiceRaw || "").toLowerCase();

                          let isCoupon =
                            choice === "coupon" ||
                            o.isCoupon === true ||
                            o.food?.coupon === true;

                          let isNoFood =
                            choice === "nofood" ||
                            o.isNoFood === true ||
                            o.food?.noFood === true;

                          // fallback to note only when choiceType is empty
                          if (!choice) {
                            const noteLower = String(
                              o.note ?? o.food?.note ?? "",
                            ).toLowerCase();
                            if (noteLower.includes("coupon")) isCoupon = true;
                            if (noteLower.includes("ไม่รับอาหาร"))
                              isNoFood = true;
                          }

                          const rest = isCoupon
                            ? "-"
                            : isNoFood
                              ? "ไม่รับอาหาร"
                              : o.restaurantName || "-";

                          const menu = isCoupon
                            ? "Cash Coupon"
                            : isNoFood
                              ? "ไม่รับอาหาร"
                              : o.menuName || "-";

                          // note text: show actual note if exists, else default for coupon/noFood
                          const noteText =
                            String(o.note ?? o.food?.note ?? "").trim() ||
                            (isCoupon
                              ? "COUPON"
                              : isNoFood
                                ? "ไม่รับอาหาร"
                                : "-");

                          return (
                            <tr key={rowId}>
                              <td className={cx(TD, "text-center")}>
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5"
                                  checked={checked}
                                  onChange={() => toggleSelectRow(rowId)}
                                />
                              </td>

                              <td
                                className={cx(
                                  TD,
                                  "text-center whitespace-nowrap",
                                )}
                              >
                                {idx + 1}
                              </td>

                              <td className={cx(TD, "min-w-0")}>
                                <div
                                  className={cx(
                                    "w-full",
                                    TRUNC,
                                    "font-medium text-admin-text",
                                  )}
                                >
                                  {o.studentName || "-"}
                                </div>
                                {o.company && (
                                  <div
                                    className={cx(
                                      "w-full",
                                      TRUNC,
                                      "text-[11px] text-admin-textMuted",
                                    )}
                                  >
                                    {o.company}
                                  </div>
                                )}
                              </td>

                              <td className={cx(TD, TRUNC)}>{rest}</td>

                              <td className={cx(TD, TRUNC)}>
                                <span className={TRUNC}>{menu}</span>
                              </td>

                              <td className={cx(TD, TRUNC)}>
                                <span className={TRUNC}>
                                  {Array.isArray(o.addons) && o.addons.length
                                    ? o.addons.join(" / ")
                                    : "-"}
                                </span>
                              </td>

                              <td className={cx(TD, TRUNC)}>
                                {o.drink || "-"}
                              </td>

                              <td className={cx(TD, TRUNC)}>
                                <span className={TRUNC}>{noteText}</span>
                              </td>

                              <td
                                className={cx(
                                  TD,
                                  "text-center whitespace-nowrap",
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => openEditRow(o)}
                                  className="rounded-full border border-admin-border px-2 py-1 text-[11px] hover:bg-admin-surfaceMuted"
                                >
                                  แก้ไข
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Edit Modal ===== */}
      <Modal
        open={openEdit}
        title={`แก้ไขอาหาร: ${editingRow?.studentName || ""}`}
        onClose={() => {
          setOpenEdit(false);
          setEditingRow(null);
        }}
      >
        <div className="space-y-4">
          {/* Choice type */}
          <div className="rounded-xl border border-admin-border bg-admin-surfaceMuted p-3">
            <div className="text-[11px] font-semibold text-admin-text">
              สถานะ
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="choiceType"
                  checked={editChoiceType === "food"}
                  onChange={() => setEditChoiceType("food")}
                />
                <span>อาหาร</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="choiceType"
                  checked={editChoiceType === "coupon"}
                  onChange={() => setEditChoiceType("coupon")}
                />
                <span>COUPON</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="choiceType"
                  checked={editChoiceType === "noFood"}
                  onChange={() => setEditChoiceType("noFood")}
                />
                <span>ไม่รับอาหาร</span>
              </label>
            </div>
          </div>

          {/* Food selectors */}
          {editChoiceType === "food" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[11px] text-admin-textMuted">
                  ร้านอาหาร
                </div>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
                  value={editRestaurantId}
                  onChange={(e) => {
                    setEditRestaurantId(e.target.value);
                    setEditMenuId("");
                    setEditAddons([]);
                    setEditDrink("");
                  }}
                >
                  <option value="">
                    {optLoading ? "กำลังโหลด..." : "เลือกร้าน"}
                  </option>
                  {foodOptions.map((r) => (
                    <option key={String(r.id)} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {!foodOptions.length && !optLoading && (
                  <div className="mt-1 text-[11px] text-admin-textMuted">
                    * ถ้าร้านไม่ขึ้น ลองปิด-เปิด modal หรือกดแก้ไขอีกครั้ง
                  </div>
                )}
              </div>

              <div>
                <div className="text-[11px] text-admin-textMuted">เมนู</div>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-2 text-sm"
                  value={editMenuId}
                  onChange={(e) => {
                    setEditMenuId(e.target.value);
                    setEditAddons([]);
                    setEditDrink("");
                  }}
                  disabled={!currentRestaurant}
                >
                  <option value="">
                    {currentRestaurant ? "เลือกเมนู" : "เลือกร้านก่อน"}
                  </option>
                  {(currentRestaurant?.menus || []).map((m) => (
                    <option key={String(m.id)} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Add-ons */}
              <div className="md:col-span-2">
                <div className="text-[11px] text-admin-textMuted">Add-on</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {currentAddonChoices.map((a) => {
                    const checked = editAddons.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAddon(a)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-[12px]",
                          checked
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-admin-border bg-white text-admin-text",
                        )}
                      >
                        {a}
                      </button>
                    );
                  })}
                  {currentAddonChoices.length === 0 && (
                    <div className="text-[11px] text-admin-textMuted">
                      {editMenuId ? "ไม่มี Add-on" : "เลือกเมนูก่อน"}
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Drink dropdown */}
              <div className="md:col-span-2">
                <div className="text-[11px] text-admin-textMuted">
                  เครื่องดื่ม
                </div>
                <select
                  className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
                  value={editDrink}
                  onChange={(e) => setEditDrink(e.target.value)}
                  disabled={!editMenuId}
                >
                  <option value="">
                    {editMenuId ? "เลือกเครื่องดื่ม (ถ้ามี)" : "เลือกเมนูก่อน"}
                  </option>
                  {currentDrinkChoices.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <div className="text-[11px] text-admin-textMuted">หมายเหตุ</div>
            <textarea
              className="mt-1 w-full rounded-lg border border-admin-border bg-white px-3 py-2 text-sm"
              rows={3}
              placeholder="เช่น แพ้อาหาร / ไม่ใส่ผัก / ฯลฯ"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpenEdit(false);
                setEditingRow(null);
              }}
              className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm hover:bg-admin-surfaceMuted"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={saveEdit}
              disabled={
                savingEdit ||
                (editChoiceType === "food" &&
                  (!editRestaurantId || !editMenuId))
              }
              className={cx(
                "rounded-xl px-4 py-2 text-sm font-semibold",
                savingEdit
                  ? "bg-admin-border text-admin-textMuted"
                  : "bg-brand-primary text-white hover:opacity-90",
              )}
            >
              {savingEdit ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
