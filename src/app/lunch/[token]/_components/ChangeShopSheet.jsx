"use client";

// src/app/lunch/[token]/_components/ChangeShopSheet.jsx
//
// ชีตล่าง "เปลี่ยนร้าน" + ขั้นยืนยันก่อนล้างตะกร้า (อยู่ในชีตเดียวกัน ไม่ซ้อนกล่องที่สอง)
//   ChangeShopSheet    — หน้าเมนู: รายการร้าน -> (ตะกร้ามีของ) ขั้นยืนยัน
//   SwitchConfirmSheet — หน้าเลือกร้าน / แถบ conflict: เปิดที่ขั้นยืนยันเลย
// ทุกที่ที่ "เปลี่ยนร้านแล้วล้างตะกร้า" ใช้ขั้นยืนยันตัวนี้ตัวเดียว
import { useEffect, useRef, useState } from "react";
import { X, ChevronRight } from "lucide-react";

import { LogoTile } from "./Shell";
import { shopTypeText, shopBlockedText, BlockedChip } from "./ShopChips";

/* ---------------- frame ---------------- */

/** scrim + กล่องชีต: Esc / แตะ scrim / แตะแถบจับ = ปิด, Tab วนในชีต, ปิดแล้วคืนโฟกัสให้ตัวที่เปิด */
export function SheetFrame({ labelledBy, testId, onClose, children }) {
  const sheetRef = useRef(null);
  // ผู้เรียกส่ง onClose ใหม่ทุก render -> อ่านผ่าน ref ไม่ให้ effect ผูกใหม่
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement;

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = sheetRef.current?.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"])',
      );
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
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener && opener.isConnected && typeof opener.focus === "function") {
        requestAnimationFrame(() => opener.focus());
      }
    };
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
        aria-labelledby={labelledBy}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-[24px] bg-white px-4 pt-2 shadow-xl"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {/* แถบจับ: แตะแล้วปิด (เมาส์/นิ้ว) — คีย์บอร์ด/screen reader ใช้ Esc หรือปุ่มปิดแทน */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onClose}
          className="mx-auto mb-1 flex h-5 w-16 shrink-0 items-center justify-center"
        >
          <span className="h-1.5 w-10 rounded-full bg-[color:var(--gray-light)]" />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ---------------- confirm step ---------------- */

function SwitchConfirm({ target, currentName, count, onBack, onConfirm }) {
  const titleRef = useRef(null);
  // ขั้นยืนยันโผล่ -> โฟกัสที่หัวข้อ
  useEffect(() => {
    titleRef.current?.focus();
  }, [target?.id]);

  return (
    <div data-testid="switch-confirm" className="pb-1 pt-2">
      <div className="flex items-center gap-3">
        <LogoTile src={target.logo} alt="" size={48} />
        <h3
          ref={titleRef}
          id="switch-confirm-title"
          tabIndex={-1}
          className="text-[18px] font-bold leading-snug text-[color:var(--navy)] outline-none"
        >
          เปลี่ยนไปร้าน {target.name}?
        </h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--gray)]">
        รายการที่เลือกไว้ {count} รายการจาก {currentName} จะถูกล้างทั้งหมด
      </p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-[52px] flex-1 rounded-[14px] border border-[color:var(--gray-light)] bg-white text-[15px] font-semibold text-[color:var(--navy)] transition active:scale-[0.98]"
        >
          ย้อนกลับ
        </button>
        <button
          type="button"
          data-testid="switch-confirm-go"
          onClick={onConfirm}
          className="h-[52px] flex-1 rounded-[14px] bg-[color:var(--blue)] text-[15px] font-bold text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.98]"
        >
          เปลี่ยนร้าน
        </button>
      </div>
    </div>
  );
}

/** เปิดที่ขั้นยืนยันเลย — "ย้อนกลับ" = ปิดชีต อยู่หน้าเดิม */
export function SwitchConfirmSheet({ target, currentName, count, onConfirm, onClose }) {
  return (
    <SheetFrame labelledBy="switch-confirm-title" testId="switch-confirm-sheet" onClose={onClose}>
      <SwitchConfirm
        target={target}
        currentName={currentName}
        count={count}
        onBack={onClose}
        onConfirm={onConfirm}
      />
    </SheetFrame>
  );
}

/* ---------------- shop list (+ confirm step) ---------------- */

/**
 * onSwitch(target) = ล้างตะกร้า (ถ้ามี) แล้วไปเมนูร้านนั้น
 * ตะกร้าว่าง -> แตะร้านแล้วเปลี่ยนเลย / ตะกร้ามีของ -> ขั้นยืนยันในชีตเดียวกัน
 */
export default function ChangeShopSheet({ shops, currentId, currentName, cartCount, onSwitch, onClose }) {
  const [confirmTarget, setConfirmTarget] = useState(null);
  const closeRef = useRef(null);

  // ขั้นรายการร้าน (ตอนเปิด / กดย้อนกลับจากขั้นยืนยัน) -> โฟกัสปุ่มปิด
  useEffect(() => {
    if (!confirmTarget) closeRef.current?.focus();
  }, [confirmTarget]);

  function pick(r) {
    if (cartCount > 0) {
      setConfirmTarget(r);
      return;
    }
    onSwitch(r);
  }

  if (confirmTarget) {
    return (
      <SheetFrame labelledBy="switch-confirm-title" testId="change-shop-sheet" onClose={onClose}>
        <SwitchConfirm
          target={confirmTarget}
          currentName={currentName}
          count={cartCount}
          onBack={() => setConfirmTarget(null)}
          onConfirm={() => onSwitch(confirmTarget)}
        />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame labelledBy="change-shop-title" testId="change-shop-sheet" onClose={onClose}>
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
                onClick={() => !blocked && pick(r)}
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
    </SheetFrame>
  );
}
