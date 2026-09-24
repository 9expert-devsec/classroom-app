// src/app/lunch/[token]/_components/PlacedOrderView.jsx
//
// สรุปออเดอร์หลังยืนยันแล้ว — ยกโครงมาจาก stub ของ P3b แต่จัดสไตล์ตาม mockup
// P3f จะแทนที่ด้วยหน้าขอบคุณ + สแกนซ้ำ
import { LogoTile } from "./Shell";

const STATUS_LABEL = {
  ordered: "สั่งแล้ว",
  at_shop: "ไปสั่งเองที่ร้าน",
};

export default function PlacedOrderView({ session }) {
  const o = session.order;

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16c479]/10 text-3xl">
          ✓
        </div>
        <h1 className="mt-3 text-[19px] font-bold text-[#0d1b2a]">
          รับออเดอร์เรียบร้อย
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          {STATUS_LABEL[session.status] || session.status}
        </p>

        {o?.couponCode ? (
          <div className="mt-4 rounded-xl bg-[#f8fafd] px-4 py-3">
            <p className="text-[12px] text-slate-500">รหัสคูปอง</p>
            <p className="mt-0.5 text-[22px] font-bold tabular-nums tracking-wider text-[#0d1b2a]">
              {o.couponCode}
            </p>
            {o.isStock ? (
              <p className="mt-1 text-[12px] text-[#005cff]">
                รับคูปองที่ Counter
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {o ? (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <LogoTile src={o.restaurantLogo} alt={o.restaurantName} size={34} />
            <span className="text-[15px] font-bold text-[#0d1b2a]">
              {o.restaurantName}
            </span>
          </div>

          {(o.lines || []).length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {o.lines.map((l, i) => (
                <li
                  key={`${l.menuId}-${i}`}
                  className="flex items-start justify-between gap-3 border-b border-black/5 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] text-[#0d1b2a]">
                      {l.name} × {l.qty}
                    </p>
                    {(l.options || []).length > 0 ? (
                      <p className="mt-0.5 text-[12px] text-slate-400">
                        {l.options.map((x) => x.choiceName).join(" · ")}
                      </p>
                    ) : null}
                    {l.note ? (
                      <p className="mt-0.5 text-[12px] text-slate-400">
                        หมายเหตุ: {l.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[14px] tabular-nums text-slate-500">
                    {l.lineTotal} ฿
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[13px] text-slate-500">
              ไปสั่งอาหารเองที่ร้าน โดยใช้คูปองใบนี้
            </p>
          )}

          <div className="mt-3 border-t border-black/5 pt-3 text-[13px]">
            <div className="flex justify-between">
              <span className="text-slate-500">รวม</span>
              <span className="font-semibold text-[#0d1b2a]">
                {o.itemsTotal} บาท
              </span>
            </div>
            {o.overBudget > 0 ? (
              <div className="mt-1 flex justify-between text-[#b8720a]">
                <span>เกินงบ (ชำระเองที่ร้าน)</span>
                <span className="font-semibold">{o.overBudget} บาท</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-center text-[12px] text-slate-400">
        คุณ{session.learner?.fullName} · ห้อง {session.class?.room} ·{" "}
        {session.class?.dayYMD}
      </p>
    </div>
  );
}
