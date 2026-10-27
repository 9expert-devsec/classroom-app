"use client";

import { CollapsibleCard, TypeBadge } from "./ReportBits";
import { COUPON_FILTER_STATUSES, NO_SHOP_KEY } from "./reportUi";

const TH = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium text-admin-textMuted";
const TD = "whitespace-nowrap px-3 py-2";

// R6-1a: คอลัมน์ = Set · 6 สถานะคูปอง (เดียวกับป้ายแถว / ตัวกรอง) · ไม่รับอาหาร — รวมกันเท่ากับ "ทั้งหมด"
const COLUMNS = [
  { key: "set", label: "Set", count: (c) => c.byType.set },
  ...Object.entries(COUPON_FILTER_STATUSES).map(([k, label]) => ({ key: k, label, count: (c) => c.byCoupon[k] })),
  { key: "none", label: "ไม่รับอาหาร", count: (c) => c.byType.none },
];

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
                {COLUMNS.map((col) => (
                  <th key={col.key} className={TH}>
                    {col.label}
                  </th>
                ))}
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
                  {COLUMNS.map((col) => (
                    <td key={col.key} className={TD}>
                      {col.count(s.counts)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleCard>
  );
}
