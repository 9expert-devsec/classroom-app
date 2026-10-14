"use client";

import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill, TypeBadge } from "./ReportBits";
import {
  FLAG_INFO,
  formatDateDMY,
  itemsText,
  rowId,
  shopText,
  statusKeyOf,
  statusTimeOf,
  typeKeyOf,
} from "./reportUi";

const TH = "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-medium text-admin-textMuted";
const TD = "px-3 py-2.5 align-middle";

/**
 * Detail table (one row per learner per day). Selection lives in the parent so it
 * survives paging / tab switches; the header checkbox toggles the rows shown here.
 */
export default function ReportTable({ rows, startIndex = 0, selectedIds, onToggle, onToggleMany, onEdit, empty }) {
  const ids = rows.map(rowId);
  const allChecked = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someChecked = !allChecked && ids.some((id) => selectedIds.has(id));

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-admin-border">
      <table className="w-full min-w-[1100px] text-xs">
        <thead className="bg-admin-surfaceMuted">
          <tr>
            <th className={`${TH} w-10`}>
              <input
                type="checkbox"
                aria-label="เลือกทั้งหมดในหน้านี้"
                className="h-4 w-4"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                disabled={!ids.length}
                onChange={() => onToggleMany(ids, !allChecked)}
              />
            </th>
            <th className={`${TH} w-10`}>#</th>
            <th className={TH}>วันที่</th>
            <th className={TH}>ผู้เรียน</th>
            <th className={TH}>ร้าน</th>
            <th className={TH}>ประเภท</th>
            <th className={TH}>รหัสคูปอง</th>
            <th className={TH}>สถานะ</th>
            <th className={TH}>เวลา</th>
            <th className={TH}>รายการอาหาร / ชุด</th>
            <th className={`${TH} w-14 text-center`}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-3 py-10 text-center text-sm text-admin-textMuted">
                {empty || "ไม่มีรายการ"}
              </td>
            </tr>
          )}
          {rows.map((o, idx) => {
            const id = rowId(o);
            const items = itemsText(o);
            const note = String(o.note ?? o.food?.note ?? "").trim();
            const itemsFull = [items === "-" ? "" : items, note ? `หมายเหตุ: ${note}` : ""]
              .filter(Boolean)
              .join(" · ");
            const flags = Array.isArray(o.flags) ? o.flags : [];
            const shop = shopText(o);
            return (
              <tr key={id} className="border-t border-admin-border hover:bg-admin-surfaceMuted/40">
                <td className={TD}>
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${o.studentName || ""}`}
                    className="h-4 w-4"
                    checked={selectedIds.has(id)}
                    onChange={() => onToggle(id)}
                  />
                </td>
                <td className={`${TD} text-admin-textMuted`}>{startIndex + idx + 1}</td>
                <td className={`${TD} whitespace-nowrap`}>{formatDateDMY(o.dayYMD)}</td>
                <td className={`${TD} max-w-[200px]`}>
                  <div className="truncate font-medium text-admin-text" title={o.studentName}>
                    {o.studentName || "-"}
                  </div>
                  {o.company && (
                    <div className="truncate text-[11px] text-admin-textMuted" title={o.company}>
                      {o.company}
                    </div>
                  )}
                </td>
                <td className={`${TD} max-w-[180px]`}>
                  <div className="truncate" title={shop}>
                    {shop}
                  </div>
                </td>
                <td className={TD}>
                  <TypeBadge type={typeKeyOf(o)} />
                </td>
                <td className={`${TD} whitespace-nowrap font-mono`}>{o.code || "-"}</td>
                <td className={TD}>
                  <StatusPill status={statusKeyOf(o)} />
                  {flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <span
                          key={f}
                          title={FLAG_INFO[f]?.tip || f}
                          className="whitespace-nowrap rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200"
                        >
                          ⚠ {FLAG_INFO[f]?.label || f}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>{statusTimeOf(o) || "-"}</td>
                <td className={`${TD} min-w-[200px] max-w-[320px]`}>
                  <div className="line-clamp-2" title={itemsFull || undefined}>
                    {itemsFull || "-"}
                  </div>
                </td>
                <td className={`${TD} text-center`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="จัดการ"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-admin-surfaceMuted"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={6}
                      className="w-40 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
                    >
                      <DropdownMenuItem
                        onSelect={() => onEdit(o)}
                        className="cursor-pointer px-3 py-2 text-xs focus:bg-admin-surfaceMuted"
                      >
                        แก้ไขอาหาร
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
