"use client";

// src/app/lunch/[token]/_components/ItemSheet.jsx
//
// ชีตของเมนูที่อยู่ในตะกร้าแล้ว (แตะวงกลมตัวเลขในหน้าเมนู) — แทนปุ่ม −/n/+ เดิม
//   หนึ่งแถวต่อหนึ่งบรรทัดในตะกร้า ทั้งแถวเป็นปุ่มเดียว -> หน้ารายละเอียดโหมดแก้ไข
//   ปุ่มล่าง "สั่งรายการนี้เพิ่ม" -> บรรทัดใหม่
// ใช้กรอบ/scrim เดียวกับชีตเปลี่ยนร้าน (SheetFrame): Esc / แตะ scrim / แตะแถบจับ = ปิด
import { useEffect, useRef } from "react";
import { ImageOff } from "lucide-react";

import { unitPriceOf } from "@/lib/lunchCart.client";
import { SheetFrame } from "./ChangeShopSheet";
import OptionLines, { groupsFromCartLine } from "./OptionLines";

/** ข้อความสั้นของตัวเลือก + หมายเหตุ สำหรับ aria-label */
function summaryText(groups, note) {
  const parts = groups.map((g) => `${g.name ? `${g.name}: ` : ""}${g.values.join(", ")}`);
  if (note) parts.push(`หมายเหตุ: ${note}`);
  return parts.join(" ");
}

export default function ItemSheet({ menu, lines, onEditLine, onAddMore, onClose }) {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // มีตัวเลือกที่บวกราคา -> ราคาที่โชว์เป็นแค่ราคาเริ่มต้น
  const pricedOptions = (menu.optionGroups || []).some((g) =>
    (g.choices || []).some((c) => Number(c.priceDelta) > 0),
  );

  return (
    <SheetFrame labelledBy="item-sheet-title" testId="item-sheet" onClose={onClose}>
      <div className="flex items-start justify-between gap-3 pb-3 pt-1">
        <h3
          ref={titleRef}
          id="item-sheet-title"
          tabIndex={-1}
          className="min-w-0 text-[20px] font-semibold leading-snug text-[color:var(--navy)] outline-none"
        >
          {menu.name}
        </h3>
        <div className="shrink-0 text-right">
          <p className="text-[20px] text-[color:var(--navy)]">{menu.price} ฿</p>
          {pricedOptions ? (
            <p className="text-[12px] text-[color:var(--gray)]">ราคาเริ่มต้น</p>
          ) : null}
        </div>
      </div>

      <ul className="max-h-[60dvh] divide-y divide-black/[.08] overflow-y-auto overscroll-contain border-t border-black/[.08]">
        {lines.map((l) => {
          const groups = groupsFromCartLine(l, menu);
          const lineTotal = unitPriceOf(l, menu) * (l.qty || 0);
          const summary = summaryText(groups, l.note);
          return (
            <li key={l.lineKey}>
              <button
                type="button"
                data-testid="item-sheet-line"
                onClick={() => onEditLine(l)}
                aria-label={`แก้ไข ${menu.name}${summary ? ` ${summary}` : ""} จำนวน ${l.qty}`}
                className="flex w-full items-center gap-3 py-3 text-left transition active:bg-slate-50"
              >
                {menu.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={menu.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl bg-slate-100 object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                    <ImageOff className="h-5 w-5" />
                  </span>
                )}
                <span className="block min-w-0 flex-1">
                  {groups.length ? (
                    <OptionLines groups={groups} note={l.note} inline />
                  ) : (
                    <>
                      <span className="block text-[15px] text-[color:var(--navy)]">{menu.name}</span>
                      <OptionLines note={l.note} inline />
                    </>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--blue)] bg-white text-[16px] font-bold tabular-nums text-[color:var(--blue)]"
                >
                  {l.qty}
                </span>
                <span className="w-16 shrink-0 text-right text-[15px] font-semibold tabular-nums text-[color:var(--navy)]">
                  {lineTotal} บาท
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        data-testid="item-sheet-add"
        onClick={onAddMore}
        className="mt-3 h-[52px] w-full shrink-0 rounded-[14px] bg-[color:var(--blue)] text-[16px] font-bold text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.99]"
      >
        สั่งรายการนี้เพิ่ม
      </button>
    </SheetFrame>
  );
}
