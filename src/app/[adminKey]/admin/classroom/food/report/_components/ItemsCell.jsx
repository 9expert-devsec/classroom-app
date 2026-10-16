"use client";

// src/app/[adminKey]/admin/classroom/food/report/_components/ItemsCell.jsx
//
// ช่อง "รายการอาหาร / ชุด" แบบเรียงซ้อน (r2e) — 1 บล็อกต่อรายการ, เส้นคั่นบาง ๆ ระหว่างบล็อก
// (เหมือนใบสั่งร้าน) และหมายเหตุของแถวแยกเป็นบรรทัดสุดท้ายหลังเส้นคั่น
import { itemsCellModel } from "./itemsCellModel";

export default function ItemsCell({ row }) {
  const { blocks, trailingNote } = itemsCellModel(row);
  if (!blocks.length && !trailingNote) return <span>-</span>;

  return (
    <div className="divide-y divide-admin-border" data-testid="items-cell">
      {blocks.map((b, i) => (
        <div key={i} className="py-1 first:pt-0 last:pb-0">
          <div className="text-[13px] text-admin-text">
            {b.qty ? <span className="font-semibold">{b.qty}× </span> : null}
            <span className="font-medium">{b.title}</span>
          </div>
          {b.subs.map((s, k) => (
            <div key={k} className="pl-3 text-xs text-admin-text">
              {s.label ? <span className="text-admin-textMuted">{s.label}: </span> : null}
              {s.value}
            </div>
          ))}
          {b.note ? (
            <div className="pl-3 text-xs text-admin-text">
              <span className="text-admin-textMuted">หมายเหตุ: </span>
              {b.note}
            </div>
          ) : null}
        </div>
      ))}
      {trailingNote ? (
        <div className="py-1 text-xs text-admin-text first:pt-0 last:pb-0">
          <span className="text-admin-textMuted">หมายเหตุ: </span>
          {trailingNote}
        </div>
      ) : null}
    </div>
  );
}
