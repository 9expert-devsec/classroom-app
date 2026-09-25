// src/app/lunch/[token]/_components/CouponCards.jsx
//
// การ์ดคูปองหลังยืนยัน (หน้าตาตาม mockup) — ใช้ทั้งหน้าขอบคุณและหน้าสแกนซ้ำ
//   ร้าน stock   -> CounterCard (ไปรับคูปองกระดาษที่ Counter)
//   ร้านอื่น      -> ECouponCard (แสดงรหัสที่ร้าน)
// ข้อมูลทั้งหมดมาจาก session.order — ไม่มีชื่อสำรอง
import { Ticket } from "lucide-react";
import CouponCode from "./CouponCode";

function ECouponCard({ order, dateLabel }) {
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
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-4 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <span className="text-slate-400">{k}</span>
              <span className="break-words text-right font-medium text-[#0d1b2a]">
                {v || "-"}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-dashed border-black/10" />
        <div className="px-4 py-4">
          <CouponCode code={order.couponCode} />
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
      <div className="flex gap-2.5">
        <Ticket aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#2486ff]" />
        <p className="text-[14px] leading-relaxed text-[#0d1b2a]">
          เมื่อถึงช่วงพักเบรค กรุณารับคูปองร้าน {order.restaurantName} กับเจ้าหน้าที่ที่ Counter
        </p>
      </div>
      <div className="mt-4 rounded-xl bg-white p-4 text-center shadow-sm">
        <p className="text-[12px] text-slate-500">
          ชื่อ: {order.holderName} · ชื่อเล่น: {order.nickname}
        </p>
        <p className="mt-2 text-[12px] text-slate-400">รหัสคูปองของท่าน</p>
        <div className="mt-1">
          <CouponCode code={order.couponCode} />
        </div>
      </div>
    </div>
  );
}

export default function CouponCard({ order, dateLabel }) {
  return order.isStock ? (
    <CounterCard order={order} />
  ) : (
    <ECouponCard order={order} dateLabel={dateLabel} />
  );
}
