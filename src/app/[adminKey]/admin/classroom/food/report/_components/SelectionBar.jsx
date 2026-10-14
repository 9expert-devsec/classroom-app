"use client";

import { Download, Printer } from "lucide-react";

export default function SelectionBar({ count, onClear, onExport, onPrint }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-3 py-2">
      <div className="text-sm font-semibold text-admin-text">เลือกแล้ว {count} รายการ</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClear}
          className="h-9 rounded-xl border border-admin-border bg-white px-3 text-xs font-medium hover:bg-admin-surfaceMuted"
        >
          ล้างที่เลือก
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-primary/40 bg-white px-3 text-xs font-medium text-brand-primary hover:bg-brand-primary/10"
        >
          <Download className="h-4 w-4" />
          Export (เฉพาะที่เลือก)
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-brand-primary/40 bg-white px-3 text-xs font-medium text-brand-primary hover:bg-brand-primary/10"
        >
          <Printer className="h-4 w-4" />
          พิมพ์ (เฉพาะที่เลือก)
        </button>
      </div>
    </div>
  );
}
