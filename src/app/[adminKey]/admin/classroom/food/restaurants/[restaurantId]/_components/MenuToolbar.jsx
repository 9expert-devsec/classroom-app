"use client";

import { useEffect, useRef } from "react";
import { LayoutGrid, List, Search, Settings2 } from "lucide-react";

function LabeledSelect({ label, value, onChange, children, className = "" }) {
  return (
    <label
      className={`flex items-center gap-2 rounded-xl border border-admin-border bg-white pl-3 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 ${className}`}
    >
      <span className="flex-shrink-0 text-xs text-admin-textMuted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer rounded-xl bg-transparent py-2 pr-2 text-sm text-admin-text outline-none"
      >
        {children}
      </select>
    </label>
  );
}

export default function MenuToolbar({
  params,
  setParams,
  categories,
  searchResetKey,
  onManageCategories,
}) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // the input is uncontrolled; the URL is the only source of truth for q
  function onSearch(value) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParams({ q: value.trim() }), 300);
  }

  const hasCategories = categories.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-[2_1_260px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-textMuted" />
        <input
          key={searchResetKey}
          defaultValue={params.q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="ค้นหาเมนู ชื่อเมนู, หมวดหมู่..."
          className="w-full rounded-xl border border-admin-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      <div className="flex min-w-0 flex-[1_1_220px] items-center gap-2">
        {hasCategories && (
          <LabeledSelect
            label="หมวดหมู่"
            value={params.cat}
            onChange={(v) => setParams({ cat: v })}
            className="min-w-0 flex-1"
          >
            <option value="">ทั้งหมด</option>
            {categories.map((c) => (
              <option key={String(c._id)} value={String(c._id)}>
                {c.name}
                {c.isActive === false ? " (ปิดใช้งาน)" : ""}
              </option>
            ))}
            <option value="__none__">ไม่มีหมวดหมู่</option>
          </LabeledSelect>
        )}
        <button
          type="button"
          onClick={onManageCategories}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-brand-primary/60 bg-white px-3 py-2 text-sm text-brand-primaryDark hover:bg-brand-primary/10"
        >
          <Settings2 className="h-4 w-4" />
          จัดการหมวดหมู่
        </button>
      </div>

      <LabeledSelect
        label="สถานะ"
        value={params.status}
        onChange={(v) => setParams({ status: v })}
        className="min-w-0 flex-[1_1_160px]"
      >
        <option value="">ทั้งหมด</option>
        <option value="active">เปิดใช้งาน</option>
        <option value="inactive">ปิดใช้งาน</option>
      </LabeledSelect>

      <LabeledSelect
        label="เรียงตาม"
        value={params.sort}
        onChange={(v) => setParams({ sort: v === "order" ? "" : v })}
        className="min-w-0 flex-[1_1_200px]"
      >
        <option value="order">ลำดับการแสดงผล</option>
        <option value="name">ชื่อ</option>
        <option value="price">ราคา</option>
      </LabeledSelect>

      <div className="flex flex-shrink-0 overflow-hidden rounded-xl border border-admin-border bg-white">
        {[
          ["grid", LayoutGrid, "มุมมองการ์ด"],
          ["list", List, "มุมมองตาราง"],
        ].map(([v, Icon, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setParams({ view: v === "grid" ? "" : v, page: params.page })}
            aria-label={label}
            aria-pressed={params.view === v}
            className={`inline-flex h-9 w-10 items-center justify-center ${
              params.view === v
                ? "bg-brand-primaryDark text-white"
                : "text-admin-textMuted hover:bg-admin-surfaceMuted"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
