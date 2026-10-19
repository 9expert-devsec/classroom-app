"use client";

// src/app/lunch/[token]/_components/CouponBarcode.jsx
//
// บาร์โค้ด Code 128 ของรหัส e-coupon สำหรับเครื่องสแกน POS แบบ 1 มิติ (keyboard wedge)
//   - encode รหัสตามที่เก็บไว้ตรง ๆ (เช่น 9XP-B6MW) — สแกนแล้วได้สตริงเดียวกับที่คนพิมพ์
//   - SVG ฝั่ง client (jsbarcode) ไม่สร้างรูปที่ server / ไม่ใช้บริการภายนอก
//   - ดำบนขาวล้วน · โมดูล 2px · สูง 64px · quiet zone 10 โมดูลต่อข้าง · ไม่มีตัวหนังสือใต้บาร์
//   - วาดตามขนาดจริง ไม่ย่อ/ขยาย (บาร์แคบจะเบลอ) — รหัส 8 ตัวกว้างราว 290px พอดีการ์ดบนจอ 360px
//   - used = จาง + ตราประทับทับ แบบเดียวกับ QR
import { useEffect, useRef } from "react";
import CouponStamp, { stampFadeClass } from "@/components/shared/CouponStamp";

const MODULE_PX = 2;
const QUIET_MODULES = 10;

export default function CouponBarcode({ value, status = "unused" }) {
  const svgRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // โหลดเฉพาะร้านที่เปิดบาร์โค้ด ไม่เพิ่มขนาดหน้าให้ทุกคน
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (cancelled || !svgRef.current) return;
      JsBarcode(svgRef.current, value, {
        format: "CODE128", // auto subset
        width: MODULE_PX,
        height: 64,
        margin: QUIET_MODULES * MODULE_PX,
        displayValue: false,
        background: "#ffffff",
        lineColor: "#000000",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        data-testid="coupon-barcode"
        data-value={value}
        data-status={status}
        className="relative bg-white"
      >
        <div className={stampFadeClass(status)}>
          <svg
            ref={svgRef}
            role="img"
            aria-label={`บาร์โค้ด ${value}`}
            style={{ display: "block", maxWidth: "none", shapeRendering: "crispEdges" }}
          />
        </div>
        <CouponStamp status={status} />
      </div>
      <p className="text-[12px] text-[color:var(--gray)]">สำหรับเครื่องสแกน POS ของร้าน</p>
    </div>
  );
}
