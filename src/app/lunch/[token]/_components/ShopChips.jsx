// src/app/lunch/[token]/_components/ShopChips.jsx
//
// ป้ายบอกชนิดร้าน / สถานะร้าน — ใช้ร่วมกันทั้งหน้าเลือกร้าน หน้าเมนู และชีตเปลี่ยนร้าน

/** ข้อความชนิดร้าน: ร้าน stock = คูปองกระดาษที่ Counter, ไม่ใช่ stock = E-coupon */
export function shopTypeText(r) {
  return r?.isStock ? "รับคูปองกระดาษที่ Counter" : "แสดง E-coupon ที่ร้าน";
}

/** ร้านที่เลือกไม่ได้ -> ข้อความป้าย ("" = เลือกได้) */
export function shopBlockedText(r) {
  if (r?.state === "closed") return "ปิดวันนี้";
  if (r?.state === "sold_out") return "คูปองหมด";
  return "";
}

export function ShopTypeChip({ r }) {
  return r?.isStock ? (
    <span className="inline-block rounded-full bg-[color:var(--blue-tint)] px-2.5 py-1 text-[11px] font-semibold leading-tight text-[color:var(--blue-deep)]">
      {shopTypeText(r)}
    </span>
  ) : (
    <span className="inline-block rounded-full bg-[color:var(--navy)] px-2.5 py-1 text-[11px] font-semibold leading-tight text-[color:var(--lime)]">
      {shopTypeText(r)}
    </span>
  );
}

/** ป้ายขาวขอบเทาของร้านที่ปิด / คูปองหมด */
export function BlockedChip({ text }) {
  return (
    <span className="inline-block rounded-full border border-[color:var(--gray-light)] bg-white px-2.5 py-1 text-[11px] font-semibold leading-tight text-[color:var(--gray)]">
      {text}
    </span>
  );
}
