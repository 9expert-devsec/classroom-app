"use client";

// drawer ด้านขวา — รายละเอียดออเดอร์ของแถวที่เลือก
// R2a-2: ส่วน "จัดการ" = ทุกปุ่มของแถว (handler ตัวเดียวกับตาราง) แล้วตามด้วย "ประวัติ"
//        ประวัติมาจาก GET /api/admin/lunch/timeline (ออเดอร์ทุกใบของวันนั้น + audit)
//        โหลดตอนเปิด และโหลดใหม่หลังทำรายการทุกครั้ง (refreshKey)
import { useEffect, useState } from "react";
import {
  Clock,
  Hand,
  History,
  Layers,
  Receipt,
  Settings2,
  Store,
  Tag,
  Undo2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";

import { safeJson } from "@/components/admin/lunch/lunchApi";
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

// สีของจุดในประวัติ ตามชนิดเหตุการณ์
const KIND_TONE = {
  issued: "bg-blue-500",
  submitted: "bg-green-500",
  handed_out: "bg-teal-500",
  redeemed: "bg-green-600",
  cancelled: "bg-red-500",
  voided: "bg-red-400",
  returned: "bg-amber-500",
  food_choice: "bg-slate-400",
  view_qr: "bg-slate-300",
  special_open: "bg-slate-400",
};

// loading = ผลล่าสุดยังไม่ใช่ของคำขอนี้ (ระหว่างโหลดใหม่ยังแสดงรายการเดิมไว้)
function useTimeline(row, refreshKey) {
  const { classId, studentId, dayYMD } = row;
  const reqKey = `${classId}|${studentId}|${dayYMD}|${refreshKey}`;
  const [state, setState] = useState({ key: "", error: "", events: [] });

  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams({ classId, studentId, dayYMD });
    fetch(`/api/admin/lunch/timeline?${p}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await safeJson(res);
        if (!alive) return;
        setState(
          res.ok
            ? { key: reqKey, error: "", events: json.events || [] }
            : { key: reqKey, error: json.error || "โหลดประวัติไม่สำเร็จ", events: [] },
        );
      })
      .catch(() => {
        if (alive) setState({ key: reqKey, error: "เชื่อมต่อไม่สำเร็จ", events: [] });
      });
    return () => {
      alive = false;
    };
  }, [classId, studentId, dayYMD, reqKey]);

  return { loading: state.key !== reqKey, error: state.error, events: state.events };
}

function Timeline({ row, refreshKey, busy, onAction }) {
  const { loading, error, events } = useTimeline(row, refreshKey);

  return (
    <section className="border-t border-admin-border py-4" data-testid="lunch-timeline">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-admin-text">
        <History className="h-4 w-4" />
        ประวัติ
      </h3>
      {loading && !events.length ? (
        <p className="text-sm text-admin-textMuted">กำลังโหลด…</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && !events.length ? (
        <p className="text-sm text-admin-textMuted">ยังไม่มีประวัติ</p>
      ) : null}
      {events.length ? (
        <ol className="relative flex flex-col gap-3 border-l border-admin-border pl-4">
          {events.map((e, i) => (
            <li key={`${e.orderId || "food"}-${e.kind}-${e.at}-${i}`} className="relative">
              <span
                className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                  KIND_TONE[e.kind] || "bg-slate-400"
                }`}
              />
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-admin-text">{e.label}</span>
                <span className="shrink-0 tabular-nums text-xs text-admin-textMuted">{e.hm}</span>
              </div>
              {e.actorName ? (
                <div className="text-xs text-admin-textMuted">โดย {e.actorName}</div>
              ) : null}
              {e.detail ? (
                <div className="break-words text-xs text-admin-textMuted">{e.detail}</div>
              ) : null}
              {/* ใบเก่าที่คูปองกระดาษยังรอรับคืน — ปุ่มรับคืนของใบนั้นเอง */}
              {e.awaitingReturn && e.stockCodeId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onAction("return", {
                      ...row,
                      orderId: e.orderId,
                      stockCodeId: e.stockCodeId,
                      couponCode: e.couponCode || "",
                    })
                  }
                  className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  รับคืน
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export default function OrderDrawer({
  row,
  error,
  actionProps,
  timelineKey = 0,
  blockEsc,
  onClose,
}) {
  useEffect(() => {
    if (blockEsc) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blockEsc, onClose]);

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

          {/* R2a-2: ทุกปุ่มของแถว เต็มความกว้าง พร้อมเหตุผลของปุ่มที่กดไม่ได้ */}
          {hasActions(row) || error ? (
            <section className="border-t border-admin-border py-4" data-testid="drawer-actions">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-admin-text">
                <Settings2 className="h-4 w-4" />
                จัดการ
              </h3>
              {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
              <RowActionList row={row} {...actionProps} />
            </section>
          ) : null}

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

          <Timeline
            row={row}
            refreshKey={timelineKey}
            busy={actionProps?.busy}
            onAction={actionProps?.onAction}
          />
        </div>
      </aside>
    </div>
  );
}
