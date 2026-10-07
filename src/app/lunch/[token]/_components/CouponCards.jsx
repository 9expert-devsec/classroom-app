"use client";

// src/app/lunch/[token]/_components/CouponCards.jsx
//
// การ์ดคูปองหลังยืนยัน (หน้าตาตาม mockup) — ใช้ทั้งหน้าขอบคุณและหน้าสแกนซ้ำ
//   ร้าน stock   -> CounterCard (ไปรับคูปองกระดาษที่ Counter) — ไม่ poll
//   ร้านอื่น      -> ECouponCard (แสดง QR + รหัสที่ร้าน)
// ข้อมูลทั้งหมดมาจาก session.order — ไม่มีชื่อสำรอง
//
// C2: ECouponCard มี QR ของ "รหัสเปล่า ๆ" (ไม่ใช่ token/URL) + poll สถานะ
//     ร้านกดใช้แล้ว -> QR จาง + ตราประทับ "ใช้แล้ว" + บรรทัด "ใช้แล้ว เวลา hh:mm"
import { Ticket } from "lucide-react";
import CouponCode from "./CouponCode";
import LunchQrCode from "@/components/shared/LunchQrCode";
import useCouponStatus from "./useCouponStatus";

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

function ECouponCard({ order, dateLabel, token }) {
  const live = useCouponStatus(token, order.coupon);
  const rows = [
    ["ชื่อ", order.holderName],
    ["ชื่อเล่น", order.nickname],
    ["ห้อง", order.roomName],
    ["วันที่", dateLabel],
  ];
  return (
    <div className="relative" data-testid="ecoupon-card">
      {/* รอยปรุ */}
      <span className="absolute -left-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f8fafd]" />
      <span className="absolute -right-2.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full bg-[#f8fafd]" />
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="bg-[#2486ff] px-4 py-2.5 text-center text-[13px] font-bold tracking-[0.2em] text-white">
          E-COUPON
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-4 text-base">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <span className="font-medium text-slate-600">{k}</span>
              <span className="break-words text-right font-semibold text-[#0d1b2a]">
                {v || "-"}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-dashed border-black/10" />
        <div className="flex flex-col items-center gap-2 px-4 py-4">
          {/* QR = รหัสเปล่า ๆ เท่านั้น ร้านสแกนแล้วได้ 9XP-XXXX เหมือนพิมพ์เอง */}
          <LunchQrCode
            value={order.couponCode}
            size={168}
            status={live.state === "used" ? "used" : "unused"}
            className="p-2"
          />
          <CouponCode code={order.couponCode} />
          {live.state === "used" ? (
            <p
              data-testid="coupon-used-line"
              className="text-[14px] font-semibold text-[#c2453e]"
            >
              ใช้แล้ว เวลา {hmBkk(live.usedAt) || "-"} น.
            </p>
          ) : null}
          {live.polling && live.lastUpdated ? (
            <p data-testid="coupon-updated-line" className="text-[11px] text-slate-400">
              อัปเดตล่าสุด {hmBkk(live.lastUpdated, true)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CounterCard({ order }) {
  return (
    <div
      data-testid="counter-card"
      className="rounded-2xl bg-[#2486ff]/[0.08] p-4 ring-1 ring-[#2486ff]/20"
    >
      {/* คำแนะนำหลักของหน้า — ตัวใหญ่ เข้ม เต็มความกว้างการ์ด */}
      <div
        data-testid="counter-instruction"
        className="flex gap-3 rounded-xl bg-white px-4 py-3.5 ring-2 ring-[#2486ff]/40"
      >
        <Ticket aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-[#005cff]" />
        <p className="min-w-0 text-base font-semibold leading-snug text-[#0d1b2a]">
          เมื่อถึงช่วงพักเบรก กรุณารับคูปองร้าน{" "}
          <span className="font-bold">{order.restaurantName}</span> กับเจ้าหน้าที่ที่ Counter
        </p>
      </div>
      <div className="mt-4 rounded-xl bg-white p-4 text-center shadow-sm">
        <div data-testid="counter-name" className="text-base font-medium text-[#0d1b2a]">
          <p>
            ชื่อ: <span className="font-semibold">{order.holderName}</span>
          </p>
          <p className="mt-0.5">
            ชื่อเล่น: <span className="font-semibold">{order.nickname}</span>
          </p>
        </div>
        <p className="mt-3 text-base font-medium text-slate-600">รหัสคูปองของท่าน</p>
        <div className="mt-1">
          <CouponCode code={order.couponCode} />
        </div>
      </div>
    </div>
  );
}

export default function CouponCard({ order, dateLabel, token }) {
  return order.isStock ? (
    <CounterCard order={order} />
  ) : (
    <ECouponCard order={order} dateLabel={dateLabel} token={token} />
  );
}
