"use client";

// รายการที่สั่ง แบบพับได้ (ปิดไว้ก่อน) — ข้อมูลจาก snapshot ของออเดอร์ ไม่ใช่เมนูปัจจุบัน
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function CollapsibleOrder({ order }) {
  const [open, setOpen] = useState(false);
  const lines = order.lines || [];
  const count = lines.reduce((s, l) => s + (l.qty || 0), 0);

  return (
    <div className="rounded-2xl bg-white shadow-sm" data-testid="collapsible-order">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[15px] font-semibold text-[#0d1b2a]">
          รายการที่สั่ง · {count} รายการ
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-black/5 px-4 py-3">
          {lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <span className="text-[#0d1b2a]">
                  {l.qty}× {l.name}
                </span>
                {(l.options || []).length ? (
                  <p className="text-[12px] text-slate-400">
                    {l.options.map((o) => o.choiceName).join(", ")}
                  </p>
                ) : null}
                {l.note ? (
                  <p className="break-words text-[12px] italic text-slate-400">“{l.note}”</p>
                ) : null}
              </div>
              <span className="shrink-0 text-slate-500">{l.lineTotal}฿</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-black/5 pt-2 text-[14px] font-semibold text-[#0d1b2a]">
            <span>ราคารวม</span>
            <span>{order.itemsTotal} บาท</span>
          </div>
          {order.overBudget > 0 ? (
            <div className="mt-2 flex justify-between rounded-xl bg-[#d98a13]/10 px-3 py-2.5 text-[13px] font-semibold text-[#b8720a]">
              <span>ส่วนที่ต้องชำระเองที่ร้าน</span>
              <span>{order.overBudget} บาท</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
