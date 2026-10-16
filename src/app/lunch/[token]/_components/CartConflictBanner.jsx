"use client";

// src/app/lunch/[token]/_components/CartConflictBanner.jsx
//
// แถบ conflict: ตะกร้ามีรายการจากอีกร้าน (เดิมชื่อ SwitchModal.jsx — กล่องยืนยันเปลี่ยนร้าน
// ย้ายไป SwitchConfirmSheet ใน ChangeShopSheet แล้ว, Sheet เดิมถูกแทนด้วย SheetFrame)

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
