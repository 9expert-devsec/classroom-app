"use client";

import { CollapsibleCard, TypeBadge } from "./ReportBits";
import ReportTable from "./ReportTable";
import { MAPPED_STATUSES, STATUS_META } from "./reportUi";

function countsLine(c) {
  return Object.entries(c.byStatus)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => {
      const ia = MAPPED_STATUSES.indexOf(a);
      const ib = MAPPED_STATUSES.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([k, n]) => `${STATUS_META[k].label} ${n}`)
    .join(" · ");
}

/**
 * One collapsible section per group (shop or type), each with its rows in the detail-table format.
 * @param groups [{ key, title, types: string[], counts, rows, action? }]
 */
export default function GroupSections({ groups, tableProps, empty }) {
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
          defaultOpen={groups.length === 1}
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
