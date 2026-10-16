"use client";

// หน้าสรุป "สั่งที่ร้านเอง" (at_shop) — หน้าเดียวของทั้ง 2 ทาง
//   from=menu : มาจากการ์ด "สั่งที่ร้านเอง" ในหน้าเมนู (ก่อนเส้นตาย) -> ย้อนกลับไปหน้าเมนูร้านนั้น
//   อื่น ๆ     : C1 แบบย่อหลังเส้นตาย (ชื่อเล่น -> เลือกร้าน -> หน้านี้) -> ย้อนกลับไปหน้าเลือกร้าน
// r1h: ยืนยันครั้งเดียว — ชีต "ล้างรายการที่เลือกไว้?" (ClearCartSheet) อยู่ก่อนหน้านี้ ถ้าตะกร้ามีของ
//   "ยืนยัน" ที่นี่ส่งออเดอร์เลย ไม่มีชีตซ้ำ / ตะกร้าถูกล้างหลัง POST สำเร็จเท่านั้น
//   เข้าหน้านี้ตรง ๆ (URL / ย้อน-ไปหน้า) ทั้งที่ตะกร้ามีของและยังไม่ได้ยืนยันชุดนี้
//   (?confirmed= ไม่ตรงกับ cartSignature ตอนนี้) -> แสดงแถบเตือนสีส้มอีกครั้ง ไม่ให้ข้ามคำเตือน
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
import ShellScroll from "../../_components/ShellScroll";
import CountdownBanner from "../../_components/CountdownBanner";
import { ShopTypeChip } from "../../_components/ShopChips";
import { postAtShop, cartSignature } from "../../_components/ClearCartSheet";

export default function ShortSummaryClient({
  token,
  restaurant,
  restaurants = [],
  sessionNickname,
  budget,
  windowInfo,
  deadlineLabel,
  from = "",
  confirmed = "",
}) {
  const router = useRouter();
  const backHref = from === "menu" ? `/lunch/${token}/r/${restaurant.id}` : `/lunch/${token}`;

  // ตะกร้าใน storage แบบ external store: null = ยังไม่รู้ (server / hydration)
  const raw = useCartRaw(token);
  const ready = raw !== null;
  const stored = useMemo(() => parseCart(raw), [raw]);

  const nickname =
    sessionNickname || (stored.nicknameConfirmed ? stored.nickname : "");
  const cartCount = (stored.lines || []).reduce((s, l) => s + (l.qty || 0), 0);
  const cartShopName =
    restaurants.find((r) => r.id === stored.restaurantId)?.name || restaurant.name;
  // เตือนเฉพาะเมื่อยังไม่ได้ยืนยันล้างตะกร้าชุดนี้ในชีตก่อนหน้า
  const warnClear = cartCount > 0 && confirmed !== cartSignature(stored);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // ยังไม่ได้ยืนยันชื่อเล่น -> กลับไปกรอกที่หน้าแรกก่อน
  useEffect(() => {
    if (ready && !nickname) router.replace(`/lunch/${token}`);
  }, [ready, nickname, router, token]);

  async function confirm() {
    if (busy) return; // กันกดซ้ำ
    setBusy(true);
    setError("");
    let leaving = false;
    try {
      const r = await postAtShop({
        token,
        requestId: newRequestId(),
        nickname,
        restaurantId: restaurant.id,
      });

      // สำเร็จ / replay / สั่งไปแล้ว (409 already_ordered) -> ล้างตะกร้าตอนนี้เท่านั้น
      if (r.next === "done") {
        leaving = true;
        clearCartLines(token, readCart(token));
        router.replace(`/lunch/${token}?done=1`);
        return;
      }
      if (r.next === "sold_out") {
        leaving = true;
        router.replace(`/lunch/${token}?notice=sold_out`);
        return;
      }
      if (r.next === "refresh") {
        leaving = true;
        router.refresh();
        return;
      }
      setError(r.message);
    } catch (err) {
      console.error("short at_shop submit failed:", err);
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      // กำลังออกจากหน้า -> ค้างสถานะ "กำลังบันทึก..." ไว้ ไม่ให้กดซ้ำระหว่างเปลี่ยนหน้า
      if (!leaving) setBusy(false);
    }
  }

  if (!ready || !nickname) return null;

  const closing = windowInfo?.phase === "closing";

  return (
    <>
      {/* แถบบน (ไม่เลื่อน): ใกล้ปิดรับ -> หัวร้าน */}
      <div className="z-10 flex-none">
        {closing ? (
          <CountdownBanner secondsLeft={windowInfo.secondsLeft} deadlineLabel={deadlineLabel} />
        ) : null}
        <div className="flex items-center gap-3 border-b border-black/[.08] bg-white px-4 py-3">
          <LogoTile src={restaurant.logo} alt={restaurant.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[color:var(--navy)]">
              {restaurant.name}
            </p>
            <p className="text-[12px] text-[color:var(--gray)]">ชื่อเล่น {nickname}</p>
          </div>
          <div className="shrink-0">
            <ShopTypeChip r={restaurant} />
          </div>
        </div>
      </div>

      <ShellScroll data-testid="short-summary">
        <div className="flex flex-col gap-3 px-4 py-4 pb-6">
          <h1 className="text-[19px] font-bold text-[color:var(--navy)]">สรุปรายการ</h1>

          <div className="rounded-2xl border border-black/[.08] bg-white p-4">
            <div className="flex justify-between gap-3 text-[14px] text-[color:var(--navy)]">
              <span className="text-[color:var(--gray)]">รูปแบบ</span>
              <span className="font-semibold">สั่งที่ร้านเอง</span>
            </div>
            <div className="mt-2 flex justify-between gap-3 text-[14px] text-[color:var(--navy)]">
              <span className="text-[color:var(--gray)]">คูปองมูลค่า</span>
              <span className="font-semibold">{budget} บาท</span>
            </div>
          </div>
          <p className="-mt-1 px-1 text-[13px] text-[color:var(--gray)]">
            เมื่อยืนยันแล้วจะแก้ไขเองไม่ได้
          </p>

          {warnClear ? (
            <p
              data-testid="short-clear-warning"
              className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]"
            >
              รายการที่เลือกไว้ {cartCount} รายการจาก {cartShopName} จะถูกล้างทั้งหมด
            </p>
          ) : null}

          {error ? (
            <p
              data-testid="short-error"
              className="rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]"
            >
              {error}
            </p>
          ) : null}

          <div className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
            <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
              ราคาดังกล่าว ยังไม่ใช่ราคาสุทธิ ส่วนที่เกินงบ {budget} บาท
              ท่านต้องชำระเองที่ร้าน
            </p>
          </div>
        </div>
      </ShellScroll>

      <StickyBottom className="flex gap-3">
        <button
          type="button"
          onClick={() => router.replace(backHref)}
          disabled={busy}
          className="h-12 flex-1 rounded-xl border border-[color:var(--gray-light)] bg-white text-[15px] font-semibold text-[color:var(--navy)] transition active:scale-[0.98] disabled:opacity-50"
        >
          ย้อนกลับ
        </button>
        <button
          type="button"
          data-testid="short-confirm"
          onClick={confirm}
          disabled={busy}
          className="h-12 flex-[1.4] rounded-xl bg-[color:var(--blue)] text-[15px] font-bold text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </StickyBottom>
    </>
  );
}
