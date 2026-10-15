"use client";

// src/app/lunch/[token]/_components/ChangeShopSheet.jsx
//
// ชีตล่าง "เปลี่ยนร้าน" ของหน้าเมนู — แทนปุ่ม "เปลี่ยนเป็น <ร้าน>" และกล่องยืนยันเดิม
// ตะกร้ามีรายการ -> แถบเตือนบนสุดคือการยืนยัน แตะร้านแล้วล้างตะกร้าเลย ไม่มีกล่องที่สอง
import { useEffect, useRef } from "react";
import { X, ChevronRight } from "lucide-react";

import { LogoTile } from "./Shell";
import { shopTypeText, shopBlockedText, BlockedChip } from "./ShopChips";

export default function ChangeShopSheet({ shops, currentId, currentName, cartCount, onPick, onClose }) {
  const sheetRef = useRef(null);
  const closeRef = useRef(null);
  // ผู้เรียก (หน้าเมนู) ส่ง onClose ใหม่ทุก render -> อ่านผ่าน ref ไม่ให้ effect โฟกัสซ้ำ
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // เปิดแล้วโฟกัสเข้าชีต, Esc ปิด, Tab วนอยู่ในชีต
  useEffect(() => {
    closeRef.current?.focus();

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = sheetRef.current?.querySelectorAll("button:not([disabled])");
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-[rgba(13,27,42,.6)]"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-shop-title"
        data-testid="change-shop-sheet"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-[24px] bg-white px-4 pt-2 shadow-xl"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-[color:var(--gray-light)]" />

        <div className="flex items-center justify-between">
          <h3 id="change-shop-title" className="text-[18px] font-bold text-[color:var(--navy)]">
            เปลี่ยนร้าน
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--gray)] transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {cartCount > 0 ? (
          <p
            data-testid="change-shop-warning"
            className="mt-2 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]"
          >
            ตะกร้ามี {cartCount} รายการจาก {currentName} — จะถูกล้างเมื่อเปลี่ยนร้าน
          </p>
        ) : null}

        <ul className="mt-3 flex max-h-[70dvh] flex-col gap-2 overflow-y-auto overscroll-contain pb-1">
          {shops.map((r) => {
            const current = r.id === currentId;
            const blockedText = current ? "" : shopBlockedText(r);
            const blocked = !!blockedText;

            if (current) {
              return (
                <li key={r.id}>
                  <div
                    aria-current="true"
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-[color:var(--blue)] bg-[color:var(--blue-tint)] p-3"
                  >
                    <LogoTile src={r.logo} alt="" size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[color:var(--navy)]">{r.name}</p>
                      <p className="mt-0.5 truncate text-[12px] text-[color:var(--gray)]">{shopTypeText(r)}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold text-[color:var(--blue-deep)]">
                      ร้านปัจจุบัน ✓
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => !blocked && onPick(r)}
                  className={[
                    "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                    blocked
                      ? "cursor-not-allowed border-black/5 bg-slate-100"
                      : "border-black/10 bg-white hover:border-[color:var(--blue)] active:scale-[0.99]",
                  ].join(" ")}
                >
                  <div className={blocked ? "opacity-50 grayscale" : ""}>
                    <LogoTile src={r.logo} alt="" size={48} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[15px] font-semibold ${blocked ? "text-slate-400" : "text-[color:var(--navy)]"}`}
                    >
                      {r.name}
                    </p>
                    {blocked ? null : (
                      <p className="mt-0.5 truncate text-[12px] text-[color:var(--gray)]">{shopTypeText(r)}</p>
                    )}
                  </div>
                  {blocked ? (
                    <BlockedChip text={blockedText} />
                  ) : (
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[color:var(--gray-light)]" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 h-11 w-full shrink-0 rounded-xl text-[15px] font-medium text-[color:var(--gray)] transition hover:bg-slate-100"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
