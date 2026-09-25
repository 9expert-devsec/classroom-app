"use client";

// QR ของลิงก์สั่งอาหาร (/lunch/<token>) — ตัวเดียวที่ใช้ทั้งแท็บเล็ต Step 3,
// หน้าแท็บเล็ต "แสดง QR สั่งอาหาร" และหน้าแอดมินหลังออก QR ใหม่ / เปิดเวลาพิเศษ
// (ย้ายออกมาจาก LunchQrStep ของ P3b โดยไม่เปลี่ยนหน้าตา)
import QRCode from "react-qr-code";

export default function LunchQrCode({ path, size = 280 }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = path ? `${origin}${path}` : "";
  if (!url) return null;

  return (
    // ใหญ่พอให้สแกนจากระยะแขนบน iPad
    <div
      data-testid="lunch-qr"
      data-url={url}
      className="mx-auto flex items-center justify-center rounded-xl bg-white p-4"
    >
      <QRCode value={url} size={size} />
    </div>
  );
}
