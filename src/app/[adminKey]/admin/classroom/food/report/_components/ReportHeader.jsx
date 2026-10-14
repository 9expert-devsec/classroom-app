"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, Download, Printer } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_RANGE_DAYS, addDaysYMD, formatDateDMY, isYMD, rangeDays } from "./reportUi";

const MENU_CONTENT = "min-w-56 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5";
const MENU_ITEM = "cursor-pointer px-3 py-2 text-xs focus:bg-admin-surfaceMuted";
const SELECT =
  "h-10 rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-primary";

function DateRangePicker({ from, to, todayYMD, onChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });

  const invalid =
    !isYMD(draft.from) ||
    !isYMD(draft.to) ||
    draft.from > draft.to ||
    rangeDays(draft.from, draft.to).length > MAX_RANGE_DAYS;

  const presets = [
    ["วันนี้", todayYMD, todayYMD],
    ["เมื่อวาน", addDaysYMD(todayYMD, -1), addDaysYMD(todayYMD, -1)],
    ["7 วันล่าสุด", addDaysYMD(todayYMD, -6), todayYMD],
    ["30 วันล่าสุด", addDaysYMD(todayYMD, -29), todayYMD],
  ];

  function apply(f, t) {
    onChange(f, t);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ from, to });
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 min-w-0 items-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text shadow-sm hover:bg-admin-surfaceMuted"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-admin-textMuted" />
          <span className="truncate">
            {formatDateDMY(from)} - {formatDateDMY(to)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-admin-textMuted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-3">
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([label, f, t]) => (
            <button
              key={label}
              type="button"
              onClick={() => apply(f, t)}
              className="rounded-full border border-admin-border px-2.5 py-1 text-[11px] hover:bg-admin-surfaceMuted"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["from", "ตั้งแต่"],
            ["to", "ถึง"],
          ].map(([key, label]) => (
            <label key={key} className="block text-[11px] text-admin-textMuted">
              {label}
              <input
                type="date"
                lang="en-GB"
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-admin-border bg-white px-2 py-1.5 text-xs text-admin-text"
              />
            </label>
          ))}
        </div>
        {invalid && (
          <div className="mt-2 text-[11px] text-red-600">
            เลือกช่วงวันที่ให้ถูกต้อง (ไม่เกิน {MAX_RANGE_DAYS} วัน)
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={invalid}
            onClick={() => apply(draft.from, draft.to)}
            className="rounded-xl bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            ใช้ช่วงวันที่นี้
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReportHeader({ params, setParams, shopOptions, todayYMD }) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-admin-text">Food Report</h1>
        <p className="mt-0.5 text-sm text-admin-textMuted">
          รายงานการใช้งานชุดอาหาร, คูปองอาหาร และการสั่งอาหารของผู้เรียน
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="flex min-w-0 items-center gap-2 text-sm text-admin-textMuted">
          <span className="shrink-0">ร้านค้า</span>
          <select
            className={`${SELECT} min-w-0 max-w-[14rem]`}
            value={params.shop}
            onChange={(e) => setParams({ shop: e.target.value })}
          >
            <option value="">ทั้งหมด</option>
            {shopOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <DateRangePicker
          from={params.from}
          to={params.to}
          todayYMD={todayYMD}
          onChange={(from, to) => setParams({ from, to, day: "" })}
        />
      </div>
    </div>
  );
}

export function ReportActions({ printItems, exportItems }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15"
          >
            <Printer className="h-4 w-4" />
            พิมพ์
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className={MENU_CONTENT}>
          {printItems.map((it) => (
            <DropdownMenuItem
              key={it.label}
              disabled={it.disabled}
              onSelect={it.onSelect}
              className={MENU_ITEM}
            >
              {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className={MENU_CONTENT}>
          {exportItems.map((it) => (
            <DropdownMenuItem
              key={it.label}
              disabled={it.disabled}
              onSelect={it.onSelect}
              className={MENU_ITEM}
            >
              {it.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
