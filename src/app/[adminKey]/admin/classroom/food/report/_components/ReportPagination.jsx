"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { PAGE_SIZES } from "./reportUi";

// 1 … 4 5 6 … 12
function pageList(page, totalPages) {
  const pages = [...new Set([1, totalPages, page - 1, page, page + 1])]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export default function ReportPagination({ page, totalPages, size, total, onPage, onSize }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-admin-textMuted">
        <label className="flex items-center gap-2">
          แสดง
          <select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="h-9 rounded-lg border border-admin-border bg-white px-2 text-xs text-admin-text"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          รายการ
        </label>
        <span>จากทั้งหมด {total} รายการ</span>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="หน้าก่อนหน้า"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageList(page, totalPages).map((p) =>
            typeof p === "string" ? (
              <span key={p} className="px-1 text-admin-textMuted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-lg px-2 ${
                  p === page
                    ? "bg-brand-primary font-semibold text-white"
                    : "border border-admin-border bg-white hover:bg-admin-surfaceMuted"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="หน้าถัดไป"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
