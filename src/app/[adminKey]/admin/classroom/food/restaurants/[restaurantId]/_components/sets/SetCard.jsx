"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, Eye, Pencil, Trash2 } from "lucide-react";
import { MenuImage } from "../MenuBits";
import { SetAvatar } from "./setUi";

const PREVIEW = 4;

export default function SetCard({ set, items, highlight, onView, onEdit, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);

  const more = items.length - PREVIEW;

  return (
    <div
      ref={ref}
      className={`flex h-full min-w-0 flex-col rounded-2xl border bg-white transition hover:border-brand-primary hover:shadow-sm ${
        highlight ? "border-green-400 ring-2 ring-green-400" : "border-admin-border"
      }`}
    >
      {/* header */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <SetAvatar name={set.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-admin-text" title={set.name}>
            {set.name}
          </div>
          <div className="text-xs text-admin-textMuted">รวม {items.length} เมนู</div>
        </div>
        <div className="flex flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(set)}
            aria-label={`แก้ไข ${set.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-primaryDark hover:bg-brand-primary/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(set)}
            aria-label={`ลบ ${set.name}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* body: opens the detail view */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onView(set)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView(set);
          }
        }}
        className="flex-1 cursor-pointer space-y-1.5 px-3 pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
      >
        {items.slice(0, PREVIEW).map((m) => {
          const off = m.isActive === false;
          return (
            <div key={String(m._id)} className={`flex items-center gap-2 ${off ? "text-admin-textMuted" : ""}`}>
              <MenuImage menu={m} sizes="28px" className={`h-7 w-7 flex-shrink-0 ${off ? "opacity-50 grayscale" : ""}`} />
              <CircleCheck className={`h-4 w-4 flex-shrink-0 ${off ? "text-slate-400" : "text-green-600"}`} />
              <span className="min-w-0 flex-1 truncate text-sm" title={m.name}>
                {m.name}
              </span>
              {off && (
                <span className="flex-shrink-0 rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">ปิดใช้งาน</span>
              )}
            </div>
          );
        })}
        {items.length === 0 && <p className="text-sm text-admin-textMuted">ยังไม่มีเมนูในชุดนี้</p>}
        {more > 0 && <div className="pl-[3.75rem] text-xs font-medium text-brand-primaryDark">+ อีก {more} เมนู</div>}
      </div>

      {/* footer */}
      <div className="border-t border-admin-border p-2">
        <button
          type="button"
          onClick={() => onView(set)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
        >
          <Eye className="h-4 w-4" /> ดูเมนูทั้งหมด
        </button>
      </div>
    </div>
  );
}
