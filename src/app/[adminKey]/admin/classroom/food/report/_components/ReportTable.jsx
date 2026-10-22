"use client";

import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill, TypeBadge } from "./ReportBits";
import ItemsCell from "./ItemsCell";
import {
  FLAG_INFO,
  formatDateDMY,
  isUnchosen,
  rowId,
  rowType,
  TYPE_LABEL,
  shopText,
  stageNoteOf,
  statusKeyOf,
  statusTimeOf,
  typeKeyOf,
  PAST_DAY_EDIT_MESSAGE,
} from "./reportUi";

const TH = "px-3 py-2.5 text-left text-[11px] font-medium text-admin-textMuted";
// ชิดบน: ช่องรายการอาหารเรียงซ้อนสูงได้หลายบรรทัด (r2e) — ชิดกลางแล้วแถวดูเหลื่อม
// R4-4: ข้อความยาวขึ้นบรรทัดใหม่ในช่องของตัวเอง ไม่ล้นไปช่องถัดไป
const TD = "px-3 py-2.5 align-top break-words";

/**
 * R4-4: คอลัมน์ของตารางรายละเอียด — กำหนดที่เดียว ทุกตาราง (ทุกวัน ทุกคลาส ทุกแท็บ) วาดจากชุดนี้
 * table-fixed + colgroup ชุดเดียวกัน -> ตำแหน่งคอลัมน์ตรงกันทุกตาราง
 *   px = กว้างคงที่ (พอดีเนื้อหาที่กว้างที่สุดตามปกติ) · % = ส่วนที่ยืดหยุ่น · null = ส่วนที่เหลือทั้งหมด
 *   date มีเฉพาะตารางที่ไม่ได้อยู่ใต้หัวข้อวัน (แท็บตามร้าน / ตามประเภท)
 */
export const REPORT_COLUMNS = [
  { key: "select", header: "", width: "40px" },
  { key: "num", header: "#", width: "44px" },
  { key: "date", header: "วันที่", width: "96px", dateOnly: true },
  { key: "student", header: "ผู้เรียน", width: "18%" },
  { key: "shop", header: "ร้าน", width: "14%" },
  // "E-coupon" / "ยังไม่เลือก / ไม่มีข้อมูล" chip
  { key: "type", header: "ประเภท", width: "112px" },
  // รหัส CASA เต็ม (ตัวอักษรกว้างเท่ากัน 11px) / 9XP-XXXX
  { key: "code", header: "รหัสคูปอง", width: "184px" },
  // chip "ตัดสิทธิ์ (หมดเวลา 15:00)" + ป้ายข้อสังเกต
  { key: "status", header: "สถานะ", width: "200px" },
  { key: "time", header: "เวลา", width: "64px" },
  { key: "items", header: "รายการอาหาร / ชุด", width: null },
  { key: "actions", header: "จัดการ", width: "64px", center: true },
];
// ความกว้างขั้นต่ำของตาราง (จอแคบกว่านี้เลื่อนแนวนอน — ทุกตารางกว้างเท่ากันจึงยังตรงกัน)
const TABLE_MIN_WIDTH = "min-w-[1100px]";

/**
 * Detail table (one row per learner per day). Selection lives in the parent so it
 * survives paging / tab switches; the header checkbox toggles the rows shown here.
 */
// numberOf(o) = เลข "#" ของแถว (การ์ดตาม Class นับใหม่ในการ์ด) — ไม่ส่งมา = startIndex + ลำดับ เหมือนเดิม
// selectAllLabel = aria-label ของ checkbox หัวตาราง (ค่าเดิม "เลือกทั้งหมดในหน้านี้")
export default function ReportTable({
  rows,
  startIndex = 0,
  selectedIds,
  onToggle,
  onToggleMany,
  onEdit,
  // R4-1A: แก้อาหารได้เฉพาะแถวของวันนี้ (วันอื่นปิดปุ่ม + บอกเหตุผล)
  todayYMD = "",
  empty,
  numberOf,
  selectAllLabel = "เลือกทั้งหมดในหน้านี้",
  // R4-2: ตารางที่อยู่ใต้หัวกลุ่มวัน (รายละเอียดรายการ) ไม่ต้องมีคอลัมน์วันที่
  showDate = true,
}) {
  const columns = REPORT_COLUMNS.filter((c) => showDate || !c.dateOnly);
  const cols = columns.length;
  const ids = rows.map(rowId);
  const allChecked = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const someChecked = !allChecked && ids.some((id) => selectedIds.has(id));

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-admin-border">
      <table className={`w-full table-fixed ${TABLE_MIN_WIDTH} text-xs`}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead className="bg-admin-surfaceMuted">
          <tr>
            <th className={TH}>
              <input
                type="checkbox"
                aria-label={selectAllLabel}
                className="h-4 w-4"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                disabled={!ids.length}
                onChange={() => onToggleMany(ids, !allChecked)}
              />
            </th>
            {columns
              .filter((c) => c.key !== "select")
              .map((c) => (
                <th key={c.key} className={c.center ? `${TH} text-center` : TH}>
                  {c.header}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-3 py-10 text-center text-sm text-admin-textMuted">
                {empty || "ไม่มีรายการ"}
              </td>
            </tr>
          )}
          {rows.map((o, idx) => {
            const id = rowId(o);
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
                <td className={`${TD} text-admin-textMuted`}>
                  {numberOf ? numberOf(o) : startIndex + idx + 1}
                </td>
                {showDate ? <td className={`${TD} whitespace-nowrap`}>{formatDateDMY(o.dayYMD)}</td> : null}
                <td className={TD}>
                  <div className="font-medium text-admin-text">{o.studentName || "-"}</div>
                  {o.company && <div className="text-[11px] text-admin-textMuted">{o.company}</div>}
                </td>
                <td className={TD}>{shop}</td>
                <td className={TD}>
                  <TypeBadge type={typeKeyOf(o)} label={isUnchosen(o) ? TYPE_LABEL[rowType(o)] : ""} />
                </td>
                <td className={`${TD} break-all font-mono`}>{o.code || "-"}</td>
                <td className={TD}>
                  <StatusPill status={statusKeyOf(o)} />
                  {/* R2b: ใบที่ยกเลิกแล้วแต่คูปองกระดาษยังไม่คืน (ตรงกับ couponCodeState) */}
                  {stageNoteOf(o) ? (
                    <div className="mt-1 text-[11px] font-medium text-amber-700">{stageNoteOf(o)}</div>
                  ) : null}
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
                <td className={TD}>
                  {/* เรียงซ้อน: รายการ / ตัวเลือกต่อกลุ่ม / หมายเหตุของแต่ละรายการ, หมายเหตุของแถวท้ายสุด */}
                  <ItemsCell row={o} />
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
                      {o.dayYMD === todayYMD ? (
                        <DropdownMenuItem
                          onSelect={() => onEdit(o)}
                          className="cursor-pointer px-3 py-2 text-xs focus:bg-admin-surfaceMuted"
                        >
                          แก้ไขอาหาร
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled
                          title={PAST_DAY_EDIT_MESSAGE}
                          className="flex flex-col items-start gap-0.5 px-3 py-2 text-xs opacity-60"
                        >
                          <span>แก้ไขอาหาร</span>
                          <span className="text-[11px] text-admin-textMuted">{PAST_DAY_EDIT_MESSAGE}</span>
                        </DropdownMenuItem>
                      )}
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
