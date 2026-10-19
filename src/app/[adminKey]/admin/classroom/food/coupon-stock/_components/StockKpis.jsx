"use client";

import { AlertCircle, Box, CircleCheck, Clock, Layers, Truck } from "lucide-react";

const TONES = {
  green: { card: "bg-green-50/70", icon: "bg-green-100 text-green-600", value: "text-green-700" },
  blue: { card: "bg-blue-50/70", icon: "bg-blue-100 text-blue-600", value: "text-blue-700" },
  violet: { card: "bg-violet-50/70", icon: "bg-violet-100 text-violet-600", value: "text-violet-700" },
  red: { card: "bg-red-50/70", icon: "bg-red-100 text-red-600", value: "text-red-600" },
  amber: { card: "bg-amber-50/70", icon: "bg-amber-100 text-amber-600", value: "text-amber-600" },
  slate: { card: "bg-slate-50", icon: "bg-slate-200 text-slate-600", value: "text-admin-text" },
};

function KpiCard({ icon: Icon, label, value, caption, tone }) {
  const t = TONES[tone];
  return (
    <div className={`flex items-center gap-4 rounded-2xl p-4 ${t.card}`}>
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${t.icon}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-admin-text">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold leading-tight ${t.value}`}>
            {value ?? "–"}
          </span>
          <span className="text-xs text-admin-textMuted">ใบ</span>
        </div>
        <div className="truncate text-xs text-admin-textMuted">{caption}</div>
      </div>
    </div>
  );
}

export default function StockKpis({ summary }) {
  const s = summary;
  const by = s?.byStatus || {};
  const total = s
    ? Object.values(by).reduce((a, n) => a + (Number(n) || 0), 0)
    : null;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl bg-admin-surface p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        icon={Layers}
        tone="green"
        label="พร้อมใช้"
        value={s?.availableNotExpired}
        caption={
          s?.restaurant?.stockFallbackToECoupon || s?.fallbackECouponToday > 0
            ? `ยังไม่หมดอายุ · e-coupon แทนกระดาษวันนี้ ${s?.fallbackECouponToday ?? 0} ใบ`
            : "คูปองที่สามารถใช้งานได้ (ยังไม่หมดอายุ)"
        }
      />
      <KpiCard
        icon={CircleCheck}
        tone="blue"
        label="ถูกใช้แล้ว"
        value={s ? by.assigned : null}
        caption="คูปองที่ผูกกับออเดอร์แล้ว"
      />
      <KpiCard
        icon={Truck}
        tone="violet"
        label="ส่งมอบแล้ว"
        value={s ? by.handed_out : null}
        caption="คูปองที่ส่งมอบที่ Counter แล้ว"
      />
      <KpiCard
        icon={AlertCircle}
        tone="red"
        label="หมดอายุ"
        value={s?.expiredStillAvailable}
        caption="คูปองที่หมดอายุแล้วและยังไม่ได้ใช้"
      />
      <KpiCard
        icon={Clock}
        tone="amber"
        label="ใกล้หมดอายุ (7 วัน)"
        value={s?.expiringSoon}
        caption="คูปองพร้อมใช้ที่หมดอายุภายใน 7 วัน"
      />
      <KpiCard
        icon={Box}
        tone="slate"
        label="ทั้งหมด"
        value={total}
        caption="จำนวนคูปองทั้งหมดของร้านนี้"
      />
    </div>
  );
}
