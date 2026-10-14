"use client";

import { CollapsibleCard, TypeBadge } from "./ReportBits";
import { MAPPED_STATUSES, NO_SHOP_KEY, STATUS_META } from "./reportUi";

const TH = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium text-admin-textMuted";
const TD = "whitespace-nowrap px-3 py-2";

// rows whose status keeps its own label (ยังไม่ใช้ / ยังไม่สั่ง / ตัดสิทธิ์ / ไม่มีออเดอร์ / ไม่รับอาหาร)
function otherCount(c) {
  return c.total - MAPPED_STATUSES.reduce((n, k) => n + c.byStatus[k], 0);
}

function otherTitle(c) {
  return Object.entries(c.byStatus)
    .filter(([k, n]) => n > 0 && !STATUS_META[k].mapped)
    .map(([k, n]) => `${STATUS_META[k].label} ${n}`)
    .join(" · ");
}

/** @param shops [{ key, name, types: string[], counts, extras? }] */
export default function ShopSummary({ shops, onPick }) {
  return (
    <CollapsibleCard title="สรุปตามร้านค้า">
      {shops.length === 0 ? (
        <div className="py-6 text-center text-sm text-admin-textMuted">ไม่มีข้อมูลในช่วงที่เลือก</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-admin-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-admin-surfaceMuted">
              <tr>
                <th className={TH}>ร้านค้า</th>
                <th className={TH}>ประเภท</th>
                <th className={TH}>ทั้งหมด</th>
                {MAPPED_STATUSES.map((k) => (
                  <th key={k} className={TH}>
                    {STATUS_META[k].label}
                  </th>
                ))}
                <th className={TH} title="สถานะอื่นที่ใช้ชื่อเดิม">
                  อื่น ๆ
                </th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr
                  key={s.key}
                  onClick={() => onPick(s.key)}
                  title="ดูรายการของร้านนี้"
                  className="cursor-pointer border-t border-admin-border hover:bg-admin-surfaceMuted/60"
                >
                  <td className="px-3 py-2">
                    <div className={s.key === NO_SHOP_KEY ? "text-admin-textMuted" : "text-admin-text"}>
                      {s.name}
                    </div>
                    {s.extras && <div className="text-[11px] text-admin-textMuted">{s.extras}</div>}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {s.types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                  </td>
                  <td className={`${TD} font-semibold`}>{s.counts.total}</td>
                  {MAPPED_STATUSES.map((k) => (
                    <td key={k} className={TD}>
                      {s.counts.byStatus[k]}
                    </td>
                  ))}
                  <td className={`${TD} text-admin-textMuted`} title={otherTitle(s.counts)}>
                    {otherCount(s.counts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleCard>
  );
}
