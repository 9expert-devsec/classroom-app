"use client";

// src/app/lunch/[token]/_components/StockThankYou.jsx
//
// CC1: หน้าขอบคุณของคูปองกระดาษ (ร้าน stock) — ขั้นตอน "ไปรับคูปองที่ Counter" ต้องเด่นที่สุดบนหน้า
//   หัวสำเร็จลดความเด่นลง + บรรทัดเตือนว่ายังไม่เสร็จ · โลโก้ 9Expert อย่างเดียว
//   บล็อกสีเหลืองอำพัน = ขั้นตอนถัดไป + รหัสให้เจ้าหน้าที่ 9Expert (Counter ไม่ใช่ของร้าน)
//   การ์ดมูลค่า (โลโก้ร้าน) -> การ์ดผู้เรียน -> หมายเหตุสั่งที่ร้านเอง
// หน้าสแกนซ้ำยังใช้ CounterCard เดิม (CouponCards.jsx)
import Image from "next/image";
import { CalendarDays, Check, ConciergeBell, DoorOpen, Info, Smile, User } from "lucide-react";

import { LOGO, LOGO_W, LOGO_H } from "./Shell";
import CollapsibleOrder from "./CollapsibleOrder";
import useCouponStatus from "./useCouponStatus";

// โลโก้ร้าน 52px มุม 14
export function ShopTile({ src, alt }) {
  return (
    <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl text-[color:var(--gray-light)]">?</span>
      )}
    </div>
  );
}

// ไอคอนใหญ่ของบล็อกขั้นตอนถัดไป — จุดเดียวที่ต้องแก้ถ้าจะเปลี่ยนเป็นรูปภาพ
function CounterIcon() {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/70 text-amber-700">
      <ConciergeBell aria-hidden="true" className="h-9 w-9" strokeWidth={1.75} />
    </div>
  );
}

// รหัสตามที่เก็บไว้เป๊ะ ๆ (มีขีดได้ ไม่มีช่องว่าง) — ไม่หั่นกลุ่มแบบ CouponCode
// รหัสยาว (> 12 ตัว) ย่อตัวอักษรให้อยู่บรรทัดเดียวที่จอ 360px
function RawCode({ code, className, longClassName }) {
  const long = String(code || "").length > 12;
  return (
    <p
      data-testid="coupon-code"
      className={`select-all break-all text-center font-mono font-bold tracking-wider text-[#0d1b2a] ${long ? longClassName : className}`}
    >
      {code}
    </p>
  );
}

function CounterStepBlock({ order }) {
  return (
    <div data-testid="counter-step" className="rounded-[20px] border-2 border-amber-300 bg-amber-50 p-4">
      <span className="inline-block rounded-full bg-amber-200 px-3 py-1 text-[13px] font-bold text-amber-900">
        ขั้นตอนถัดไป
      </span>
      <div className="mt-3 flex items-center gap-3">
        <CounterIcon />
        <h2 className="min-w-0 break-words text-[22px] font-bold leading-snug text-amber-900">
          รับคูปองร้าน {order.restaurantName} ที่ Counter
        </h2>
      </div>
      <div className="mt-4 rounded-2xl border border-amber-200 bg-white px-3 py-4">
        <p className="text-center text-[14px] font-semibold text-amber-900">
          แสดงรหัสนี้แก่เจ้าหน้าที่ 9Expert
        </p>
        <RawCode
          code={order.couponCode}
          className="mt-1.5 text-[clamp(22px,8vw,32px)] leading-snug"
          longClassName="mt-1.5 text-[clamp(17px,5.4vw,24px)] leading-snug"
        />
      </div>
    </div>
  );
}

function ValueCard({ order }) {
  return (
    <div
      data-testid="value-card"
      className="flex items-center gap-4 rounded-2xl border border-[#dce3ee] bg-white px-4 py-3.5"
    >
      <ShopTile src={order.restaurantLogo} alt={order.restaurantName} />
      <div className="min-w-0">
        <p className="text-[14px] text-[color:var(--gray)]">มูลค่าคูปอง</p>
        <p className="text-[20px] font-bold text-[color:var(--navy)]">{order.budget} บาท</p>
      </div>
    </div>
  );
}

function LearnerCard({ order, dateLabel }) {
  const rows = [
    [User, "ชื่อ", order.holderName],
    [Smile, "ชื่อเล่น", order.nickname],
    [DoorOpen, "ห้อง", order.roomName],
    [CalendarDays, "วันที่", dateLabel],
  ];
  return (
    <div
      data-testid="counter-name"
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 rounded-2xl border border-[#dce3ee] bg-white px-4 py-4 text-[15px]"
    >
      {rows.map(([Icon, k, v]) => (
        <div key={k} className="contents">
          <span className="flex items-center gap-2 text-[color:var(--gray)]">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {k}
          </span>
          <span className="break-words text-right font-bold text-[color:var(--navy)]">{v || "-"}</span>
        </div>
      ))}
    </div>
  );
}

export default function StockThankYouView({ order, dateLabel, token, notice = null }) {
  const atShop = order.mode === "at_shop";
  // R3: poll เพื่อให้หน้าที่เปิดค้างไว้ไปคูปองใบใหม่เมื่อถูกโยกร้าน/ยกเลิก
  useCouponStatus(token, { state: "watch" });

  return (
    <div className="flex flex-col gap-4 px-4 py-6" data-testid="thank-you">
      {notice}
      <div className="text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--blue)] text-white">
          <Check aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
        </div>
        <h1 className="mt-2 text-[19px] font-bold text-[color:var(--navy)]">บันทึกรายการเรียบร้อยแล้ว</h1>
        <p data-testid="counter-pending-line" className="mt-1 text-[15px] font-semibold text-amber-800">
          ยังไม่เสร็จ ต้องรับคูปองที่ Counter ก่อน
        </p>
      </div>

      <div className="flex justify-center">
        <Image src={LOGO} alt="9Expert" width={LOGO_W} height={LOGO_H} className="h-6 w-auto" />
      </div>

      <CounterStepBlock order={order} />
      <ValueCard order={order} />
      <LearnerCard order={order} dateLabel={dateLabel} />

      {atShop ? (
        <div data-testid="at-shop-box" className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 px-4 py-3.5">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
          <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
            สั่งอาหารที่ร้าน {order.restaurantName} ด้วยตนเอง ส่วนที่เกิน {order.budget} บาท ชำระเพิ่มที่ร้าน
          </p>
        </div>
      ) : (
        <CollapsibleOrder order={order} />
      )}
    </div>
  );
}
