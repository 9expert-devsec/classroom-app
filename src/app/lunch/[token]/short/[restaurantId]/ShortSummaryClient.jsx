"use client";

// C1: สรุปแบบย่อ (at_shop) — ชื่อเล่น / ร้าน / งบ / หมายเหตุราคา แล้วยืนยัน
// ใช้ชีตยืนยันและการ POST ตัวเดียวกับปุ่ม "ไปสั่งที่ร้านเอง" ของหน้าเมนู
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import {
  readCart,
  parseCart,
  useCartRaw,
  newRequestId,
  clearCartLines,
} from "@/lib/lunchCart.client";
import { LogoTile, StickyBottom } from "../../_components/Shell";
import NoOrderModal, { postAtShop } from "../../_components/NoOrderModal";

export default function ShortSummaryClient({
  token,
  restaurant,
  sessionNickname,
  budget,
}) {
  const router = useRouter();

  // ตะกร้าใน storage แบบ external store: null = ยังไม่รู้ (server / hydration)
  const raw = useCartRaw(token);
  const ready = raw !== null;
  const stored = useMemo(() => parseCart(raw), [raw]);

  const nickname =
    sessionNickname || (stored.nicknameConfirmed ? stored.nickname : "");
  const cartCount = (stored.lines || []).reduce((s, l) => s + (l.qty || 0), 0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ยังไม่ได้ยืนยันชื่อเล่น -> กลับไปกรอกที่หน้าแรกก่อน
  useEffect(() => {
    if (ready && !nickname) router.replace(`/lunch/${token}`);
  }, [ready, nickname, router, token]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const r = await postAtShop({
        token,
        requestId: newRequestId(),
        nickname,
        restaurantId: restaurant.id,
      });

      if (r.next === "done") {
        clearCartLines(token, readCart(token));
        router.replace(`/lunch/${token}?done=1`);
        return;
      }
      if (r.next === "sold_out") {
        setConfirmOpen(false);
        router.replace(`/lunch/${token}?notice=sold_out`);
        return;
      }
      if (r.next === "refresh") {
        router.refresh();
        return;
      }
      setError(r.message);
    } catch (err) {
      console.error("short at_shop submit failed:", err);
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !nickname) return null;

  return (
    <>
      <div className="flex-1" data-testid="short-summary">
        <div className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3">
          <LogoTile src={restaurant.logo} alt={restaurant.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#0d1b2a]">
              {restaurant.name}
            </p>
            <p className="text-[12px] text-slate-500">ชื่อเล่น {nickname}</p>
          </div>
          {restaurant.isStock ? (
            <span className="shrink-0 rounded-full bg-[#48b0ff]/15 px-2 py-0.5 text-[11px] font-medium text-[#005cff]">
              รับคูปองที่ Counter
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 pb-6">
          <h1 className="text-[19px] font-bold text-[#0d1b2a]">สรุปรายการ</h1>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex justify-between text-[14px] text-[#0d1b2a]">
              <span>รูปแบบ</span>
              <span className="font-semibold">ไปสั่งอาหารที่ร้านเอง</span>
            </div>
            <div className="mt-2 flex justify-between text-[14px] text-slate-500">
              <span>งบคูปอง</span>
              <span>{budget} บาท</span>
            </div>
          </div>

          <div className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
            <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
              ราคาดังกล่าว ยังไม่ใช่ราคาสุทธิ ส่วนที่เกินงบ {budget} บาท
              ท่านต้องชำระเองที่ร้าน
            </p>
          </div>
        </div>
      </div>

      <StickyBottom className="flex gap-3">
        <button
          type="button"
          onClick={() => router.replace(`/lunch/${token}`)}
          className="h-12 flex-1 rounded-xl border border-black/10 bg-white text-[15px] font-medium text-[#0d1b2a] transition active:scale-[0.98]"
        >
          ย้อนกลับ
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirmOpen(true);
          }}
          className="h-12 flex-[1.4] rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98]"
        >
          ยืนยัน
        </button>
      </StickyBottom>

      {confirmOpen ? (
        <NoOrderModal
          restaurant={restaurant}
          budget={budget}
          cartCount={cartCount}
          busy={busy}
          error={error}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
}
