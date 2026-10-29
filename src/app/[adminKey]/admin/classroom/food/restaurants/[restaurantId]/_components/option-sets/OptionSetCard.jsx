"use client";

import { useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { choicePreview, setChips } from "./optionSetUi";

/** ⋮ menu — same trigger/content look as MenuActions */
function OptionSetActions({ set, onEdit, onAttach, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`จัดการชุด ${set.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-admin-textMuted hover:bg-admin-surfaceMuted"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-36 rounded-xl bg-white py-1 text-xs shadow-lg ring-1 ring-black/5"
      >
        <DropdownMenuItem onSelect={() => onEdit(set)}>แก้ไขชุด</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAttach(set)}>ใช้กับเมนู…</DropdownMenuItem>
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={() => onDelete(set)}>
          ลบชุด
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function OptionSetCard({ set, highlight, onEdit, onAttach, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);

  const n = set.menuCount || 0;
  const m = set.overrideCount || 0;

  return (
    <div
      ref={ref}
      className={`flex h-full min-w-0 flex-col rounded-2xl border bg-white transition hover:border-brand-primary hover:shadow-sm ${
        highlight ? "border-green-400 ring-2 ring-green-400" : "border-admin-border"
      }`}
    >
      {/* body: opens the edit form */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(set)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(set);
          }
        }}
        className="flex flex-1 cursor-pointer flex-col gap-1.5 rounded-t-2xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
      >
        <div className="line-clamp-2 break-words text-sm font-semibold text-admin-text" title={set.name}>
          {set.name}
        </div>
        <div className="flex flex-wrap gap-1">
          {setChips(set).map((chip) => (
            <span
              key={chip}
              className="rounded-md bg-brand-primary/15 px-2 py-0.5 text-[11px] font-medium text-brand-primaryDark"
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="truncate text-xs text-admin-textMuted" title={choicePreview(set, 99)}>
          {choicePreview(set)}
        </div>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between gap-2 border-t border-admin-border px-3 py-2">
        <span className={`min-w-0 truncate text-xs ${n ? "text-admin-text" : "text-admin-textMuted"}`}>
          {n ? `ใช้ใน ${n} เมนู${m > 0 ? ` · ${m} ปรับราคาเอง` : ""}` : "ยังไม่ได้ใช้กับเมนูไหน"}
        </span>
        <OptionSetActions set={set} onEdit={onEdit} onAttach={onAttach} onDelete={onDelete} />
      </div>
    </div>
  );
}
