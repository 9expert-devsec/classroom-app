"use client";

import { CollapsibleCard, TypeBadge } from "./ReportBits";
import ReportTable from "./ReportTable";
import { countsLineOf } from "./reportUi";

// R6-1a: Set · 6 สถานะคูปอง · ไม่รับอาหาร (เดียวกับป้ายแถว / KPI / สรุปร้าน)
const countsLine = countsLineOf;

/**
 * One collapsible section per group (shop or type), each with its rows in the detail-table format.
 * @param groups [{ key, title, types: string[], counts, rows, action? }]
 * @param focusKey group that starts open (e.g. the shop picked in สรุปตามร้านค้า); idPrefix + key = section id
 */
export default function GroupSections({ groups, tableProps, empty, idPrefix, focusKey }) {
  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-admin-border bg-white py-10 text-center text-sm text-admin-textMuted">
        {empty}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <CollapsibleCard
          key={g.key}
          id={idPrefix ? `${idPrefix}${g.key}` : undefined}
          defaultOpen={groups.length === 1 || g.key === focusKey}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span>{g.title}</span>
              {g.types.map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
              <span className="text-xs font-normal text-admin-textMuted">ทั้งหมด {g.counts.total} รายการ</span>
            </span>
          }
          collapsedHint={<span className="text-xs text-admin-textMuted">{countsLine(g.counts)}</span>}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-admin-textMuted">{countsLine(g.counts)}</div>
            {g.action}
          </div>
          <ReportTable rows={g.rows} {...tableProps} />
        </CollapsibleCard>
      ))}
    </div>
  );
}
