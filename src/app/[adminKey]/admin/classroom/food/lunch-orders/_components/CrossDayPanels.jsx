"use client";

// R2b: ส่วนที่ไม่จำกัดวันของหน้า "ติดตามการสั่งอาหาร"
//   - CodeSearchResult    : คำค้นตรงกับรหัสคูปอง -> ผู้ถือปัจจุบัน (แถวปกติ + ปุ่มตามกติกาเดิม)
//                           + ผู้ถือก่อนหน้า (อ่านอย่างเดียว)
//   - AwaitingReturnPanel : คูปองกระดาษที่รอรับคืนทุกวัน เก่าสุดก่อน + ปุ่มรับคืน
// ปุ่มทั้งหมดใช้ dispatcher ตัวเดียวกับตาราง (onAction)
import { Tag, Undo2 } from "lucide-react";

import CouponCode from "@/app/lunch/[token]/_components/CouponCode";
import ClassSection from "./ClassSection";
import { CODE_STATE } from "./lunchOrdersUi";

const TH = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-admin-textMuted";
const TD = "px-3 py-2.5 align-middle";

function dmy(ymd) {
  const [y, m, d] = String(ymd || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "-";
}

function CodeStateChip({ state }) {
  const meta = state === "held" ? { chip: "ถืออยู่", tone: "bg-green-100 text-green-700" } : CODE_STATE[state];
  if (!meta) return <span className="text-admin-textMuted">-</span>;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
      {meta.historyChip || meta.chip}
    </span>
  );
}

export function CodeSearchResult({ hit, selectedId, onSelect, actionProps }) {
  const p = hit.primary;
  const group = {
    id: `code-${p.orderId}`,
    name: `${p.className || "ไม่ระบุคลาส"} · ${dmy(p.dayYMD)}`,
    room: p.room || "",
    rows: [p],
  };

  return (
    <section
      data-testid="code-search-result"
      className="flex flex-col gap-3 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-3"
    >
      <h2 className="flex flex-wrap items-center gap-2 px-1 text-sm font-semibold text-admin-text">
        <Tag className="h-4 w-4" />
        ผลค้นหารหัสคูปอง
        <CouponCode code={hit.code} size="table" />
        {p.noHolder ? (
          // R3: ไม่มีใบไหนถือรหัสนี้อยู่ — แถวด้านล่างคือผู้ถือคนล่าสุด (ไม่มีปุ่มเปลี่ยนสถานะ)
          <span
            data-testid="code-no-holder"
            className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
          >
            {p.noHolderLabel || "ไม่มีผู้ถือ"}
          </span>
        ) : null}
        <span className="text-xs font-normal text-admin-textMuted">
          {p.noHolder ? "(ค้นทุกวัน · ผู้ถือคนล่าสุด)" : "(ค้นทุกวัน · ผู้ถือปัจจุบัน)"}
        </span>
      </h2>

      <ClassSection
        group={group}
        open
        onToggle={() => {}}
        selectedId={selectedId}
        onSelect={onSelect}
        actionProps={actionProps}
      />

      {hit.history?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-admin-border bg-white">
          <div className="px-4 pt-3 text-xs font-semibold text-admin-text">ผู้ถือรหัสนี้ก่อนหน้า</div>
          <table className="w-full min-w-[720px] text-sm" data-testid="code-search-history">
            <thead>
              <tr>
                <th className={`${TH} pl-4`}>วันที่</th>
                <th className={TH}>ผู้เรียน</th>
                <th className={TH}>คลาส / ห้อง</th>
                <th className={TH}>ร้าน</th>
                <th className={TH}>สถานะรหัส</th>
                <th className={`${TH} pr-4`}>เหตุผลยกเลิก</th>
              </tr>
            </thead>
            <tbody>
              {hit.history.map((h) => (
                <tr key={h.orderId} className="border-t border-admin-border text-admin-textMuted">
                  <td className={`${TD} pl-4 tabular-nums`}>{dmy(h.dayYMD)}</td>
                  <td className={TD}>
                    {h.name || "-"}
                    {h.nickname ? ` (${h.nickname})` : ""}
                  </td>
                  <td className={TD}>
                    {h.className || "-"}
                    {h.room ? ` · ห้อง ${h.room}` : ""}
                  </td>
                  <td className={TD}>{h.restaurantName || "-"}</td>
                  <td className={TD}>
                    <CodeStateChip state={h.couponCodeState} />
                  </td>
                  <td className={`${TD} pr-4`}>{h.cancelReasonLabel || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function AwaitingReturnPanel({ items, busy, onAction }) {
  return (
    <section
      data-testid="awaiting-return-panel"
      className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm"
    >
      <h2 className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        <Undo2 className="h-4 w-4" />
        คูปองกระดาษรอรับคืน (ทุกวัน) · {items.length} ใบ
      </h2>
      {!items.length ? (
        <p className="p-6 text-center text-sm text-admin-textMuted">ไม่มีคูปองที่รอรับคืน</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-admin-surfaceMuted/60">
              <tr>
                <th className={`${TH} pl-4`}>วันที่</th>
                <th className={TH}>ผู้เรียน</th>
                <th className={TH}>คลาส / ห้อง</th>
                <th className={TH}>ร้าน</th>
                <th className={TH}>รหัส</th>
                <th className={TH}>เหตุผลยกเลิก</th>
                <th className={TH}>ค้าง</th>
                <th className={`${TH} pr-4 text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.codeId} className="border-t border-admin-border">
                  <td className={`${TD} pl-4 tabular-nums`}>{dmy(it.dayYMD)}</td>
                  <td className={TD}>
                    <div className="font-medium text-admin-text">{it.name || "-"}</div>
                    <div className="text-xs text-admin-textMuted">{it.nickname || "-"}</div>
                  </td>
                  <td className={`${TD} text-xs`}>
                    {it.className || "-"}
                    {it.room ? <div className="text-admin-textMuted">ห้อง {it.room}</div> : null}
                  </td>
                  <td className={`${TD} text-xs`}>{it.restaurantName || "-"}</td>
                  <td className={TD}>
                    <CouponCode code={it.code} size="table" />
                  </td>
                  <td className={`${TD} text-xs`}>{it.cancelReasonLabel || "-"}</td>
                  <td className={`${TD} whitespace-nowrap text-xs tabular-nums`}>
                    {it.daysOutstanding == null
                      ? "-"
                      : it.daysOutstanding === 0
                        ? "วันนี้"
                        : `${it.daysOutstanding} วัน`}
                  </td>
                  <td className={`${TD} pr-4`}>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busy}
                        data-testid="awaiting-return-btn"
                        onClick={() =>
                          onAction("return", {
                            orderId: it.orderId,
                            name: it.name,
                            nickname: it.nickname,
                            stockCodeId: it.codeId,
                            couponCode: it.code,
                          })
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        รับคืน
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
