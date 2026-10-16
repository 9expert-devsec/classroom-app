"use client";

// ชิ้นส่วนที่ใช้ร่วมกันของหน้า "ติดตามการสั่งอาหาร" (การ์ดสถานะ / ตาราง / drawer)
// สถานะ = ค่าจริงจาก /api/admin/lunch/orders (computeStatus) — ไม่ได้เพิ่มสถานะใหม่
import {
  Check,
  CircleX,
  Clock,
  FileX,
  RotateCw,
  ShoppingCart,
  Store,
  Undo2,
  X,
} from "lucide-react";

import { LUNCH_STATUS_LABELS } from "@/components/shared/LunchStatusBadge";
import CouponCode from "@/app/lunch/[token]/_components/CouponCode";

export const STATUS_KEYS = ["pending", "forfeited", "ordered", "at_shop", "cancelled"];

// card = การ์ดสรุป, pill = ป้ายในตาราง/drawer, icon = วงกลมไอคอนในการ์ด
export const STATUS_META = {
  pending: {
    Icon: Clock,
    card: "border-blue-100 bg-blue-50/60",
    ring: "ring-blue-400",
    icon: "bg-blue-100 text-blue-600",
    text: "text-blue-700",
    pill: "bg-blue-50 text-blue-700",
  },
  forfeited: {
    Icon: FileX,
    card: "border-amber-100 bg-amber-50/60",
    ring: "ring-amber-400",
    icon: "bg-amber-100 text-amber-600",
    text: "text-amber-700",
    pill: "bg-amber-50 text-amber-700",
  },
  ordered: {
    Icon: ShoppingCart,
    card: "border-green-100 bg-green-50/60",
    ring: "ring-green-400",
    icon: "bg-green-100 text-green-600",
    text: "text-green-700",
    pill: "bg-green-50 text-green-700",
  },
  at_shop: {
    Icon: Store,
    card: "border-teal-100 bg-teal-50/60",
    ring: "ring-teal-400",
    icon: "bg-teal-100 text-teal-600",
    text: "text-teal-700",
    pill: "bg-teal-50 text-teal-700",
  },
  cancelled: {
    Icon: CircleX,
    card: "border-red-100 bg-red-50/60",
    ring: "ring-red-400",
    icon: "bg-red-100 text-red-600",
    text: "text-red-700",
    pill: "bg-red-50 text-red-700",
  },
};

export function StatusPill({ status }) {
  const m = STATUS_META[status];
  const Icon = m?.Icon;
  return (
    <span
      data-testid="lunch-status"
      data-status={status}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        m?.pill || "bg-slate-100 text-slate-600"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {LUNCH_STATUS_LABELS[status] || status}
    </span>
  );
}

/* ---------------- avatar ---------------- */

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-fuchsia-100 text-fuchsia-700",
];

// ตัวอักษรแรกที่ใช้เป็นอักษรย่อได้ (ข้ามสระหน้า เ แ โ ใ ไ ของภาษาไทย)
function firstLetter(word) {
  return Array.from(word).find((ch) => /[A-Za-z0-9ก-ฮ]/.test(ch)) || "";
}

export function initialsOf(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const s = words
    .slice(0, 2)
    .map(firstLetter)
    .join("")
    .toUpperCase();
  return s || "?";
}

function toneOf(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ name, size = "md" }) {
  const dim = size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${toneOf(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ---------------- cells ---------------- */

export function sourceLabel(row) {
  if (row.couponSource === "stock") return "stock";
  if (row.couponSource === "ecoupon") return "e-coupon";
  return "";
}

export function CodeCell({ row }) {
  if (!row.couponCode) return <span className="text-admin-textMuted">-</span>;
  if (row.couponVoided) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="line-through decoration-red-500 decoration-2 opacity-60">
          <CouponCode code={row.couponCode} size="table" />
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
          void
        </span>
      </span>
    );
  }
  // C2: ร้านใช้คูปองแล้ว
  if (row.redeemedHM) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        <CouponCode code={row.couponCode} size="table" />
        <span className="text-[11px] font-medium text-green-700">ใช้แล้ว {row.redeemedHM}</span>
      </span>
    );
  }
  return <CouponCode code={row.couponCode} size="table" />;
}

export function baht(n) {
  return `${Number(n || 0).toLocaleString("th-TH")} ฿`;
}

/* ---------------- actions ---------------- */

// กติกาว่าปุ่มไหนแสดงเมื่อไหร่ = เดิมทุกอย่าง (เปลี่ยนแค่หน้าตา)
function visibleActions(row) {
  return {
    handout:
      (row.status === "ordered" || row.status === "at_shop") && row.stockStatus === "assigned",
    ret: row.status === "cancelled" && row.stockStatus === "awaiting_return",
    cancel: !!(row.canCancel || row.cancelBlockedReason),
    reissue: !!(row.canReissue || row.reissueBlockedReason),
  };
}

export function hasActions(row) {
  return Object.values(visibleActions(row)).some(Boolean);
}

// full = ปุ่มเต็มความกว้างใน footer ของ drawer
export function ActionButtons({ row, busy, onCancel, onReissue, onHandout, onReturn, full = false }) {
  const base = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition disabled:opacity-50 ${
    full ? "h-11 w-full text-sm" : "h-8 w-full px-3 text-xs"
  }`;
  const icon = full ? "h-4 w-4" : "h-3.5 w-3.5";
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const {
    handout: showHandout,
    ret: showReturn,
    cancel: showCancel,
    reissue: showReissue,
  } = visibleActions(row);
  const note =
    !row.canCancel && row.cancelBlockedReason
      ? row.cancelBlockedReason
      : !row.canReissue && row.reissueBlockedReason
        ? row.reissueBlockedReason
        : "";

  if (!showHandout && !showReturn && !showCancel && !showReissue) {
    return full ? null : <span className="block text-center text-admin-textMuted">-</span>;
  }

  return (
    <div className={`flex flex-col gap-1.5 ${full ? "" : "w-[136px]"}`}>
      {showHandout ? (
        <button
          type="button"
          disabled={busy}
          onClick={stop(() => onHandout(row))}
          className={`${base} bg-brand-primaryDark text-white hover:opacity-90`}
        >
          <Check className={icon} />
          ยืนยันส่งมอบ
        </button>
      ) : null}
      {showReturn ? (
        <button
          type="button"
          disabled={busy}
          onClick={stop(() => onReturn(row))}
          className={`${base} border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}
        >
          <Undo2 className={icon} />
          รับคืน
        </button>
      ) : null}
      {showCancel ? (
        <button
          type="button"
          disabled={busy || !row.canCancel}
          title={row.cancelBlockedReason || undefined}
          onClick={stop(() => row.canCancel && onCancel(row))}
          className={`${base} border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed`}
        >
          <X className={icon} />
          {full ? "ยกเลิกคำสั่งซื้อ" : "ยกเลิก"}
        </button>
      ) : null}
      {showReissue ? (
        <button
          type="button"
          disabled={busy || !row.canReissue}
          title={row.reissueBlockedReason || undefined}
          onClick={stop(() => row.canReissue && onReissue(row))}
          className={`${base} border border-green-200 bg-white text-green-700 hover:bg-green-50 disabled:cursor-not-allowed`}
        >
          <RotateCw className={icon} />
          ออก QR ใหม่
        </button>
      ) : null}
      {note ? (
        <span className={`text-[11px] text-admin-textMuted ${full ? "text-center" : "text-right"}`}>
          {note}
        </span>
      ) : null}
    </div>
  );
}
