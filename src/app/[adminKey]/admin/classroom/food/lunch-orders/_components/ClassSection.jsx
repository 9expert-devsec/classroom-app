"use client";

// การ์ดต่อคลาส (พับได้) + ตารางผู้เรียนของคลาสนั้น
import { ChevronDown, Clock, GraduationCap, Hand, Layers, Store, Tag, Users } from "lucide-react";

import { ActionButtons, Avatar, CodeCell, StatusPill, baht, sourceLabel } from "./lunchOrdersUi";

function IconLine({ Icon, children }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-admin-textMuted" />
      <div className="min-w-0 truncate">{children}</div>
    </div>
  );
}

const TH = "px-3 py-2.5 text-left text-xs font-medium text-admin-textMuted";

export default function ClassSection({
  group,
  open,
  onToggle,
  selectedId,
  onSelect,
  actionProps,
}) {
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
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-admin-surfaceMuted/60">
              <tr>
                <th className={`${TH} pl-4`}>ผู้เรียน</th>
                <th className={TH}>สถานะ</th>
                <th className={TH}>รายละเอียดออเดอร์</th>
                <th className={TH}>ยอดเงิน</th>
                <th className={TH}>เวลา</th>
                <th className={`${TH} pr-4 text-center`}>จัดการ</th>
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
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-admin-text">{r.name || "-"}</div>
                          <div className="truncate text-xs text-admin-textMuted">
                            {r.nickname || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-xs text-admin-text">
                      <div className="flex flex-col gap-1">
                        <IconLine Icon={Store}>{r.restaurantName || "-"}</IconLine>
                        <IconLine Icon={Tag}>
                          <CodeCell row={r} />
                        </IconLine>
                        <IconLine Icon={Layers}>{sourceLabel(r) || "-"}</IconLine>
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
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-admin-text">
                      <div className="flex flex-col gap-1">
                        <IconLine Icon={Clock}>
                          เส้นตาย <span className="tabular-nums">{r.deadlineHM || "-"}</span>
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
                            <div className="pl-[22px] text-admin-textMuted">โดย {r.handedOutBy}</div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex justify-center">
                        <ActionButtons row={r} {...actionProps} />
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
