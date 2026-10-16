"use client";

// src/app/lunch/[token]/_components/ClearCartSheet.jsx  (เดิมชื่อ NoOrderModal.jsx)
//
// "สั่งที่ร้านเอง" (r1h): ยืนยันได้ครั้งเดียว และมาก่อนหน้าสรุป
//   ตะกร้าว่าง  -> ไปหน้าสรุปเลย, "ยืนยัน" บนหน้าสรุปส่งออเดอร์ทันที
//   ตะกร้ามีของ -> ชีตนี้ (บนหน้าเมนู / หน้าเลือกร้านแบบย่อ) "ล้างรายการที่เลือกไว้?"
//                  กดยืนยันแค่พาไปหน้าสรุป (ยังไม่ล้าง) — ตะกร้าถูกล้างหลัง POST สำเร็จเท่านั้น
// หน้าสรุปรู้ว่าผ่านชีตนี้มาแล้วจาก ?confirmed=<cartSignature> — ตรงกับตะกร้าตอนนี้ = ไม่ต้องเตือนซ้ำ
import { useEffect, useRef } from "react";

import { SheetFrame } from "./ChangeShopSheet";

/**
 * ลายเซ็นสั้น ๆ ของตะกร้า (บรรทัด + จำนวน) — ใช้ผูก "ยืนยันล้างตะกร้าแล้ว" กับตะกร้าชุดนั้นเท่านั้น
 * ตะกร้าเปลี่ยน / URL เก่า / ไม่มีพารามิเตอร์ -> ไม่ตรง -> หน้าสรุปเตือนอีกครั้ง
 */
export function cartSignature(cart) {
  const s = (cart?.lines || [])
    .map((l) => `${l.lineKey}*${l.qty || 0}`)
    .sort()
    .join("|");
  if (!s) return "";
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export default function ClearCartSheet({ count, cartShopName, onCancel, onConfirm }) {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <SheetFrame labelledBy="clear-cart-title" testId="clear-cart-sheet" onClose={onCancel}>
      <div className="pb-1 pt-2">
        <h3
          ref={titleRef}
          id="clear-cart-title"
          tabIndex={-1}
          className="text-[18px] font-bold text-[color:var(--navy)] outline-none"
        >
          ล้างรายการที่เลือกไว้?
        </h3>
        <p
          data-testid="clear-cart-warning"
          className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[14px] font-medium leading-relaxed text-[#b8720a]"
        >
          รายการที่เลือกไว้ {count} รายการจาก {cartShopName} จะถูกล้างทั้งหมด
          เพื่อเปลี่ยนเป็นสั่งที่ร้านเอง
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-[52px] flex-1 rounded-[14px] border border-[color:var(--gray-light)] bg-white text-[15px] font-semibold text-[color:var(--navy)] transition active:scale-[0.98]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            data-testid="clear-cart-confirm"
            onClick={onConfirm}
            className="h-[52px] flex-[1.8] rounded-[14px] bg-[color:var(--blue)] px-3 text-[15px] font-bold text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.98]"
          >
            ล้างรายการและสั่งที่ร้านเอง
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
