// src/app/lunch/[token]/_components/PlacedViews.jsx
//
// หลังยืนยันออเดอร์แล้ว (ordered / at_shop) — หน้าตาตาม mockup ข้อมูลจาก session.order
//   ThankYouView : มาจากการ submit (?done=1) — 4 แบบ: stock/e-coupon × order/at_shop
//   RescanView   : สแกน QR เดิมซ้ำ — ดูอย่างเดียว ไม่มีปุ่มพาไปสั่ง
import Image from "next/image";
import { Check, ImageOff, Info, Lock } from "lucide-react";

import { LogoTile, LOGO, LOGO_W, LOGO_H } from "./Shell";
import CouponCard from "./CouponCards";
import CollapsibleOrder from "./CollapsibleOrder";

function SuccessIcon() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#2486ff]/10">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2486ff] text-white">
        <Check aria-hidden="true" className="h-6 w-6" strokeWidth={3} />
      </div>
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

/* ---------------- thank-you ---------------- */

export function ThankYouView({ order, dateLabel }) {
  const atShop = order.mode === "at_shop";

  return (
    <div className="flex flex-col gap-5 px-4 py-6" data-testid="thank-you">
      <div className="text-center">
        <SuccessIcon />
        <h1 className="mt-3 text-[19px] font-bold text-[#0d1b2a]">
          บันทึกรายการเรียบร้อยแล้ว
        </h1>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Image src={LOGO} alt="9Expert" width={LOGO_W} height={LOGO_H} className="h-6 w-auto" />
        <span className="text-slate-300">|</span>
        <LogoTile src={order.restaurantLogo} alt={order.restaurantName} size={40} />
      </div>

      <CouponCard order={order} dateLabel={dateLabel} />

      {atShop ? (
        <InfoBox testId="at-shop-box">
          {order.isStock
            ? `ท่านเลือกไปสั่งอาหารที่ร้านเอง ใช้คูปองมูลค่า ${order.budget} บาทที่ร้าน ${order.restaurantName} · รับคูปองกับเจ้าหน้าที่ที่ Counter`
            : `ท่านเลือกไปสั่งอาหารที่ร้านเอง ใช้คูปองมูลค่า ${order.budget} บาท แสดงคูปองนี้ที่ร้าน`}
        </InfoBox>
      ) : (
        <>
          {!order.isStock ? (
            <p className="text-center text-[13px] text-slate-500">
              แสดงคูปองนี้ที่ร้านเมื่อไปรับอาหาร
            </p>
          ) : null}
          <CollapsibleOrder order={order} />
        </>
      )}

      <p className="text-center text-[12px] text-slate-400">
        สแกน QR เดิมอีกครั้งเพื่อดูรายการและรหัสคูปองได้ตลอด
      </p>
    </div>
  );
}

/* ---------------- re-scan (read-only) ---------------- */

export function RescanView({ order, dateLabel }) {
  const atShop = order.mode === "at_shop";

  return (
    <div className="flex flex-col gap-4 px-4 py-5" data-testid="rescan">
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
        <InfoBox testId="at-shop-box">ท่านเลือกไปสั่งอาหารที่ร้านเอง</InfoBox>
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
                  {(l.options || []).length ? (
                    <p className="mt-0.5 text-[12px] text-slate-400">
                      {l.options.map((o) => o.choiceName).join(", ")}
                    </p>
                  ) : null}
                  {l.note ? (
                    <p className="mt-0.5 break-words text-[12px] italic text-slate-400">
                      “{l.note}”
                    </p>
                  ) : null}
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
              <span>งบคูปอง</span>
              <span>−{order.budget} บาท</span>
            </div>
            {order.overBudget > 0 ? (
              <div className="mt-3 flex justify-between rounded-xl bg-[#d98a13]/10 px-3 py-2.5 text-[14px] font-semibold text-[#b8720a]">
                <span>ส่วนที่ต้องชำระเองที่ร้าน</span>
                <span>{order.overBudget} บาท</span>
              </div>
            ) : null}
          </div>
          <p className="-mt-2 px-1 text-[12px] leading-relaxed text-slate-400">
            ยังไม่รวม VAT ของร้าน ส่วนที่เกินงบ {order.budget} บาท (รวม VAT) ชำระเองที่ร้าน
          </p>
        </>
      )}

      <CouponCard order={order} dateLabel={dateLabel} />

      <div className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
        <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
          หากต้องการเปลี่ยนร้านหรือเปลี่ยนเมนู กรุณาติดต่อเจ้าหน้าที่ที่ Counter
        </p>
      </div>
    </div>
  );
}
