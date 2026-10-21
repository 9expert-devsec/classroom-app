"use client";

// drawer ด้านขวา — รายละเอียดออเดอร์ของแถวที่เลือก
// ปุ่มใน footer เรียก handler ตัวเดียวกับปุ่มในตาราง
// "ประวัติการดำเนินการ" สร้างจากเวลาที่ API ส่งมาแล้วเท่านั้น (ส่งมอบ / ร้านใช้คูปอง)
import { useEffect } from "react";
import {
  Clock,
  Hand,
  History,
  Layers,
  Receipt,
  Store,
  Tag,
  Ticket,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import {
  CodeCell,
  RowActionList,
  StatusWithNote,
  baht,
  hasActions,
  sourceLabel,
} from "./lunchOrdersUi";

function Section({ Icon, title, children }) {
  return (
    <section className="border-t border-admin-border py-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-admin-text">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </section>
  );
}

function Field({ Icon, label, children }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-start gap-3 text-sm">
      <dt className="flex items-center gap-2 text-admin-textMuted">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-admin-text">{children}</dd>
    </div>
  );
}

function historyOf(row) {
  const ev = [];
  if (row.handedOutHM) {
    ev.push({
      key: "handout",
      hm: row.handedOutHM,
      label: "ส่งมอบคูปอง",
      by: row.handedOutBy,
      Icon: Hand,
      tone: "bg-teal-100 text-teal-700",
    });
  }
  if (row.redeemedHM) {
    ev.push({
      key: "redeemed",
      hm: row.redeemedHM,
      label: "ร้านใช้คูปองแล้ว",
      by: row.restaurantName,
      Icon: Ticket,
      tone: "bg-green-100 text-green-700",
    });
  }
  // ล่าสุดอยู่บน
  return ev.sort((a, b) => b.hm.localeCompare(a.hm));
}

export default function OrderDrawer({ row, error, actionProps, blockEsc, onClose }) {
  useEffect(() => {
    if (blockEsc) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blockEsc, onClose]);

  const history = historyOf(row);
  const footer = hasActions(row) ? <RowActionList row={row} {...actionProps} /> : null;

  return (
    <div className="fixed inset-0 z-40" data-testid="order-drawer">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="รายละเอียดการสั่งอาหาร"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:w-[440px]"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-lg font-semibold text-admin-text">รายละเอียดการสั่งอาหาร</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          <div className="flex items-center gap-3 pb-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-admin-text">{row.name || "-"}</div>
              <div className="truncate text-sm text-admin-textMuted">{row.nickname || "-"}</div>
            </div>
            <StatusWithNote row={row} />
          </div>

          <Section Icon={Receipt} title="ข้อมูลคำสั่งซื้อ">
            <Field Icon={Store} label="ร้านอาหาร">
              {row.restaurantName || "-"}
            </Field>
            <Field Icon={Tag} label="รหัสคูปอง">
              <CodeCell row={row} />
            </Field>
            <Field Icon={Layers} label="ที่มา">
              {sourceLabel(row) || "-"}
            </Field>
            {row.cancelReason ? (
              <Field Icon={X} label="เหตุผลยกเลิก">
                {row.cancelReason}
              </Field>
            ) : null}
          </Section>

          <Section Icon={Wallet} title="ข้อมูลการเงิน">
            <Field Icon={Receipt} label="ยอดรวม">
              <span className="tabular-nums">{row.itemsTotal ? baht(row.itemsTotal) : "-"}</span>
            </Field>
            <Field Icon={Wallet} label="ชำระเพิ่ม">
              {row.overBudget > 0 ? (
                <span className="font-semibold tabular-nums text-amber-600">
                  {baht(row.overBudget)}
                </span>
              ) : (
                "-"
              )}
            </Field>
          </Section>

          <Section Icon={Clock} title="เวลา">
            <Field Icon={Clock} label="ส่งก่อน">
              <span className="tabular-nums">{row.deadlineHM || "-"}</span>
              {row.reopenCount > 0 ? (
                <span className="ml-1 text-xs text-admin-textMuted">
                  (ออก QR ใหม่ {row.reopenCount} ครั้ง)
                </span>
              ) : null}
            </Field>
            <Field Icon={Hand} label="เวลาส่งมอบ">
              <span className="tabular-nums">{row.handedOutHM || "-"}</span>
            </Field>
            <Field Icon={UserRound} label="ส่งมอบโดย">
              {row.handedOutBy || "-"}
            </Field>
          </Section>

          {history.length ? (
            <section className="border-t border-admin-border py-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-admin-text">
                <History className="h-4 w-4" />
                ประวัติการดำเนินการ
              </h3>
              <ol className="flex flex-col gap-3">
                {history.map((e) => (
                  <li key={e.key} className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.tone}`}
                    >
                      <e.Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-admin-text">{e.label}</span>
                        <span className="shrink-0 tabular-nums text-xs text-admin-textMuted">
                          {e.hm}
                        </span>
                      </div>
                      {e.by ? <div className="text-xs text-admin-textMuted">โดย {e.by}</div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        {footer || error ? (
          <div className="border-t border-admin-border px-5 py-4">
            {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
