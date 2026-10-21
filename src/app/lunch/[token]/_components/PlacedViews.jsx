// src/app/lunch/[token]/_components/PlacedViews.jsx
//
// หลังยืนยันออเดอร์แล้ว (ordered / at_shop) — หน้าตาตาม mockup ข้อมูลจาก session.order
//   ThankYouView : มาจากการ submit (?done=1) — 4 แบบ: stock/e-coupon × order/at_shop
//   RescanView   : สแกน QR เดิมซ้ำ — ดูอย่างเดียว ไม่มีปุ่มพาไปสั่ง
import Image from "next/image";
import { ArrowRightLeft, Check, ImageOff, Info, Lock } from "lucide-react";

import { LogoTile, LOGO, LOGO_W, LOGO_H } from "./Shell";
import CouponCard from "./CouponCards";
import CollapsibleOrder from "./CollapsibleOrder";
import OptionLines, { groupsFromOrderLine } from "./OptionLines";

function SuccessIcon() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--blue-tint)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--blue)] text-white">
        <Check aria-hidden="true" className="h-6 w-6" strokeWidth={3} />
      </div>
    </div>
  );
}

// โลโก้ร้าน 52px มุม 14 (หัวหน้าขอบคุณ R4a)
function ShopTile({ src, alt }) {
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

// สั่งที่ร้านเอง (R4a B / C) — รูปแบบ + มูลค่าคูปอง + บรรทัดอธิบาย
function AtShopCard({ order }) {
  const note = order.isStock
    ? `สั่งอาหารที่ร้าน ${order.restaurantName} ด้วยตัวเอง ส่วนที่เกิน ${order.budget} บาท ชำระเพิ่มที่ร้าน`
    : `แสดงคูปองนี้ให้พนักงานสแกนที่ร้าน ส่วนที่เกิน ${order.budget} บาท ชำระเพิ่มที่ร้าน`;
  return (
    <div
      data-testid="at-shop-box"
      className="rounded-2xl border border-[#dce3ee] bg-white px-4 py-3.5 text-[15px]"
    >
      <div className="flex justify-between gap-3">
        <span className="text-[color:var(--gray)]">รูปแบบ</span>
        <span className="font-bold text-[color:var(--navy)]">สั่งที่ร้านเอง</span>
      </div>
      <div className="mt-2 flex justify-between gap-3">
        <span className="text-[color:var(--gray)]">คูปองมูลค่า</span>
        <span className="font-bold text-[color:var(--navy)]">{order.budget} บาท</span>
      </div>
      <p className="mt-3 border-t border-[#dce3ee] pt-3 text-[13px] leading-relaxed text-[color:var(--gray)]">
        {note}
      </p>
    </div>
  );
}

function InfoBox({ children, testId }) {
  return (
    <p
      data-testid={testId}
      className="rounded-2xl bg-[#48b0ff]/10 px-4 py-3.5 text-center text-[14px] leading-relaxed text-[#0d1b2a]"
    >
      {children}
    </p>
  );
}

// R3: เจ้าหน้าที่โยกไปร้านอื่น — ประกาศด้านบนของหน้าคูปอง
function ReassignedNotice({ order }) {
  if (!order?.reassigned) return null;
  return (
    <div
      data-testid="reassigned-notice"
      className="flex gap-3 rounded-2xl border border-[#d98a13]/40 bg-[#d98a13]/10 px-4 py-3.5"
    >
      <ArrowRightLeft aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#b8720a]" />
      <div className="min-w-0 text-[14px] leading-relaxed text-[#0d1b2a]">
        <p className="font-bold">ท่านถูกย้ายไปร้าน {order.restaurantName}</p>
        <p>
          {order.isStock
            ? "กรุณารับคูปองกระดาษที่ Counter แล้วไปสั่งที่ร้านโดยใช้คูปองนี้"
            : "กรุณาไปสั่งที่ร้านโดยใช้คูปองนี้"}
          {order.reassigned.fromRestaurantName
            ? ` (คูปองร้าน ${order.reassigned.fromRestaurantName} เดิมใช้ไม่ได้แล้ว)`
            : ""}
        </p>
      </div>
    </div>
  );
}

/* ---------------- thank-you ---------------- */

export function ThankYouView({ order, dateLabel, token }) {
  const atShop = order.mode === "at_shop";

  return (
    <div className="flex flex-col gap-5 px-4 py-6" data-testid="thank-you">
      <ReassignedNotice order={order} />
      <div className="text-center">
        <SuccessIcon />
        <h1 className="mt-3 text-[21px] font-bold text-[color:var(--navy)]">
          บันทึกรายการเรียบร้อยแล้ว
        </h1>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Image src={LOGO} alt="9Expert" width={LOGO_W} height={LOGO_H} className="h-6 w-auto" />
        <span aria-hidden="true" className="h-8 w-px bg-[color:var(--gray-light)]" />
        <ShopTile src={order.restaurantLogo} alt={order.restaurantName} />
      </div>

      <CouponCard order={order} dateLabel={dateLabel} token={token} />

      {atShop ? <AtShopCard order={order} /> : <CollapsibleOrder order={order} />}
    </div>
  );
}

/* ---------------- re-scan (read-only) ---------------- */

export function RescanView({ order, dateLabel, token }) {
  const atShop = order.mode === "at_shop";

  return (
    <div className="flex flex-col gap-4 px-4 py-5" data-testid="rescan">
      <ReassignedNotice order={order} />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-[19px] font-bold text-[#0d1b2a]">
          <Lock className="h-5 w-5 text-slate-400" />
          รายการของท่าน
        </h1>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-500">
          ยืนยันแล้ว
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <LogoTile src={order.restaurantLogo} alt={order.restaurantName} size={44} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#0d1b2a]">{order.restaurantName}</p>
          <p className="text-[12px] text-slate-500">
            {order.holderName} · ชื่อเล่น {order.nickname}
          </p>
        </div>
      </div>

      {atShop ? (
        <InfoBox testId="at-shop-box">ท่านเลือกสั่งที่ร้านเอง</InfoBox>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {(order.lines || []).map((l, i) => (
              <div key={i} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image}
                    alt={l.name}
                    className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                    <ImageOff className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="text-[14px] font-medium text-[#0d1b2a]">{l.name}</p>
                    <span className="shrink-0 text-[13px] text-slate-500">×{l.qty}</span>
                  </div>
                  <OptionLines groups={groupsFromOrderLine(l)} note={l.note} className="mt-0.5" />
                </div>
                <span className="self-center text-[14px] font-semibold text-[#0d1b2a]">
                  {l.lineTotal}฿
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex justify-between text-[14px] text-[#0d1b2a]">
              <span>ราคารวม</span>
              <span className="font-semibold">{order.itemsTotal} บาท</span>
            </div>
            <div className="mt-2 flex justify-between text-[14px] text-slate-500">
              <span>ใช้งบคูปอง</span>
              <span>−{Math.min(order.itemsTotal || 0, order.budget)} บาท</span>
            </div>
            {order.overBudget > 0 ? (
              <div className="mt-3 flex justify-between rounded-xl bg-[#d98a13]/10 px-3 py-2.5 text-[14px] font-semibold text-[#b8720a]">
                <span>ส่วนที่ต้องชำระเพิ่มที่ร้าน</span>
                <span>{order.overBudget} บาท</span>
              </div>
            ) : null}
          </div>
          <p className="-mt-2 px-1 text-[12px] leading-relaxed text-slate-400">
            ราคาดังกล่าว ยังไม่ใช่ราคาสุทธิ ส่วนที่เกินงบ {order.budget} บาทชำระเองที่ร้าน
          </p>
        </>
      )}

      <CouponCard order={order} dateLabel={dateLabel} token={token} />

      <div className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
        <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
          หากต้องการเปลี่ยนร้านหรือเปลี่ยนเมนู กรุณาติดต่อเจ้าหน้าที่ที่ Counter
        </p>
      </div>
    </div>
  );
}
