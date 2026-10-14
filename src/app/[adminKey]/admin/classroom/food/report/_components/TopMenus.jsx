"use client";

import { CollapsibleCard } from "./ReportBits";

/** @param items [{ label, count }] sorted desc — "ร้าน — เมนู" of set rows */
export default function TopMenus({ items }) {
  const top = items.slice(0, 5);
  const first = top[0];
  return (
    <CollapsibleCard
      title="Top เมนู (เฉพาะ Set)"
      defaultOpen={false}
      collapsedHint={first ? first.label : "ไม่มีข้อมูล"}
      right={first ? <span className="font-semibold text-admin-text">{first.count}</span> : null}
    >
      {top.length === 0 ? (
        <div className="py-2 text-sm text-admin-textMuted">ไม่มีข้อมูล</div>
      ) : (
        <ol className="divide-y divide-admin-border">
          {top.map((x, i) => (
            <li key={x.label} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-admin-textMuted">{i + 1}.</span>
                {x.label}
              </span>
              <span className="shrink-0 font-semibold">{x.count}</span>
            </li>
          ))}
        </ol>
      )}
    </CollapsibleCard>
  );
}
