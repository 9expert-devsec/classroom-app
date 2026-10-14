"use client";

import { useState } from "react";
import { ChevronDown, LayoutGrid, ListChecks, PieChart, Store } from "lucide-react";

import { STATUS_META, TYPE_META, cx } from "./reportUi";

export function TypeBadge({ type }) {
  const m = TYPE_META[type];
  if (!m) return null;
  return (
    <span
      title={m.hint}
      className={cx("inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", m.cls)}
    >
      {m.label}
    </span>
  );
}

export function StatusPill({ status }) {
  const m = STATUS_META[status];
  if (!m) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        m.cls,
      )}
    >
      {m.icon && <span aria-hidden>{m.icon}</span>}
      {m.label}
    </span>
  );
}

/** card with a header that collapses its body */
export function CollapsibleCard({ id, title, right, collapsedHint, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-admin-border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-admin-text">{title}</div>
          {!open && collapsedHint && (
            <div className="mt-1 truncate text-sm text-admin-text">{collapsedHint}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-admin-textMuted">
          {right}
          <ChevronDown className={cx("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && <div className="min-w-0 px-4 pb-4">{children}</div>}
    </section>
  );
}

const TAB_ITEMS = [
  ["overview", "ภาพรวม", PieChart],
  ["shops", "ตามร้านค้า", Store],
  ["types", "ตามประเภท", LayoutGrid],
  ["list", "รายการทั้งหมด", ListChecks],
];

export function ReportTabs({ tab, onTab }) {
  return (
    <div
      role="tablist"
      className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-admin-border bg-white p-1"
    >
      {TAB_ITEMS.map(([key, label, Icon]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={tab === key}
          onClick={() => onTab(key)}
          className={cx(
            "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm",
            tab === key
              ? "bg-brand-primary/10 font-semibold text-brand-primary"
              : "text-admin-textMuted hover:bg-admin-surfaceMuted",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
