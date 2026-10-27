"use client";

import { Ban, CalendarX, CheckCircle2, Clock, ShoppingBag, Ticket, UtensilsCrossed, XCircle } from "lucide-react";

import { COUPON_FILTER_STATUSES, reportFinalCloseLabel } from "./reportUi";

// R6-1a: การ์ดสถานะคูปอง = 6 สถานะเดียวกับป้ายแถว / ตัวกรอง (counts.byCoupon) — รวมกันเท่ากับ "คูปองทั้งหมด"
//        กระดาษ / e-coupon ไม่แยกการ์ดแล้ว (ดูได้จากป้ายประเภทของแถว และสรุปตามร้าน)
const COUPON_CARDS = [
  { key: "wait", Icon: Clock, tone: "bg-slate-50 text-slate-700", caption: () => "เลือกคูปอง ยังไม่สั่ง" },
  { key: "ordered", Icon: ShoppingBag, tone: "bg-slate-50 text-slate-700", caption: () => "สั่งแล้ว ยังไม่ใช้ / ยังไม่รับคูปอง" },
  { key: "used", Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700", caption: () => "e-coupon ที่ร้านกดใช้ / ส่งมอบคูปองกระดาษแล้ว" },
  { key: "not_used", Icon: CalendarX, tone: "bg-amber-50 text-amber-700", caption: () => `ไม่ได้ใช้ / ไม่มารับ ภายใน ${reportFinalCloseLabel()}` },
  { key: "forfeited", Icon: Ban, tone: "bg-slate-100 text-slate-600", caption: () => `ไม่สั่งภายใน ${reportFinalCloseLabel()}` },
  { key: "cancelled", Icon: XCircle, tone: "bg-red-50 text-red-700", caption: () => "ยกเลิก ยังไม่มี QR ใหม่" },
];

export default function KpiCards({ counts }) {
  const cards = [
    {
      key: "set",
      label: "ชุดอาหาร (Set)",
      value: counts.byType.set,
      Icon: UtensilsCrossed,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      key: "coupon",
      label: "คูปองทั้งหมด",
      value: counts.coupon,
      Icon: Ticket,
      tone: "bg-violet-50 text-violet-700",
      // คูปองที่ยังไม่มีร้าน (รอสั่ง / ตัดสิทธิ์ / ยกเลิก) ไม่มีกระดาษ / e-coupon — บอกแยกให้รวมกันได้ครบ
      caption: [
        `กระดาษ ${counts.byType.stock}`,
        `e-coupon ${counts.byType.ecoupon}`,
        counts.byType.coupon ? `ยังไม่เลือกร้าน ${counts.byType.coupon}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    ...COUPON_CARDS.map((c) => ({
      key: c.key,
      label: COUPON_FILTER_STATUSES[c.key],
      value: counts.byCoupon[c.key],
      Icon: c.Icon,
      tone: c.tone,
      caption: c.caption(),
    })),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(({ key, label, value, Icon, tone, caption }) => (
        <div key={key} className="min-w-0 rounded-2xl border border-admin-border bg-white p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-admin-text sm:text-sm">{label}</div>
              <div className="text-2xl font-semibold leading-tight text-admin-text">{value}</div>
            </div>
          </div>
          {caption && (
            <div className="mt-2 line-clamp-2 text-[11px] text-admin-textMuted" title={caption}>
              {caption}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
