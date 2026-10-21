"use client";

import { Filter, Search } from "lucide-react";

import { STATUS_META, TYPE_META } from "./reportUi";

const SELECT =
  "mt-1 h-10 w-full rounded-xl border border-admin-border bg-white px-3 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-brand-primary";

export const STATUS_FILTER_ORDER = [
  "used",
  "received",
  "awaiting",
  "expired",
  "set",
  "unused",
  "pending",
  "forfeited",
  "no_order",
  "none",
  // R4-2
  "not_chosen",
  "no_data",
];

/** detail-table filters: class / type / status / search — URL params; the date range is the page's own filter */
export default function ReportFilters({ params, setParams, classOptions }) {
  const active = params.cls || params.type || params.status || params.q;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)_auto] lg:items-end">
      <label className="block min-w-0 text-[11px] text-admin-textMuted">
        Class
        <select className={SELECT} value={params.cls} onChange={(e) => setParams({ class: e.target.value })}>
          <option value="">ทุก Class</option>
          {classOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-0 text-[11px] text-admin-textMuted">
        ประเภท
        <select className={SELECT} value={params.type} onChange={(e) => setParams({ type: e.target.value })}>
          <option value="">ทั้งหมด</option>
          {Object.entries(TYPE_META).map(([k, m]) => (
            <option key={k} value={k}>
              {m.hint ? `${m.label} (${m.hint})` : m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block min-w-0 text-[11px] text-admin-textMuted">
        สถานะคูปอง
        <select className={SELECT} value={params.status} onChange={(e) => setParams({ status: e.target.value })}>
          <option value="">ทั้งหมด</option>
          {STATUS_FILTER_ORDER.map((k) => (
            <option key={k} value={k}>
              {STATUS_META[k].label}
            </option>
          ))}
          <option value="flagged">มีข้อสังเกต</option>
        </select>
      </label>

      <label className="relative block min-w-0 text-[11px] text-admin-textMuted sm:col-span-2 lg:col-span-1">
        <span className="sr-only">ค้นหา</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          className="h-10 w-full rounded-xl border border-admin-border bg-white pl-9 pr-3 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="ค้นหาชื่อผู้เรียน, ร้าน, เมนู, รหัสคูปอง..."
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
      </label>

      <button
        type="button"
        disabled={!active}
        onClick={() => setParams({ class: "", type: "", status: "", q: "" })}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-brand-primary/30 px-4 text-sm font-semibold text-brand-primary hover:bg-brand-primary/10 disabled:opacity-40"
      >
        <Filter className="h-4 w-4" />
        ล้างตัวกรอง
      </button>
    </div>
  );
}
