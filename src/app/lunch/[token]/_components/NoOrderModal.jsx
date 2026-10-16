"use client";

// src/app/lunch/[token]/_components/NoOrderModal.jsx
//
// ชีตยืนยัน "สั่งที่ร้านเอง" (at_shop) — เปิดจากปุ่ม "ยืนยัน" ของหน้าสรุปสั่งที่ร้านเอง
// (หน้าเดียวกันทั้งก่อนและหลังเส้นตาย) ใช้กรอบ SheetFrame เดียวกับชีตเปลี่ยนร้าน/ชีตเมนู:
// Esc / แตะ scrim / แตะแถบจับ = ปิด, โฟกัสเข้าหัวข้อ, ปิดแล้วคืนโฟกัสให้ปุ่มที่เปิด
// ตะกร้ามีของ -> แถบเตือนสีส้ม + ปุ่มหลัก "ล้างรายการและสั่งที่ร้านเอง"
// (ตะกร้าถูกล้างหลัง POST สำเร็จเท่านั้น — ผู้เรียกเป็นคนล้าง)
import { useEffect, useRef } from "react";

import { SheetFrame } from "./ChangeShopSheet";

export default function NoOrderModal({
  restaurant,
  budget,
  cartCount,
  cartShopName,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // ระหว่างบันทึกห้ามปิด (Esc / scrim / แถบจับ) — ปุ่มยกเลิกก็ปิดอยู่แล้ว
  function close() {
    if (!busy) onCancel();
  }

  const clearing = cartCount > 0;

  return (
    <SheetFrame labelledBy="at-shop-title" testId="at-shop-sheet" onClose={close}>
      <div className="pb-1 pt-2">
        <h3
          ref={titleRef}
          id="at-shop-title"
          tabIndex={-1}
          className="text-[18px] font-bold text-[color:var(--navy)] outline-none"
        >
          สั่งที่ร้านเอง?
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--gray)]">
          ท่านจะใช้คูปองมูลค่า {budget} บาท สั่งอาหารที่ร้าน {restaurant.name} ด้วยตัวเอง
          เมื่อยืนยันแล้วจะแก้ไขเองไม่ได้
        </p>
        {clearing ? (
          <p
            data-testid="at-shop-clear-warning"
            className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]"
          >
            รายการที่เลือกไว้ {cartCount} รายการจาก {cartShopName} จะถูกล้างทั้งหมด
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-[52px] flex-1 rounded-[14px] border border-[color:var(--gray-light)] bg-white text-[15px] font-semibold text-[color:var(--navy)] transition active:scale-[0.98] disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            data-testid="at-shop-confirm"
            onClick={onConfirm}
            disabled={busy}
            className={`h-[52px] rounded-[14px] bg-[color:var(--blue)] px-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.98] disabled:opacity-60 ${clearing ? "flex-[1.8]" : "flex-1"}`}
          >
            {busy ? "กำลังบันทึก..." : clearing ? "ล้างรายการและสั่งที่ร้านเอง" : "ยืนยัน"}
          </button>
        </div>
      </div>
    </SheetFrame>
  );
}

/**
 * POST at_shop (ไม่มีรายการอาหาร) แล้วแปลผลเป็นสิ่งที่หน้าต้องทำต่อ
 *   { next: "done" }      -> ไปหน้าขอบคุณ (?done=1) — สำเร็จ / replay / สั่งไปแล้ว
 *   { next: "sold_out" }  -> กลับหน้าแรกพร้อมแจ้งคูปองหมด
 *   { next: "refresh" }   -> หมดเวลา (403) ให้ด่านตรวจฝั่ง server ตัดสินใหม่
 *   { next: "error", message }
 */
export async function postAtShop({ token, requestId, nickname, restaurantId }) {
  const body = JSON.stringify({
    requestId,
    nickname,
    restaurantId,
    mode: "at_shop",
    lines: [],
  });

  // ครอบเฉพาะ fetch: "เชื่อมต่อไม่สำเร็จ" ต้องหมายถึงเน็ตมีปัญหาจริง ๆ เท่านั้น
  let res;
  try {
    res = await fetch(`/api/lunch/${token}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return { next: "error", message: "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่" };
  }
  const data = await res.json().catch(() => ({}));

  if (res.ok || (res.status === 409 && data?.reason === "already_ordered")) {
    return { next: "done" };
  }
  if (res.status === 409 && data?.reason === "sold_out") {
    return { next: "sold_out" };
  }
  if (res.status === 403) {
    return { next: "refresh" };
  }
  return { next: "error", message: data?.error || "ทำรายการไม่สำเร็จ" };
}
