"use client";

// รายการที่สั่ง แบบพับได้ (ปิดไว้ก่อน) — ข้อมูลจาก snapshot ของออเดอร์ ไม่ใช่เมนูปัจจุบัน
// R4a: การ์ดขาวขอบ #DCE3EE, เส้นคั่นระหว่างรายการ, ราคารวม -> ใช้งบคูปอง -> ส่วนที่ต้องชำระเพิ่ม (amber)
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import OptionLines, { groupsFromOrderLine } from "./OptionLines";

// CC4: className เพิ่มสไตล์กรอบ (เช่นเงาให้เข้ากับการ์ดหน้าคูปองกระดาษ) — ไม่ส่ง = หน้าตาเดิม
export default function CollapsibleOrder({ order, className = "" }) {
  const [open, setOpen] = useState(false);
  const lines = order.lines || [];
  const count = lines.reduce((s, l) => s + (l.qty || 0), 0);
  const total = order.itemsTotal || 0;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#dce3ee] bg-white ${className}`}
      data-testid="collapsible-order"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[15px] font-semibold text-[color:var(--navy)]">
          รายการที่สั่ง · {count} รายการ
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[color:var(--gray)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="border-t border-[#dce3ee] px-4 pb-4">
          <div className="divide-y divide-[#dce3ee]">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <span className="text-[color:var(--navy)]">
                    {l.qty}× {l.name}
                  </span>
                  <OptionLines groups={groupsFromOrderLine(l)} note={l.note} className="mt-0.5" />
                </div>
                <span className="shrink-0 text-[color:var(--gray)]">{l.lineTotal}฿</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-[#dce3ee] pt-3 text-[14px] font-semibold text-[color:var(--navy)]">
            <span>ราคารวม</span>
            <span>{total} บาท</span>
          </div>
          <div className="mt-1.5 flex justify-between text-[14px] text-[color:var(--gray)]">
            <span>ใช้งบคูปอง</span>
            <span>−{Math.min(total, order.budget)} บาท</span>
          </div>
          {order.overBudget > 0 ? (
            <div className="mt-3 flex justify-between rounded-xl bg-[#fbf1e4] px-3 py-2.5 text-[13px] font-semibold text-[#7a4708]">
              <span>ส่วนที่ต้องชำระเพิ่มที่ร้าน</span>
              <span>{order.overBudget} บาท</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
