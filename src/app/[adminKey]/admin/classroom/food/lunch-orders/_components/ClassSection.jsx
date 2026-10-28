"use client";

// การ์ดต่อคลาส (พับได้) + ตารางผู้เรียนของคลาสนั้น
import { ChevronDown, Clock, GraduationCap, Hand, Layers, Store, Tag, Users } from "lucide-react";

import {
  CodeCell,
  RowActionsCell,
  StatusWithNote,
  baht,
  canReassign,
  sourceLabel,
} from "./lunchOrdersUi";

// wrap: ข้อความยาวขึ้นบรรทัดใหม่ในช่อง (ไม่ตัด …) · code: รหัสคูปองห้ามหักกลางรหัส
function IconLine({ Icon, children, wrap = false, code = false }) {
  const text = code ? "min-w-0 break-normal" : wrap ? "min-w-0 break-words" : "min-w-0 truncate";
  return (
    <div className={`flex min-w-0 gap-2 ${wrap || code ? "items-start" : "items-center"}`}>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 text-admin-textMuted ${wrap || code ? "mt-px" : ""}`}
      />
      <div className={text}>{children}</div>
    </div>
  );
}

const TH = "px-3 py-2.5 text-left text-xs font-medium text-admin-textMuted";

// R6-2: ความกว้างคอลัมน์ชุดเดียวของทุกการ์ดคลาส (table-fixed) -> คอลัมน์ตรงกันทุกการ์ด
// width: null = คอลัมน์ที่รับพื้นที่เหลือบนจอกว้าง (ขั้นต่ำ = minWidth)
// R6-2b: รวม 920 = พื้นที่การ์ดที่ 1280 เมื่อเมนูซ้ายกางอยู่ -> ไม่ต้องเลื่อนแนวนอน
export const TRACKING_COLUMNS = [
  { key: "check", width: 40, selectOnly: true },
  { key: "learner", width: 150 },
  { key: "status", width: 150 },
  { key: "detail", width: null, minWidth: 144 },
  { key: "amount", width: 100 },
  { key: "time", width: 160 },
  // ปุ่มหลักแบบมีข้อความ (ยาวสุด "ยืนยันส่งมอบ" ~108px) + ปุ่ม ⋯ 32 + gap 6 + padding pl-3 pr-4
  { key: "actions", width: 176 },
];

function trackingColumns(selectable) {
  return TRACKING_COLUMNS.filter((c) => selectable || !c.selectOnly);
}

/** ความกว้างรวมขั้นต่ำ — จอแคบกว่านี้เลื่อนแนวนอนแทนการบีบคอลัมน์ */
export function trackingTableMinWidth(selectable) {
  return trackingColumns(selectable).reduce((sum, c) => sum + (c.width ?? c.minWidth), 0);
}

export function TrackingColGroup({ selectable }) {
  return (
    <colgroup>
      {trackingColumns(selectable).map((c) => (
        <col key={c.key} style={c.width ? { width: c.width } : undefined} />
      ))}
    </colgroup>
  );
}

export default function ClassSection({
  group,
  open,
  onToggle,
  selectedId,
  onSelect,
  actionProps,
  // R3: เลือกหลายคนเพื่อโยกไปร้านอื่น (ไม่ส่ง = ไม่มีคอลัมน์ checkbox)
  checked = null,
  onCheck = null,
}) {
  const selectable = !!onCheck;
  const eligibleRows = selectable ? group.rows.filter(canReassign) : [];
  const allChecked =
    eligibleRows.length > 0 && eligibleRows.every((r) => checked?.has(r.orderId));
  return (
    <section
      data-testid="class-card"
      className="overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-admin-surfaceMuted/60"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">
          <span className="min-w-0 truncate text-base font-semibold text-admin-text">
            {group.name || "ไม่ระบุคลาส"}
          </span>
          {group.room ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-admin-textMuted">
              <Users className="h-4 w-4" />
              ห้อง {group.room}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          ผู้เรียน {group.rows.length} คน
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-admin-textMuted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="overflow-x-auto border-t border-admin-border">
          <table
            className="w-full table-fixed text-sm"
            style={{ minWidth: trackingTableMinWidth(selectable) }}
          >
            <TrackingColGroup selectable={selectable} />
            <thead className="bg-admin-surfaceMuted/60">
              <tr>
                {selectable ? (
                  <th className="py-2.5 pl-4 text-left">
                    <input
                      type="checkbox"
                      aria-label="เลือกทุกคนที่โยกได้ในคลาสนี้"
                      disabled={!eligibleRows.length}
                      checked={allChecked}
                      onChange={() => onCheck(eligibleRows, !allChecked)}
                    />
                  </th>
                ) : null}
                <th className={`${TH} ${selectable ? "" : "pl-4"}`}>ผู้เรียน</th>
                <th className={TH}>สถานะ</th>
                <th className={TH}>รายละเอียดออเดอร์</th>
                <th className={TH}>ยอดเงิน</th>
                <th className={TH}>เวลา</th>
                <th className={`${TH} pr-4 text-right`}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => {
                const selected = r.orderId === selectedId;
                return (
                  <tr
                    key={r.orderId}
                    data-testid="order-row"
                    onClick={() => onSelect(r.orderId)}
                    className={`cursor-pointer border-t border-admin-border align-middle transition-colors ${
                      selected ? "bg-blue-50/70" : "hover:bg-admin-surfaceMuted/60"
                    }`}
                  >
                    {selectable ? (
                      <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          data-testid="reassign-check"
                          aria-label={`เลือก ${r.name || ""}`}
                          disabled={!canReassign(r)}
                          title={canReassign(r) ? undefined : "โยกไปร้านอื่นไม่ได้"}
                          checked={!!checked?.has(r.orderId)}
                          onChange={(e) => onCheck([r], e.target.checked)}
                        />
                      </td>
                    ) : null}
                    <td className={`py-3 pr-3 ${selectable ? "pl-3" : "pl-4"}`}>
                      <div className="min-w-0 break-words">
                        <div className="font-medium text-admin-text">{r.name || "-"}</div>
                        <div className="text-xs text-admin-textMuted">{r.nickname || "-"}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusWithNote row={r} />
                    </td>
                    <td className="px-3 py-3 text-xs text-admin-text">
                      <div className="flex min-w-0 flex-col gap-1">
                        <IconLine Icon={Store} wrap>
                          {r.restaurantName || "-"}
                        </IconLine>
                        <IconLine Icon={Tag} code>
                          <CodeCell row={r} />
                        </IconLine>
                        <IconLine Icon={Layers} wrap>
                          {sourceLabel(r) || "-"}
                        </IconLine>
                        {/* R3-1: คูปองกระดาษจากใบก่อนหน้าของวันนั้นที่ยังต้องรับคืน */}
                        {(r.pendingReturns || []).map((pr) => (
                          <div
                            key={pr.codeId}
                            data-testid="pending-return"
                            className="break-words rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200"
                          >
                            ต้องรับคูปองกระดาษคืน: {pr.code}
                            {pr.restaurantName ? ` (${pr.restaurantName})` : ""}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      {r.itemsTotal ? (
                        <div className="font-medium text-admin-text">{baht(r.itemsTotal)}</div>
                      ) : (
                        <span className="text-admin-textMuted">-</span>
                      )}
                      {r.overBudget > 0 ? (
                        <div className="text-xs font-medium text-amber-600">
                          ชำระเพิ่ม {baht(r.overBudget)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-admin-text">
                      <div className="flex min-w-0 flex-col gap-1">
                        <IconLine Icon={Clock}>
                          ส่งก่อน <span className="tabular-nums">{r.deadlineHM || "-"}</span>
                          {r.reopenCount > 0 ? (
                            <span className="ml-1 text-[10px] text-admin-textMuted">
                              (+{r.reopenCount})
                            </span>
                          ) : null}
                        </IconLine>
                        <div data-testid="handout-cell">
                          <IconLine Icon={Hand}>
                            {r.handedOutHM ? (
                              <>
                                ส่งมอบ <span className="tabular-nums">{r.handedOutHM}</span>
                              </>
                            ) : (
                              <span className="text-admin-textMuted">-</span>
                            )}
                          </IconLine>
                          {r.handedOutHM && r.handedOutBy ? (
                            <div className="break-words pl-[22px] text-admin-textMuted">
                              โดย {r.handedOutBy}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex justify-end">
                        <RowActionsCell row={r} {...actionProps} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
