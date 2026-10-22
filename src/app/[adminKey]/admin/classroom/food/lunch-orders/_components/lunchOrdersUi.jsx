"use client";

// ชิ้นส่วนที่ใช้ร่วมกันของหน้า "ติดตามการสั่งอาหาร" (การ์ดสถานะ / ตาราง / drawer)
// สถานะ = ค่าจริงจาก /api/admin/lunch/orders (computeStatus) — ไม่ได้เพิ่มสถานะใหม่
import {
  ArrowRightLeft,
  Check,
  CircleX,
  Clock,
  FileX,
  MoreHorizontal,
  Pencil,
  QrCode,
  RefreshCcw,
  RotateCw,
  ShoppingCart,
  Store,
  Undo2,
  X,
} from "lucide-react";

import { LUNCH_STATUS_LABELS } from "@/components/shared/LunchStatusBadge";
import CouponCode from "@/app/lunch/[token]/_components/CouponCode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cancelReasonLabel } from "@/lib/lunchCancelReasons";

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

/* ---------------- cells ---------------- */

export function sourceLabel(row) {
  if (row.couponSource === "stock") return "stock";
  if (row.couponSource === "ecoupon") return "e-coupon";
  return "";
}

// R2a-3: รหัสของใบที่ยกเลิกแล้ว (row.couponCodeState จาก server) — ใบเก็บรหัสไว้เป็นประวัติ
//        แต่ต้องไม่ดูเหมือนยังถืออยู่ · strike = ขีดฆ่า + จาง, chip = ป้ายสถานะ
export const CODE_STATE = {
  awaiting_return: { strike: false, chip: "รอคืน", tone: "bg-amber-100 text-amber-800" },
  returned: { strike: true, chip: "คืนแล้ว", tone: "bg-slate-100 text-slate-600" },
  released: { strike: true, chip: "คืนเข้า stock", tone: "bg-slate-100 text-slate-600" },
  voided: { strike: true, chip: "ยกเลิกแล้ว", tone: "bg-red-100 text-red-700" },
};

export function CodeCell({ row }) {
  if (!row.couponCode) return <span className="text-admin-textMuted">-</span>;
  // ข้อมูลเก่าที่ไม่มี couponCodeState แต่ void แล้ว -> แสดงแบบ voided
  const state = CODE_STATE[row.couponCodeState] || (row.couponVoided ? CODE_STATE.voided : null);
  if (state) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5" data-code-state={row.couponCodeState || "voided"}>
        <span
          className={
            state.strike ? "line-through decoration-slate-400 decoration-2 opacity-50" : ""
          }
        >
          <CouponCode code={row.couponCode} size="table" />
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>
          {state.chip}
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

// R2a-2: ปุ่มของแถวมาจาก server (row.actions) ที่เดียว — ที่นี่แค่วาด
//   row.actions[key] = { allowed, reason } · ไม่มี key = ไม่เกี่ยวกับสถานะนี้ (ไม่แสดง)
//   กดไม่ได้ยังแสดงพร้อมเหตุผล เหมือนเดิม
const OUTLINE = "border bg-white";
export const ACTION_META = {
  viewQr: {
    label: "ดู QR",
    Icon: QrCode,
    cls: `${OUTLINE} border-admin-border text-admin-text hover:bg-admin-surfaceMuted`,
  },
  handout: {
    label: "ยืนยันส่งมอบ",
    Icon: Check,
    cls: "bg-brand-primaryDark text-white hover:opacity-90",
  },
  issue: {
    label: "ออก QR ใหม่",
    Icon: RotateCw,
    cls: `${OUTLINE} border-green-200 text-green-700 hover:bg-green-50`,
  },
  return: {
    label: "รับคืน",
    Icon: Undo2,
    cls: "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  regenerate: {
    label: "Regenerate QR",
    Icon: RefreshCcw,
    cls: `${OUTLINE} border-green-200 text-green-700 hover:bg-green-50`,
  },
  // R3: มีเฉพาะเมื่อ server บอกว่าโยกได้
  reassign: {
    label: "โยกไปร้านอื่น",
    Icon: ArrowRightLeft,
    cls: `${OUTLINE} border-sky-200 text-sky-700 hover:bg-sky-50`,
  },
  cancelForEdit: {
    label: "ยกเลิกเพื่อแก้ไขออเดอร์",
    Icon: Pencil,
    cls: `${OUTLINE} border-red-200 text-red-600 hover:bg-red-50`,
  },
  cancelCoupon: {
    label: "ยกเลิกคูปอง",
    Icon: X,
    cls: `${OUTLINE} border-red-200 text-red-600 hover:bg-red-50`,
  },
};

// ลำดับในเมนู / ใน drawer
const ACTION_ORDER = [
  "viewQr",
  "handout",
  "issue",
  "return",
  "regenerate",
  "reassign",
  "cancelForEdit",
  "cancelCoupon",
];

/**
 * R3-1: ปุ่ม "รับคืนคูปอง" หนึ่งปุ่มต่อรหัสที่รอคืน (row.pendingReturns — จากใบใดก็ได้ของวันนั้น)
 * กดแล้วใช้ทางรับคืนเดิม (onAction("return", แถวที่ชี้รหัสนั้น) -> โมดัลยืนยันเดิม -> /api/admin/lunch/return)
 */
function returnItems(row) {
  if (!row?.actions?.returnCoupon) return [];
  return (row.pendingReturns || []).map((pr) => ({
    key: `returnCoupon:${pr.codeId}`,
    actionKey: "return",
    actionRow: { ...row, orderId: pr.orderId, stockCodeId: pr.codeId, couponCode: pr.code },
    label: `รับคืนคูปอง ${pr.code}`,
    shortLabel: "รับคืนคูปอง",
    Icon: Undo2,
    cls: ACTION_META.return.cls,
    allowed: true,
    reason: "",
  }));
}

/** ปุ่มทั้งหมดที่เกี่ยวกับแถวนี้ (ตามลำดับ) — R3-1: รับคืนคูปองขึ้นก่อน */
export function rowActionList(row) {
  const a = row?.actions || {};
  return [
    ...returnItems(row),
    ...ACTION_ORDER.filter((k) => a[k]).map((k) => ({
      key: k,
      ...ACTION_META[k],
      allowed: !!a[k].allowed,
      reason: a[k].allowed ? "" : a[k].reason || "",
    })),
  ];
}

// ปุ่มชี้ไปที่ action จริง (รับคืนคูปองของรหัสหนึ่ง = "return" กับแถวที่ชี้รหัสนั้น)
function runItem(item, row, onAction) {
  if (item.allowed) onAction(item.actionKey || item.key, item.actionRow || row);
}

export function hasActions(row) {
  return rowActionList(row).length > 0;
}

/**
 * ปุ่มหลักของแถว (ที่เหลืออยู่ในเมนู ⋯)
 *   pending / forfeited -> ดู QR
 *   ordered / at_shop   -> ยืนยันส่งมอบ (stock รหัส assigned) ไม่งั้น ดู QR
 *   cancelled           -> ออก QR ใหม่ ถ้ากดได้ ไม่งั้น รับคืน ถ้ากดได้
 *   R3-1: มีคูปองกระดาษรอรับคืน -> "รับคืนคูปอง" (รหัสแรก) ก่อนเสมอ ที่เหลืออยู่ในเมนู ⋯
 *         รับคืนแล้ว -> กลับไปใช้กติกาด้านบน (เช่น ยืนยันส่งมอบของใบใหม่)
 */
export function primaryActionKey(row) {
  const a = row?.actions || {};
  const firstReturn = returnItems(row)[0];
  if (firstReturn) return firstReturn.key;
  if (row?.status === "cancelled") {
    if (a.issue?.allowed) return "issue";
    if (a.return?.allowed) return "return";
    return null;
  }
  if ((row?.status === "ordered" || row?.status === "at_shop") && a.handout) return "handout";
  return a.viewQr ? "viewQr" : null;
}

const stop = (fn) => (e) => {
  e.stopPropagation();
  fn();
};

function ActionButton({ item, busy, onAction, row, full }) {
  const base = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
    full ? "h-11 w-full text-sm" : "h-8 w-full px-3 text-xs"
  }`;
  const icon = full ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-testid={`action-${item.key}`}
        disabled={busy || !item.allowed}
        title={item.reason || undefined}
        onClick={stop(() => runItem(item, row, onAction))}
        className={`${base} ${item.cls}`}
      >
        <item.Icon className={icon} />
        {!full && item.shortLabel ? item.shortLabel : item.label}
      </button>
      {item.reason ? (
        <span className={`text-[11px] text-admin-textMuted ${full ? "text-center" : "text-right"}`}>
          {item.reason}
        </span>
      ) : null}
    </div>
  );
}

/** คอลัมน์ "จัดการ" ในตาราง: ปุ่มหลัก 1 ปุ่ม + เมนู ⋯ ที่เหลือ · ไม่มีอะไรเลย = "-" */
export function RowActionsCell({ row, busy, onAction }) {
  const items = rowActionList(row);
  if (!items.length) return <span className="block text-right text-admin-textMuted">-</span>;

  const primaryKey = primaryActionKey(row);
  const primary = items.find((it) => it.key === primaryKey) || null;
  const rest = items.filter((it) => it !== primary);

  return (
    <div className="flex w-[168px] items-start justify-end gap-1.5">
      {primary ? (
        <div className="min-w-0 flex-1">
          <ActionButton item={primary} busy={busy} onAction={onAction} row={row} />
        </div>
      ) : null}
      {rest.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="การจัดการอื่น"
              data-testid="action-more"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-56 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {rest.map((it) => (
              <DropdownMenuItem
                key={it.key}
                disabled={busy || !it.allowed}
                onSelect={() => runItem(it, row, onAction)}
                className="flex cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-xs focus:bg-admin-surfaceMuted"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <it.Icon className="h-3.5 w-3.5" />
                  {it.label}
                </span>
                {it.reason ? (
                  <span className="text-[11px] text-admin-textMuted">{it.reason}</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

/** drawer: ทุกปุ่มที่เกี่ยวกับแถวนี้ เต็มความกว้าง พร้อมเหตุผลของปุ่มที่กดไม่ได้ */
export function RowActionList({ row, busy, onAction }) {
  const items = rowActionList(row);
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <ActionButton key={it.key} item={it} busy={busy} onAction={onAction} row={row} full />
      ))}
    </div>
  );
}

/** R3: แถวที่เลือกเข้าชุด "โยกไปร้านอื่น" ได้ (ตาม row.actions จาก server) */
export function canReassign(row) {
  return !!row?.actions?.reassign?.allowed;
}

/* ---------------- cancelled reason ---------------- */

/**
 * ป้ายใต้สถานะ "ยกเลิก" (จาก latestCancelReason + ตัวเลือกปัจจุบัน)
 * ตัดสิทธิ์ = "หมดเวลา 15:00"
 */
export function statusNote(row) {
  // R2b: ป้ายขั้นจาก server (lunchStage.js ตัวเดียวกับ Food Report)
  // R3x-3: ป้ายจาก server มีเวลาปิดจริงอยู่แล้ว — ไม่มี (ข้อมูลเก่า) = ไม่เดาเวลาเอง
  if (row?.status === "forfeited") return row.stageLabel || "ตัดสิทธิ์";
  if (row?.status !== "cancelled") return "";
  const reason = String(row.latestCancelReason ?? row.cancelReason ?? "");
  const cur = row.currentChoice;
  if (reason === "choice_changed") {
    if (cur?.choiceType === "noFood") return "เปลี่ยนเป็น ไม่รับอาหาร";
    if (cur?.choiceType === "food") return `เปลี่ยนเป็น Set ${cur.restaurantName || ""}`.trim();
    return "เปลี่ยนตัวเลือกอาหาร";
  }
  if (reason === "admin_cancel_coupon") return "ยกเลิกคูปอง (ไม่รับอาหาร)";
  if (reason === "admin_cancel_for_edit") return "ยกเลิกเพื่อแก้ไข รอออก QR ใหม่";
  return cancelReasonLabel(reason, { byAdmin: !!row.cancelledByAdmin });
}

/** ป้ายสถานะ + บรรทัดเหตุผลเล็ก ๆ ด้านล่าง (ตาราง / drawer) */
export function StatusWithNote({ row }) {
  const note = statusNote(row);
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusPill status={row.status} />
      {note ? (
        <span data-testid="status-note" className="text-[11px] text-admin-textMuted">
          {note}
        </span>
      ) : null}
    </div>
  );
}
