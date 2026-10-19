"use client";

// src/app/lunch/[token]/_components/CouponCards.jsx
//
// การ์ดคูปองหลังยืนยัน — ใช้ทั้งหน้าขอบคุณและหน้าสแกนซ้ำ
//   ร้าน stock   -> CounterCard (ไปรับคูปองกระดาษที่ Counter) — ไม่ poll
//   ร้านอื่น      -> ECouponCard (แสดง QR + รหัสที่ร้าน)
// ข้อมูลทั้งหมดมาจาก session.order — ไม่มีชื่อสำรอง
//
// C2: ECouponCard มี QR ของ "รหัสเปล่า ๆ" (ไม่ใช่ token/URL) + poll สถานะ
//     ลำดับ: หัว E-COUPON -> QR + รหัส + อัปเดตล่าสุด -> เส้นปรุ -> รายละเอียดผู้เรียน
//     ร้านกดใช้แล้ว -> QR จาง + ตราประทับ "ใช้แล้ว" + บรรทัด "ใช้แล้ว เวลา hh:mm"
// R4a: หน้าตาตาม CI — การ์ดขาวขอบ #DCE3EE, หัว navy (ป้าย lime ซ้าย / คำอธิบายขวา),
//      เส้นปรุคั่นส่วนรหัสกับแถวรายละเอียด (ชื่อ / ชื่อเล่น / ห้อง / วันที่)
import { Ticket } from "lucide-react";
import CouponCode from "./CouponCode";
import LunchQrCode from "@/components/shared/LunchQrCode";
import useCouponStatus from "./useCouponStatus";
import CouponBarcode from "./CouponBarcode";

const NAVY = "#0d1b2a";

function hmBkk(d, withSeconds = false) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function CardShell({ label, caption, testId, children }) {
  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-[20px] border border-[#dce3ee] bg-white shadow-[0_4px_16px_rgba(13,27,42,0.06)]"
    >
      <div className="flex items-center justify-between gap-3 bg-[color:var(--navy)] px-4 py-3">
        <span className="text-[14px] font-bold tracking-[0.16em] text-[color:var(--lime)]">
          {label}
        </span>
        <span className="text-right text-[13px] text-[#f8fafd]">{caption}</span>
      </div>
      {children}
    </div>
  );
}

/** เส้นปรุ — notched = มีรอยปรุครึ่งวงกลมสองข้าง (การ์ด overflow-hidden ตัดให้เหลือครึ่ง) */
function DashedDivider({ notched = false }) {
  return (
    <div className="relative">
      {notched ? (
        <>
          <span className="absolute -left-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full border border-[#dce3ee] bg-[color:var(--bg)]" />
          <span className="absolute -right-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full border border-[#dce3ee] bg-[color:var(--bg)]" />
        </>
      ) : null}
      <div className="border-t-2 border-dashed border-[#dce3ee]" />
    </div>
  );
}

function DetailRows({ order, dateLabel, testId }) {
  const rows = [
    ["ชื่อ", order.holderName],
    ["ชื่อเล่น", order.nickname],
    ["ห้อง", order.roomName],
    ["วันที่", dateLabel],
  ];
  return (
    <div
      data-testid={testId}
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-4 py-4 text-[15px]"
    >
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-[color:var(--gray)]">{k}</span>
          <span className="break-words text-right font-bold text-[color:var(--navy)]">
            {v || "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

function ECouponCard({ order, dateLabel, token }) {
  const live = useCouponStatus(token, order.coupon);
  // poll แล้วใช้ค่าล่าสุด ยังไม่ได้ poll ใช้ค่าจาก server render
  const showBarcode = live.showBarcode ?? !!order.showBarcode;
  return (
    <CardShell testId="ecoupon-card" label="E-COUPON" caption="แสดงที่ร้าน">
      <div className="flex flex-col items-center gap-2 px-4 pb-4 pt-3">
        {/* QR = รหัสเปล่า ๆ เท่านั้น ร้านสแกนแล้วได้ 9XP-XXXX เหมือนพิมพ์เอง */}
        <LunchQrCode
          value={order.couponCode}
          size={168}
          status={live.state === "used" ? "used" : "unused"}
          fgColor={NAVY}
          className="p-2"
        />
        {/* บาร์โค้ด POS: เฉพาะ e-coupon ที่ร้านเปิดไว้ · ใช้แล้ว = ตราประทับทับ · อื่น ๆ ไม่แสดง */}
        {showBarcode && (live.state === "unused" || live.state === "used") ? (
          <CouponBarcode
            value={order.couponCode}
            status={live.state === "used" ? "used" : "unused"}
          />
        ) : null}
        <CouponCode code={order.couponCode} size="xl" />
        {/* ร้าน stock ที่ออก e-coupon แทนตอนคูปองกระดาษหมด */}
        {order.stockFallback ? (
          <p
            data-testid="stock-fallback-line"
            className="text-center text-[13px] font-semibold text-[color:var(--navy)]"
          >
            แสดงคูปองนี้ที่ร้านได้เลย ไม่ต้องรับคูปองกระดาษที่ Counter
          </p>
        ) : null}
        {live.state === "used" ? (
          <p
            data-testid="coupon-used-line"
            className="text-[14px] font-semibold text-[#c2453e]"
          >
            ใช้แล้ว เวลา {hmBkk(live.usedAt) || "-"} น.
          </p>
        ) : null}
        {live.polling && live.lastUpdated ? (
          <p data-testid="coupon-updated-line" className="text-[12px] text-[color:var(--gray)]">
            อัปเดตล่าสุด {hmBkk(live.lastUpdated, true)}
          </p>
        ) : null}
      </div>
      <DashedDivider notched />
      <DetailRows order={order} dateLabel={dateLabel} />
    </CardShell>
  );
}

function CounterCard({ order, dateLabel }) {
  return (
    <CardShell testId="counter-card" label="COUPON" caption="รับคูปองกระดาษที่ Counter">
      <div className="flex flex-col gap-4 p-4">
        <div
          data-testid="counter-instruction"
          className="flex gap-3 rounded-[14px] bg-[color:var(--blue-tint)] px-4 py-3.5"
        >
          <Ticket aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--blue-deep)]" />
          <p className="min-w-0 text-[15px] font-semibold leading-snug text-[color:var(--navy)]">
            รับคูปองร้าน {order.restaurantName} ได้ที่เจ้าหน้าที่ ที่ Counter
          </p>
        </div>
        <div className="text-center">
          <p className="text-[13px] text-[color:var(--gray)]">รหัสคูปองของท่าน</p>
          <div className="mt-1">
            <CouponCode code={order.couponCode} />
          </div>
        </div>
      </div>
      <DashedDivider />
      <DetailRows order={order} dateLabel={dateLabel} testId="counter-name" />
    </CardShell>
  );
}

export default function CouponCard({ order, dateLabel, token }) {
  return order.isStock ? (
    <CounterCard order={order} dateLabel={dateLabel} />
  ) : (
    <ECouponCard order={order} dateLabel={dateLabel} token={token} />
  );
}
