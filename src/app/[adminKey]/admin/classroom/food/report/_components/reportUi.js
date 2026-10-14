// shared helpers for the Food Report page (client-side only)
// row data comes from /api/admin/food-orders (resolveFoodDay) — nothing here changes a count rule,
// it only maps the existing type / couponState / progress fields to report labels.
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const TABS = ["overview", "shops", "types", "list"];
export const PAGE_SIZES = [10, 25, 50, 100];
export const MAX_RANGE_DAYS = 31;

export function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export function isYMD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

export function bangkokYMD(d = new Date()) {
  return String(d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) || "").slice(0, 10);
}

export function addDaysYMD(ymd, n) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

export function rangeDays(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length <= MAX_RANGE_DAYS; d = addDaysYMD(d, 1)) out.push(d);
  return out;
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Range / tab / table filters / page live in the URL.
 * Values are read straight from the search params (never mirrored into state).
 * Old URLs: ?from/?to (former header range) keep working, legacy ?date= is a one-day range,
 * ?shop= and ?day= (removed filters) are ignored and dropped on the next change.
 */
export function useReportParams(todayYMD) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const legacy = isYMD(sp.get("date")) ? sp.get("date") : "";
  let from = isYMD(sp.get("from")) ? sp.get("from") : legacy || todayYMD;
  let to = isYMD(sp.get("to")) ? sp.get("to") : legacy || from;
  if (from > to) [from, to] = [to, from];
  if (rangeDays(from, to).length > MAX_RANGE_DAYS) to = addDaysYMD(from, MAX_RANGE_DAYS - 1);

  const size = Number(sp.get("size"));
  const params = {
    from,
    to,
    tab: pick(sp.get("tab"), TABS, "overview"),
    cls: sp.get("class") || "",
    type: pick(sp.get("type"), Object.keys(TYPE_META), ""),
    status: pick(sp.get("status"), [...Object.keys(STATUS_META), "flagged"], ""),
    q: sp.get("q") || "",
    size: PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0],
    page: Math.max(1, Math.floor(Number(sp.get("page")) || 1)),
  };

  // patch: { key: value | "" | null }; empty removes the key.
  // Any change other than the page itself goes back to page 1.
  const setParams = useCallback(
    (patch) => {
      const next = new URLSearchParams(sp.toString());
      if ("from" in patch || "to" in patch) next.delete("date");
      next.delete("shop");
      next.delete("day");
      for (const [k, v] of Object.entries(patch)) {
        if (v === "" || v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, sp],
  );

  return [params, setParams];
}

/* ---------- dates ---------- */

function toBkkDate(d) {
  if (!d) return null;
  const ymd = typeof d === "string" ? String(d).slice(0, 10) : "";
  if (!ymd) return null;
  const dt = new Date(`${ymd}T00:00:00.000+07:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// 18 Feb 2026
export function formatDateEN(d) {
  const dt = toBkkDate(d);
  if (!dt) return "-";
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

// dd/mm/yyyy
export function formatDateDMY(d) {
  const dt = toBkkDate(d);
  if (!dt) return "-";
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

export function rangeLabel(from, to) {
  return from === to ? formatDateEN(from) : `${formatDateEN(from)} – ${formatDateEN(to)}`;
}

export function hmBKK(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function toYMD(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// unchanged from the previous Food Report (used by the edit flow's day index)
export function diffDaysBKK(aDate, bDate) {
  const a = new Date(aDate);
  const b = new Date(bDate);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const sa = new Date(`${toYMD(a)}T00:00:00.000+07:00`);
  const sb = new Date(`${toYMD(b)}T00:00:00.000+07:00`);
  if (Number.isNaN(sa.getTime()) || Number.isNaN(sb.getTime())) return 0;
  return Math.round((sb.getTime() - sa.getTime()) / (24 * 60 * 60 * 1000));
}

// day index (1-based) of the report day within the class — same rule the edit flow always used
export function classDayIndex(classDate, reportYMD) {
  let day = 1;
  if (classDate && reportYMD) {
    const d = diffDaysBKK(classDate, `${reportYMD}T00:00:00.000+07:00`) + 1;
    if (Number.isFinite(d) && d > 0) day = d;
  }
  return day;
}

/* ---------- class title ---------- */

function normalizeWs(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/ /g, " ")
    .trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ตัด prefix รหัสคอร์ส เช่น "GOO-ADK - ..." หรือ "GOO-ADK – ..."
export function cleanClassTitle(title, courseCode) {
  let t = normalizeWs(String(title || "").replace(/\n+/g, " "));
  const code = normalizeWs(courseCode || "");
  if (!t) return "-";
  if (code) {
    const re = new RegExp(`^(?:${escapeRegExp(code)}\\s*[-–—:]\\s*)+`, "i");
    t = t.replace(re, "").trim();
  }
  return t || "-";
}

/* ---------- C5c: resolved food state (from the API) ---------- */
// API ส่ง type มาเสมอ (set | none | coupon) — fallback ตรรกะเดิมเผื่อข้อมูลเก่า
export function rowType(o) {
  if (o?.type === "set" || o?.type === "none" || o?.type === "coupon") return o.type;
  const choice = String(o?.choiceType || o?.food?.choiceType || "").toLowerCase();
  let isCoupon = choice === "coupon" || o?.isCoupon === true || o?.food?.coupon === true;
  let isNoFood = choice === "nofood" || o?.isNoFood === true || o?.food?.noFood === true;
  if (!choice) {
    const noteLower = String(o?.note || o?.food?.note || "").toLowerCase();
    if (noteLower.includes("coupon")) isCoupon = true;
    if (noteLower.includes("ไม่รับอาหาร")) isNoFood = true;
  }
  return isCoupon ? "coupon" : isNoFood ? "none" : "set";
}

export function rowId(o) {
  return String(o.id || o._id);
}

// print / CSV labels (unchanged from C5c)
export const TYPE_LABEL = { set: "Set", none: "ไม่รับอาหาร", coupon: "Coupon" };

export const COUPON_STATE_LABEL = {
  ordered: "สั่งแล้ว",
  at_shop: "สั่งที่ร้าน",
  pending: "ยังไม่สั่ง",
  forfeited: "ตัดสิทธิ์",
  no_order: "ไม่มีออเดอร์",
};

export const FLAG_INFO = {
  mismatch: {
    label: "ข้อมูลไม่ตรง",
    tip: "มีออเดอร์คูปองวันนี้ แต่ข้อมูลอาหารของผู้เรียนไม่ได้เป็น COUPON",
  },
  no_checkin: {
    label: "ไม่ได้เช็คอิน",
    tip: "มีออเดอร์คูปองวันนี้ แต่ไม่พบการเช็คอินของวันนี้",
  },
  missing_code: {
    label: "ไม่มีโค้ด",
    tip: "ร้านคูปองกระดาษ: สั่งแล้วแต่ยังไม่ได้ผูกโค้ดคูปอง",
  },
};

export function couponRestaurantName(o) {
  return String(o?.couponShopName ?? "").trim();
}

// label สรุปของแถว coupon — ใช้ที่เดียว อย่าพิมพ์ "Cash Coupon" ซ้ำหลายที่
export function couponLabelFor(o) {
  const rest = couponRestaurantName(o);
  return rest ? `Cash Coupon — ${rest}` : "Cash Coupon";
}

export function couponStateText(o) {
  return COUPON_STATE_LABEL[o?.couponState] || "-";
}

export function sourceBadge(o) {
  if (o?.couponSource === "stock") return "Stock";
  if (o?.couponSource === "ecoupon") return "E";
  return "";
}

export function shopText(o) {
  const t = rowType(o);
  if (t === "coupon") return couponRestaurantName(o) || "-";
  if (t === "set") return o?.restaurantName || o?.food?.restaurantName || "-";
  return "-";
}

export function progressText(o) {
  if (rowType(o) !== "coupon") return "-";
  if (o.couponSource === "stock") {
    return o.handedOutAt ? `รับคูปองแล้ว ${hmBKK(o.handedOutAt)}` : "-";
  }
  if (o.couponSource === "ecoupon") {
    return o.redeemedAt ? `ใช้แล้ว ${hmBKK(o.redeemedAt)}` : "-";
  }
  return "-";
}

export function addonsOf(o) {
  return Array.isArray(o?.addons)
    ? o.addons
    : Array.isArray(o?.food?.addons)
      ? o.food.addons
      : [];
}

// รายการคูปอง: ชื่อ (ตัวเลือก) ×จำนวน — ไม่มีราคา
export function couponLinesText(o) {
  return (Array.isArray(o?.lines) ? o.lines : [])
    .map(
      (l) =>
        `${l.name || "-"}${l.options?.length ? ` (${l.options.join(", ")})` : ""} ×${l.qty || 1}`,
    )
    .join(" / ");
}

export function itemsText(o) {
  const t = rowType(o);
  if (t === "coupon") return couponLinesText(o) || "-";
  if (t === "set") {
    const parts = [
      o?.menuName || o?.food?.menuName || "",
      addonsOf(o).join(" / "),
      String(o?.drink ?? o?.food?.drink ?? ""),
    ].filter(Boolean);
    return parts.join(" · ") || "-";
  }
  return "-";
}

export function flagLabels(o) {
  return (Array.isArray(o?.flags) ? o.flags : [])
    .map((f) => FLAG_INFO[f]?.label || f)
    .join(", ");
}

/* ---------- report type / status mapping ---------- */

export const TYPE_META = {
  set: { label: "Set", cls: "bg-emerald-100 text-emerald-800" },
  ecoupon: { label: "E-coupon", cls: "bg-sky-100 text-sky-800" },
  stock: { label: "Stock", cls: "bg-amber-100 text-amber-800" },
  coupon: { label: "Coupon", cls: "bg-violet-100 text-violet-800", hint: "คูปองที่ยังไม่เลือกร้าน" },
  none: { label: "ไม่รับอาหาร", cls: "bg-slate-100 text-slate-600" },
};

// coupon rows without a shop yet (pending / forfeited / no_order) have no source → "coupon"
export function typeKeyOf(o) {
  const t = rowType(o);
  if (t !== "coupon") return t;
  if (o.couponSource === "ecoupon" || o.couponSource === "stock") return o.couponSource;
  return "coupon";
}

// mapped = one of the mockup labels; the rest keep their own label
export const STATUS_META = {
  used: { label: "ใช้แล้ว", cls: "bg-emerald-100 text-emerald-800", mapped: true, icon: "✓" },
  received: { label: "รับคูปองแล้ว", cls: "bg-sky-100 text-sky-800", mapped: true },
  awaiting: { label: "รอรับคูปอง", cls: "bg-amber-100 text-amber-800", mapped: true },
  expired: { label: "หมดอายุ", cls: "bg-red-100 text-red-700", mapped: true },
  set: { label: "สั่งอาหาร", cls: "bg-slate-200 text-slate-700", mapped: true },
  unused: { label: "ยังไม่ใช้", cls: "bg-slate-100 text-slate-600" },
  pending: { label: "ยังไม่สั่ง", cls: "bg-slate-100 text-slate-600" },
  forfeited: { label: "ตัดสิทธิ์", cls: "bg-slate-100 text-slate-600" },
  no_order: { label: "ไม่มีออเดอร์", cls: "bg-slate-100 text-slate-600" },
  none: { label: "ไม่รับอาหาร", cls: "bg-slate-100 text-slate-600" },
};

// columns of the shop summary / KPI order
export const MAPPED_STATUSES = ["used", "received", "awaiting", "expired", "set"];

/**
 * e-coupon (ordered/at_shop): redeemedAt → used; else after 15:00 of that day → expired; else unused
 * stock (ordered/at_shop): handed out → received; else awaiting
 * same progress fields the per-shop counts of C5c use (redeemed / handedOut / notRedeemed)
 */
export function statusKeyOf(o) {
  const t = rowType(o);
  if (t === "set") return "set";
  if (t === "none") return "none";
  const st = o.couponState || "no_order";
  if (st === "ordered" || st === "at_shop") {
    if (o.couponSource === "stock") {
      return o.handedOutAt || o.stockCodeStatus === "handed_out" ? "received" : "awaiting";
    }
    if (o.redeemedAt) return "used";
    return o.dayFinalClosed ? "expired" : "unused";
  }
  if (st === "pending" || st === "forfeited") return st;
  return "no_order";
}

// time of the last recorded status change
export function statusTimeOf(o) {
  const s = statusKeyOf(o);
  if (s === "used") return hmBKK(o.redeemedAt);
  if (s === "received") return hmBKK(o.handedOutAt);
  if (s === "awaiting" || s === "unused" || s === "expired") return hmBKK(o.orderedAt);
  return "";
}

// shop of a row: coupon → LunchOrder shop; set → Student.food restaurant; else none
export function shopOf(o) {
  const t = rowType(o);
  if (t === "coupon" && o.couponShopId) {
    return { key: o.couponShopId, name: couponRestaurantName(o) || "-" };
  }
  if (t === "set") {
    const name = o.restaurantName || o.food?.restaurantName || "";
    const key = o.restaurantId || (name ? `name:${name}` : "");
    if (key) return { key, name: name || "-" };
  }
  return null;
}

export const NO_SHOP_KEY = "_none";
export const NO_SHOP_LABEL = "ไม่ระบุร้าน";

export function setMenuLabel(o) {
  return o.menuName
    ? o.restaurantName
      ? `${o.restaurantName} — ${o.menuName}`
      : o.menuName
    : o.restaurantName || "-";
}

export function emptyCounts() {
  const c = { total: 0, coupon: 0, byStatus: {}, byType: {} };
  for (const k of Object.keys(STATUS_META)) c.byStatus[k] = 0;
  for (const k of Object.keys(TYPE_META)) c.byType[k] = 0;
  return c;
}

export function addCount(c, o) {
  c.total += 1;
  if (rowType(o) === "coupon") c.coupon += 1;
  c.byStatus[statusKeyOf(o)] += 1;
  c.byType[typeKeyOf(o)] += 1;
}

export function countRows(rows) {
  const c = emptyCounts();
  rows.forEach((o) => addCount(c, o));
  return c;
}

export function matchesSearch(o, q) {
  if (!q) return true;
  const t = rowType(o);
  const isCoupon = t === "coupon";
  const haystack = [
    o.studentName,
    o.studentThaiName,
    o.studentEngName,
    o.company,
    o.className,
    o.courseCode,
    o.roomName,
    t === "none" ? "ไม่รับอาหาร" : "",
    isCoupon ? "COUPON" : "",
    o.restaurantName ?? o.food?.restaurantName,
    o.menuName ?? o.food?.menuName,
    addonsOf(o).join(" "),
    o.drink ?? o.food?.drink,
    o.note ?? o.food?.note,
    isCoupon ? couponRestaurantName(o) : "",
    isCoupon ? o.code : "",
    isCoupon ? couponLinesText(o) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.trim().toLowerCase());
}

/* ---------- export (CSV / xlsx share the same rows) ---------- */

export function buildExportAoa(rows) {
  // C5c columns (no prices) + สถานะ (report label)
  const headers = [
    "วันที่",
    "รหัสคอร์ส",
    "ชื่อ Class",
    "ห้อง",
    "ชื่อผู้เรียน",
    "บริษัท",
    "ประเภท",
    "สถานะคูปอง",
    "ร้านอาหาร",
    "Stock/E",
    "Code",
    "Progress",
    "เมนู",
    "Add-on",
    "เครื่องดื่ม",
    "รายการคูปอง",
    "Flags",
    "หมายเหตุ",
    "สถานะ",
  ];

  const out = rows.map((o) => {
    const t = rowType(o);
    const isSet = t === "set";
    const isCoupon = t === "coupon";
    const addonsArr = addonsOf(o);
    return [
      formatDateDMY(o.dayYMD || o.date),
      o.courseCode || "",
      cleanClassTitle(o.className || o.classTitle || "", o.courseCode),
      o.roomName || "",
      o.studentName || o.studentThaiName || o.studentEngName || "",
      o.company || "",
      TYPE_LABEL[t],
      isCoupon ? couponStateText(o) : "",
      shopText(o) === "-" ? "" : shopText(o),
      isCoupon ? sourceBadge(o) : "",
      isCoupon ? o.code || "" : "",
      progressText(o) === "-" ? "" : progressText(o),
      isSet ? (o.menuName ?? o.food?.menuName ?? "") : "",
      isSet && addonsArr.length ? addonsArr.join(" / ") : "",
      isSet ? (o.drink ?? o.food?.drink ?? "") : "",
      isCoupon ? couponLinesText(o) : "",
      flagLabels(o),
      o.note ?? o.food?.note ?? "",
      STATUS_META[statusKeyOf(o)].label,
    ];
  });

  return [headers, ...out];
}

export function aoaToCsv(aoa) {
  return aoa
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
