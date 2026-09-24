"use client";

// src/app/lunch/[token]/_components/SwitchModal.jsx
//
// ยืนยันก่อนล้างตะกร้าเมื่อเปลี่ยนร้าน — ใช้ร่วมกันทั้งหน้า 1 หน้าเมนู และหน้ารายละเอียด
import { LogoTile } from "./Shell";

export function Sheet({ children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}

export default function SwitchModal({ currentName, target, onCancel, onConfirm }) {
  return (
    <Sheet>
      <div data-testid="switch-modal">
        <div className="mb-3 flex items-center gap-3">
          <LogoTile src={target.logo} alt={target.name} size={44} />
          <h3 className="text-[17px] font-bold text-[#0d1b2a]">
            เปลี่ยนไปร้าน {target.name}?
          </h3>
        </div>
        <p className="text-[14px] leading-relaxed text-slate-500">
          รายการที่เลือกไว้จากร้าน {currentName} จะถูกล้างทั้งหมด
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 flex-1 rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98]"
          >
            เปลี่ยนร้าน
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * แถบบนสุดเมื่อเข้าหน้าร้านอื่นขณะที่ตะกร้ายังมีรายการจากอีกร้าน
 * (ย้อนกลับ / พิมพ์ URL เอง) — ตะกร้ายังไม่ถูกแตะจนกว่าจะกดยืนยัน
 */
export function CartConflictBanner({ count, cartRestaurantName, onBack, onSwitch }) {
  return (
    <div
      data-testid="cart-conflict"
      className="border-b border-[#d98a13]/20 bg-[#d98a13]/10 px-4 py-3"
    >
      <p className="text-[13px] font-medium text-[#b8720a]">
        ตะกร้าของท่านมี {count} รายการจากร้าน {cartRestaurantName}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-9 flex-1 rounded-xl bg-white px-3 text-[13px] font-semibold text-[#005cff] shadow-sm ring-1 ring-black/5 transition active:scale-[0.98]"
        >
          กลับไปร้าน {cartRestaurantName}
        </button>
        <button
          type="button"
          onClick={onSwitch}
          className="h-9 flex-1 rounded-xl bg-[#2486ff] px-3 text-[13px] font-semibold text-white shadow-sm transition active:scale-[0.98]"
        >
          เปลี่ยนเป็นร้านนี้
        </button>
      </div>
    </div>
  );
}
