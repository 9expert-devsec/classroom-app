"use client";

import { CalendarDays } from "lucide-react";
import {
  daysLeft,
  EXPIRING_DAYS,
  lotKey,
  lotLabel,
} from "./stockUi";

// soonest expiry first, "no lot" last
export function sortLots(batches) {
  return [...(batches || [])].sort((a, b) => {
    const an = a.importBatch ? 0 : 1;
    const bn = b.importBatch ? 0 : 1;
    if (an !== bn) return an - bn;
    if (a.expiresYMD !== b.expiresYMD)
      return (a.expiresYMD || "9999").localeCompare(b.expiresYMD || "9999");
    return (a.importBatch || "").localeCompare(b.importBatch || "");
  });
}

// "used" on a lot card = out of stock through an order
// (assigned + handed out + awaiting return); void is neither
export function lotUsed(b) {
  return (b.assigned || 0) + (b.handedOut || 0) + (b.awaitingReturn || 0);
}

function lotPill(b, d) {
  if (!b.importBatch) return { text: "ไม่ระบุ", cls: "bg-slate-100 text-slate-600" };
  if (d !== null && d < 0) return { text: "หมดอายุ", cls: "bg-red-100 text-red-700" };
  if (d !== null && d <= EXPIRING_DAYS)
    return { text: "ใกล้หมดอายุ", cls: "bg-red-50 text-red-600" };
  return { text: "ปกติ", cls: "bg-green-100 text-green-700" };
}

function LotCard({ b, today, active, highlight, onClick }) {
  const d = daysLeft(today, b.expiresYMD);
  const pill = lotPill(b, d);
  const urgent = d !== null && d <= EXPIRING_DAYS;
  const used = lotUsed(b);
  const pct = b.total > 0 ? Math.round((used / b.total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "w-64 flex-shrink-0 rounded-2xl border bg-white p-4 text-left transition",
        active
          ? "border-brand-primary ring-2 ring-brand-primary/30"
          : "border-admin-border hover:border-brand-primary/60",
        highlight ? "animate-pulse ring-2 ring-green-400" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="truncate text-sm font-semibold" title={lotLabel(b.importBatch)}>
          {lotLabel(b.importBatch)}
        </div>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
          {pill.text}
        </span>
      </div>

      <div className={`mt-2 flex items-center gap-1 text-xs ${urgent ? "text-red-600" : "text-admin-textMuted"}`}>
        <CalendarDays className="h-3.5 w-3.5" />
        <span>
          หมดอายุ {b.expiresYMD || "—"}
          {d !== null && (d >= 0 ? ` (เหลือ ${d} วัน)` : ` (เลยมา ${-d} วัน)`)}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" title={`ใช้ไปแล้ว ${pct}%`}>
        <div className="h-full rounded-full bg-brand-primaryDark" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-admin-border text-center">
        <div>
          <div className="text-[11px] text-admin-textMuted">ทั้งหมด</div>
          <div className="text-base font-semibold">{b.total}</div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">พร้อมใช้</div>
          <div className="text-base font-semibold text-green-600">{b.available}</div>
        </div>
        <div>
          <div className="text-[11px] text-admin-textMuted">ถูกใช้แล้ว</div>
          <div className="text-base font-semibold">{used}</div>
        </div>
      </div>
    </button>
  );
}

export default function LotCards({ batches, today, activeLot, highlightLot, onSelect }) {
  const lots = sortLots(batches);

  return (
    <div className="rounded-2xl bg-admin-surface p-4 shadow-sm">
      <h2 className="text-base font-semibold">สต็อกแยกตามล็อต</h2>
      <p className="text-xs text-admin-textMuted">ภาพรวมจำนวนคูปองในแต่ละล็อต</p>

      {lots.length === 0 ? (
        <p className="mt-3 text-sm text-admin-textMuted">ยังไม่มีล็อตคูปองในร้านนี้</p>
      ) : (
        <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2">
          {lots.map((b) => {
            const key = lotKey(b.importBatch, b.expiresYMD);
            return (
              <LotCard
                key={key}
                b={b}
                today={today}
                active={activeLot === key}
                highlight={highlightLot === key}
                onClick={() => onSelect(activeLot === key ? "" : key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
