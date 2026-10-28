"use client";

// src/app/lunch/[token]/_components/StockThankYou.jsx
//
// CC1: หน้าขอบคุณของคูปองกระดาษ (ร้าน stock) — ขั้นตอน "ไปรับคูปองที่ Counter" ต้องเด่นที่สุดบนหน้า
// CC3b: หน้าสแกนซ้ำ (ไม่มี ?done=1) ใช้คอมโพเนนต์นี้เหมือนกัน
// CC4: หน้าตาตาม mockup (prompts/ref/coupon-counter-mockup.png)
//   หัว: เช็คฟ้า + วงแหวน (CC5: ไม่มีขีดประกาย) · หัวเรื่องใหญ่ · คำอธิบายเทา · โลโก้ 9Expert | โลโก้ร้าน
//   การ์ดเหลือง (hero, CC5: ไม่มีขอบ ใช้เงานุ่ม): ภาพประกอบซ้าย (ชิดขอบ อยู่ใต้การ์ดรหัส) + "รับคูปองที่ / Counter" ขวา
//     -> การ์ดในขาวขอบประ: รหัสใน pill (CC7: ไม่มีปุ่มคัดลอก) · อัปเดตล่าสุด
//   การ์ด "ข้อมูลคูปองของท่าน" -> การ์ด "รายละเอียดคูปอง" -> แถบหมายเหตุ (หรือรายการที่สั่ง)
//   ส่งมอบแล้ว (CC8) = หัว "รับคูปองแล้ว" ที่เดียว · hero เขียว = ไปสั่งที่ร้าน + ยื่นคูปองกระดาษ · รหัสเป็นบรรทัดอ้างอิงเล็ก ๆ
// Counter เป็นของ 9Expert ไม่ใช่ของร้าน — ห้ามเขียนว่า "เจ้าหน้าที่ร้าน"
import Image from "next/image";
import { Check, FileText, Store, Utensils } from "lucide-react";

import { LOGO, LOGO_W, LOGO_H } from "./Shell";
import CollapsibleOrder from "./CollapsibleOrder";
import useCouponStatus from "./useCouponStatus";

function hmsBkk(d) {
  return new Date(d).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

// โลโก้ร้าน มุม 14 (ค่าเริ่มต้น 52px — หน้า e-coupon ใช้ขนาดนี้)
export function ShopTile({ src, alt, size = 52 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#dce3ee] bg-white"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl text-[color:var(--gray-light)]">?</span>
      )}
    </div>
  );
}

const CARD = "rounded-2xl border border-[#dce3ee] bg-white shadow-[0_2px_10px_rgba(13,27,42,0.04)]";

/* ---------------- หัวหน้า ---------------- */

// CC5: วงแหวนรอบเช็คอย่างเดียว ไม่มีขีดประกาย
function HeaderCheck({ tone }) {
  const green = tone === "green";
  return (
    <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${green ? "bg-emerald-100" : "bg-[#e3efff]"}`}>
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full text-white ${green ? "bg-emerald-600" : "bg-[color:var(--blue)]"}`}
      >
        <Check aria-hidden="true" className="h-7 w-7" strokeWidth={3} />
      </div>
    </div>
  );
}

function PageHeader({ order, received }) {
  return (
    <div className="text-center">
      <HeaderCheck tone={received ? "green" : "blue"} />
      <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-[color:var(--navy)]">
        {received ? "รับคูปองแล้ว" : "บันทึกรายการเรียบร้อยแล้ว"}
      </h1>
      <p data-testid="counter-pending-line" className="mt-1 text-[14px] text-[color:var(--gray)]">
        {received
          ? "คูปองกระดาษอยู่กับคุณแล้ว"
          : "กรุณารับคูปองกับเจ้าหน้าที่ตามขั้นตอนด้านล่าง"}
      </p>
      <div className="mt-3 flex items-center justify-center gap-4">
        <Image src={LOGO} alt="9Expert" width={LOGO_W} height={LOGO_H} className="h-6 w-auto" />
        <span aria-hidden="true" className="h-8 w-px bg-[#c9d3e1]" />
        <ShopTile src={order.restaurantLogo} alt={order.restaurantName} size={46} />
      </div>
    </div>
  );
}

/* ---------------- รหัสคูปอง ---------------- */

// รหัสตามที่เก็บไว้เป๊ะ ๆ (มีขีดได้ ไม่มีช่องว่าง) — ไม่หั่นกลุ่มแบบ CouponCode
// ขนาดตัวอักษรคำนวณจากความกว้างของ pill (cqw) ให้อยู่บรรทัดเดียวเสมอ: 1 ตัว ≈ 0.6em + ระยะห่าง
// ระยะห่าง 0.18em (ตาม mockup) — รหัสยาว (> 12 ตัว) ลดเหลือ 0.04em ให้ตัวอักษรใหญ่ขึ้น
// sidePad = ช่องว่างซ้าย+ขวาของ pill รวมกัน (CC7: ไม่มีปุ่มคัดลอกแล้ว เว้นแค่ขอบ)
function CodePill({ code, maxPx, sidePad }) {
  const len = Math.max(String(code || "").length, 1);
  const track = len > 12 ? 0.04 : 0.18;
  return (
    <div className="[container-type:inline-size]">
      <div
        className="relative rounded-2xl bg-[#eef3fa] py-3"
        style={{ paddingLeft: sidePad / 2, paddingRight: sidePad / 2 }}
      >
        <p
          data-testid="coupon-code"
          className="select-all whitespace-nowrap text-center font-mono font-bold leading-tight text-[#0d1b2a]"
          // paddingLeft = ระยะห่างท้ายตัวสุดท้ายของ tracking ให้รหัสอยู่กลางจริง
          style={{
            fontSize: `min(${maxPx}px, calc((100cqw - ${sidePad}px) / ${(len * (0.6 + track)).toFixed(2)}))`,
            letterSpacing: `${track}em`,
            paddingLeft: `${track}em`,
          }}
        >
          {code}
        </p>
      </div>
    </div>
  );
}

/* ---------------- การ์ดเหลือง / เขียว ---------------- */

// CC3a: ภาพประกอบ (พื้นโปร่งใส 1536×1024)
// CC5: ภาพใหญ่ขึ้น (~194px ที่จอ 360) ชิดซ้ายล่าง ล้นขอบซ้าย อยู่ "ใต้" การ์ดรหัส
//      การ์ดรหัสเลื่อนขึ้นทับส่วนล่างของภาพ ~26% (CARD_OVERLAP) + ขอบล่างภาพจางด้วย mask (ไม่ใช่ blur)
//      คอลัมน์หัวเรื่องเว้นแถบล่างเท่า CARD_OVERLAP ไว้ — การ์ดไม่ทับตัวหนังสือ
// CC6: ขอบล่างภาพจางยาวขึ้น (mask เดียวกันทั้ง unprefixed/-webkit-) + แถบไล่สีทับ (HERO_LEFT) อีกชั้น
//      พื้น hero ซีกซ้าย 58% เป็นสีทึบ HERO_LEFT (ภาพกว้างไม่เกิน ~55% ที่ 360px, ~50% ที่ 480px)
//      แถบไล่สีจึงจบที่สีเดียวกับพื้นพอดี ไม่เห็นเป็นกรอบ · hero overflow-hidden + มุมมนเดียวกัน ตัดภาพที่ล้นซ้าย
const COUNTER_IMG = "/images/lunch/counter-handout.png";
const CARD_OVERLAP = 34;
const IMG_FADE =
  "linear-gradient(to bottom, rgba(0,0,0,1) 58%, rgba(0,0,0,0.95) 68%, rgba(0,0,0,0.75) 78%, rgba(0,0,0,0.45) 88%, rgba(0,0,0,0.15) 95%, rgba(0,0,0,0) 100%)";
const HERO_LEFT = "255,243,204"; // #FFF3CC
const HERO_BG = `linear-gradient(to right, rgb(${HERO_LEFT}) 0%, rgb(${HERO_LEFT}) 58%, #ffe7a3 100%)`;
const IMG_OVERLAY = `linear-gradient(to bottom, rgba(${HERO_LEFT},0) 0%, rgba(${HERO_LEFT},0.35) 45%, rgba(${HERO_LEFT},0.75) 75%, rgba(${HERO_LEFT},1) 100%)`;
const HERO_SHADOW = "shadow-[0_6px_20px_-6px_rgba(196,132,12,0.22),0_1px_3px_rgba(196,132,12,0.10)]";

function PendingHero({ order, updatedLabel }) {
  return (
    <div
      data-testid="counter-step"
      className={`relative overflow-hidden rounded-[22px] ${HERO_SHADOW}`}
      style={{ background: HERO_BG }}
    >
      {/* สูงอย่างน้อยเท่าภาพ (กว้าง 54vw สัดส่วน 3:2) — ภาพไม่ถูกตัดด้านบน */}
      <div className="relative min-h-[clamp(113px,36vw,160px)]">
        <div
          data-testid="counter-image-wrap"
          className="pointer-events-none absolute bottom-0 left-[-14px] w-[clamp(170px,54vw,240px)] overflow-hidden"
        >
          <Image
            src={COUNTER_IMG}
            alt="ยื่นหน้าจอนี้ให้เจ้าหน้าที่ที่ Counter"
            width={1536}
            height={1024}
            sizes="240px"
            priority
            className="block h-auto w-full"
            style={{ maskImage: IMG_FADE, WebkitMaskImage: IMG_FADE }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-14"
            style={{ background: IMG_OVERLAY }}
          />
        </div>
        <div
          className="relative ml-auto w-[48%] min-w-0 pl-1 pr-3 pt-3"
          style={{ paddingBottom: CARD_OVERLAP + 8 }}
        >
          {/* CC7: วงกลมร้านซ้าย + คอลัมน์ข้อความ 2 บรรทัด ("รับคูปองที่" / "Counter") ชิดซ้ายเส้นเดียวกัน
              ขนาดตัวอักษรคิดจากความกว้างคอลัมน์ (cqw) ลบวงกลม 36px + ช่องไฟ 8px — จอ 320px ก็ไม่ล้น
              "Counter" กว้าง ≈ 4em, "รับคูปองที่" ≈ 4.2em (เล็กกว่า Counter ~22%) */}
          <div className="flex items-center gap-2 [container-type:inline-size]">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[#1f1300]"
            >
              <Store className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <h2 className="min-w-0 whitespace-nowrap font-extrabold leading-tight text-[#0d1b2a]">
              <span className="block" style={{ fontSize: "min(25px, calc((100cqw - 44px) / 5.1))" }}>
                รับคูปองที่
              </span>
              <span className="block" style={{ fontSize: "min(32px, calc((100cqw - 44px) / 4))" }}>
                Counter
              </span>
            </h2>
          </div>
          {/* บรรทัดอธิบายชิดซ้ายแนววงกลม — ใต้คอลัมน์ข้อความจะเหลือ ~97px ที่จอ 360 ตัดคำไม่สวย */}
          <p className="mt-1.5 text-[12.5px] leading-snug text-[#3b2a06]">
            ติดต่อเจ้าหน้าที่ 9Expert
            <br />
            เพื่อรับคูปองร้าน {order.restaurantName}
          </p>
        </div>
      </div>

      <div
        className="relative z-10 mx-2.5 rounded-2xl border-2 border-dashed border-amber-300 bg-white px-3 pb-3 pt-2.5"
        style={{ marginTop: -CARD_OVERLAP }}
      >
        <p className="text-center text-[13px] font-semibold text-[color:var(--navy)]">แสดงรหัสนี้แก่เจ้าหน้าที่</p>
        <div className="mt-2">
          <CodePill code={order.couponCode} maxPx={34} sidePad={24} />
        </div>
      </div>
      <p
        data-testid="coupon-updated-line"
        className="min-h-[28px] py-1.5 text-center text-[11px] text-[#7a5b12]"
      >
        {updatedLabel ? `อัปเดตล่าสุด ${updatedLabel}` : ""}
      </p>
    </div>
  );
}

// CC1/CC4/CC8: Counter ส่งมอบแล้ว — โทนเขียว ไม่มีภาพประกอบ ไม่มีการ์ดรหัส
function ReceivedHero({ order }) {
  return (
    <div
      data-testid="counter-received"
      className="rounded-[22px] bg-gradient-to-br from-[#ecfdf3] via-[#d9f7e6] to-[#c4f0d8] p-3 shadow-[0_6px_20px_-6px_rgba(16,140,80,0.22),0_1px_3px_rgba(16,140,80,0.10)]"
    >
      {/* CC8: hero = ขั้นต่อไป (ไปสั่งที่ร้าน) — "รับคูปองแล้ว" อยู่ที่หัวหน้าที่เดียว
          โครงเดียวกับหัวเรื่องของ pending: วงกลมร้านซ้าย + คอลัมน์ 2 บรรทัดชิดซ้ายเส้นเดียวกัน
          ชื่อร้านยาวตัดบรรทัดได้ (ไม่ nowrap) */}
      <div className="flex items-center gap-2 px-1 pt-1">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
        >
          <Store className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h2 className="min-w-0 leading-tight text-emerald-950">
          <span className="block text-[14px] font-semibold text-emerald-800">ไปสั่งอาหารที่ร้าน</span>
          <span className="block break-words text-[21px] font-extrabold">{order.restaurantName}</span>
        </h2>
      </div>
      <p className="mt-3 px-1 text-[15px] font-bold text-emerald-900">ยื่นคูปองกระดาษให้พนักงานร้าน</p>
      <p className="mt-0.5 px-1 text-[13px] text-emerald-800/80">ไม่ต้องแสดงหน้าจอนี้ที่ร้าน</p>
      {/* CC8: รหัสเป็นแค่บรรทัดอ้างอิง ไม่ต้องยื่นให้ใคร — ขนาดปกติ ตามที่เก็บไว้ ตัดบรรทัดเฉพาะเมื่อยาวเกินบรรทัด */}
      <p className="mt-3 border-t border-emerald-300/60 px-1 pt-2.5 text-[13px] text-emerald-800/80">
        รหัสคูปอง:{" "}
        <span data-testid="coupon-code" className="break-all font-mono text-[14px] font-semibold text-emerald-950">
          {order.couponCode}
        </span>
      </p>
    </div>
  );
}

/* ---------------- การ์ดข้อมูล ---------------- */

function InfoCard({ icon: Icon, title, rows, testId }) {
  return (
    <div data-testid={testId} className={`${CARD} px-4 pb-2 pt-3.5`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--blue-tint)] text-[color:var(--blue)]">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <h3 className="text-[16px] font-bold text-[color:var(--navy)]">{title}</h3>
      </div>
      <div className="mt-1.5 divide-y divide-dashed divide-[#dce3ee]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px]">
            <span className="shrink-0 text-[color:var(--gray)]">{k}</span>
            <span className="min-w-0 break-words text-right font-bold text-[color:var(--navy)]">{v || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteBar({ children }) {
  return (
    <div data-testid="at-shop-box" className="flex items-center gap-3 rounded-2xl bg-[#e8f1ff] px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--blue)] text-[14px] font-extrabold leading-none text-white"
      >
        !
      </span>
      <p className="min-w-0 text-[13px] leading-snug text-[#0d1b2a]">{children}</p>
    </div>
  );
}

/* ---------------- หน้า ---------------- */

export default function StockThankYouView({ order, dateLabel, token, notice = null }) {
  const atShop = order.mode === "at_shop";
  // R3: poll เพื่อให้หน้าที่เปิดค้างไว้ไปคูปองใบใหม่เมื่อถูกโยกร้าน/ยกเลิก
  // CC1: + รู้ว่า Counter ส่งมอบแล้ว (หยุด poll เมื่อส่งมอบ)
  const live = useCouponStatus(token, { state: "watch", handedOut: order.handedOut });
  const received = live.handedOut;
  const updatedLabel = live.polling && live.lastUpdated ? hmsBkk(live.lastUpdated) : "";

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-5" data-testid="thank-you">
      {notice}
      <PageHeader order={order} received={received} />

      {received ? <ReceivedHero order={order} /> : <PendingHero order={order} updatedLabel={updatedLabel} />}

      <InfoCard
        testId="counter-name"
        icon={FileText}
        title="ข้อมูลคูปองของท่าน"
        rows={[
          ["ชื่อ", order.holderName],
          ["ชื่อเล่น", order.nickname],
          ["ห้อง", order.roomName],
          ["วันที่", dateLabel],
        ]}
      />
      <InfoCard
        testId="value-card"
        icon={Utensils}
        title="รายละเอียดคูปอง"
        rows={[
          ["รูปแบบ", atShop ? "สั่งที่ร้านเอง" : "สั่งล่วงหน้า"],
          ["คูปองมูลค่า", `${order.budget} บาท`],
        ]}
      />

      {atShop ? (
        <NoteBar>
          สั่งอาหารที่ร้าน {order.restaurantName} ด้วยตนเอง ส่วนที่เกิน {order.budget} บาท ชำระเพิ่มที่ร้าน
        </NoteBar>
      ) : (
        <CollapsibleOrder order={order} className="shadow-[0_2px_10px_rgba(13,27,42,0.04)]" />
      )}
    </div>
  );
}
