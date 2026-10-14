"use client";

import { CalendarX, CheckCircle2, Clock, Hand, Ticket, UtensilsCrossed } from "lucide-react";

import { STATUS_META } from "./reportUi";

// coupon rows whose status keeps its own label — shown under "คูปองทั้งหมด" so the card adds up
const OWN_LABEL_COUPON = ["unused", "pending", "forfeited", "no_order"];

export default function KpiCards({ counts }) {
  const ownLabelLine = OWN_LABEL_COUPON.filter((k) => counts.byStatus[k] > 0)
    .map((k) => `${STATUS_META[k].label} ${counts.byStatus[k]}`)
    .join(" · ");

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
      caption: ownLabelLine,
    },
    {
      key: "used",
      label: STATUS_META.used.label,
      value: counts.byStatus.used,
      Icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
      caption: "E-coupon ที่ร้านกดใช้แล้ว",
    },
    {
      key: "received",
      label: STATUS_META.received.label,
      value: counts.byStatus.received,
      Icon: Hand,
      tone: "bg-blue-50 text-blue-700",
      caption: "Stock ที่ส่งมอบคูปองแล้ว",
    },
    {
      key: "awaiting",
      label: STATUS_META.awaiting.label,
      value: counts.byStatus.awaiting,
      Icon: Clock,
      tone: "bg-amber-50 text-amber-700",
      caption: "Stock ที่สั่งแล้ว ยังไม่ได้รับคูปอง",
    },
    {
      key: "expired",
      label: STATUS_META.expired.label,
      value: counts.byStatus.expired,
      Icon: CalendarX,
      tone: "bg-red-50 text-red-700",
      caption: "E-coupon ที่ไม่ได้ใช้ภายใน 15:00",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
