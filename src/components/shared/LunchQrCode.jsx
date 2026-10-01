"use client";

// QR ของลิงก์สั่งอาหาร (/lunch/<token>) — ตัวเดียวที่ใช้ทั้งแท็บเล็ต Step 3,
// หน้าแท็บเล็ต "แสดง QR สั่งอาหาร" และหน้าแอดมินหลังออก QR ใหม่
// (ย้ายออกมาจาก LunchQrStep ของ P3b โดยไม่เปลี่ยนหน้าตา)
//
// C2: ใช้กับ QR ของ e-coupon ด้วย
//   value  : ค่าที่ encode ตรง ๆ (เช่นรหัส 9XP-XXXX) — ใช้แทน path
//   status : "unused" | "used" | "expired" — used/expired = QR จาง + ตราประทับทับ
import QRCode from "react-qr-code";
import CouponStamp, { stampFadeClass } from "./CouponStamp";

export default function LunchQrCode({ path, value, size = 280, status = "unused", className = "" }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const encoded = value ?? (path ? `${origin}${path}` : "");
  if (!encoded) return null;

  return (
    // ใหญ่พอให้สแกนจากระยะแขนบน iPad
    <div
      data-testid="lunch-qr"
      data-url={value === undefined ? encoded : undefined}
      data-value={value !== undefined ? encoded : undefined}
      data-status={status}
      className={`relative mx-auto flex items-center justify-center rounded-xl bg-white p-4 ${className}`}
    >
      <div className={stampFadeClass(status)}>
        <QRCode value={encoded} size={size} />
      </div>
      <CouponStamp status={status} />
    </div>
  );
}
