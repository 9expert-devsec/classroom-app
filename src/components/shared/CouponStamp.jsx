// src/components/shared/CouponStamp.jsx
//
// C2: ตราประทับ "ใช้แล้ว" / "หมดอายุ" ทับ QR — ยกมาจากหน้าคูปองเดิม
// (src/app/coupon/[publicId]/CouponPublicClient.jsx l.286-290 / l.584-608) ไม่เปลี่ยนหน้าตา:
//   QR จางลงเหลือ opacity-10 แล้ววาง SVG ตราประทับไว้กลางกรอบ (กรอบต้องเป็น relative)
// หน้าคูปองเดิมยังใช้โค้ดของตัวเองอยู่ (เป็นงาน C3)

export const STAMP_SRC = {
  used: "/stamps/redeemed-stamp.svg",
  expired: "/stamps/expired-stamp.svg",
};

/** class ของชั้น QR — จางลงเมื่อมีตราประทับ */
export function stampFadeClass(status) {
  return STAMP_SRC[status] ? "opacity-10" : "";
}

export default function CouponStamp({ status }) {
  const src = STAMP_SRC[status];
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={status === "expired" ? "Expired" : "Used"}
      data-testid="coupon-stamp"
      data-stamp={status}
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[100%] -translate-x-1/2 -translate-y-1/2"
    />
  );
}
