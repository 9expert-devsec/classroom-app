"use client";

// src/app/lunch/[token]/_components/NoOrderModal.jsx
//
// ชีตยืนยัน "ไปสั่งอาหารที่ร้านเอง" (at_shop) — ใช้ทั้งหน้าเมนูและหน้าสรุปแบบย่อ (C1)
import { Sheet } from "./SwitchModal";

export default function NoOrderModal({
  restaurant,
  budget,
  cartCount,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  return (
    <Sheet>
      <h3 className="text-[18px] font-bold text-[#0d1b2a]">
        ไปสั่งอาหารที่ร้านเอง?
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
        ท่านจะใช้คูปองมูลค่า {budget} บาทสั่งอาหารที่ร้าน {restaurant.name}{" "}
        ด้วยตัวเอง เมื่อยืนยันแล้วจะแก้ไขเองไม่ได้
      </p>
      {cartCount > 0 ? (
        <p className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]">
          รายการในตะกร้า {cartCount} รายการจะถูกล้าง
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
          className="h-11 flex-1 rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-11 flex-1 rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
    </Sheet>
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
