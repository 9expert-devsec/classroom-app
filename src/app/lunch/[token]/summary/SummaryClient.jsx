"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Info, ShoppingCart, Trash2 } from "lucide-react";

import {
  readCart,
  writeCart,
  reconcile,
  cartTotals,
  unitPriceOf,
  choiceNamesOf,
  setLineQty,
  removeLine,
  ensureRequestId,
  clearCartLines,
  switchRestaurant,
  MIN_QTY,
  MAX_QTY,
} from "@/lib/lunchCart.client";
import { LogoTile, StickyBottom } from "../_components/Shell";
import CountdownBanner from "../_components/CountdownBanner";
import QtyStepper from "../_components/QtyStepper";

const NETWORK_ERROR = "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง";
const GENERIC_ERROR = "เกิดข้อผิดพลาด กรุณาลองใหม่";

/* ---------------- final confirm modal ---------------- */

function FinalConfirmModal({ restaurant, count, total, budget, busy, error, onEdit, onConfirm }) {
  const overage = Math.max(0, total - budget);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-4">
      <div
        data-testid="confirm-modal"
        className="w-full max-w-[480px] rounded-2xl bg-white p-5 shadow-xl"
      >
        <h3 className="text-[18px] font-bold text-[#0d1b2a]">ยืนยันการสั่งอาหาร?</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          เมื่อยืนยันแล้วจะแก้ไขเองไม่ได้ หากต้องการเปลี่ยนร้านหรือเมนู
          กรุณาติดต่อเจ้าหน้าที่ที่ Counter
        </p>
        <div className="mt-4 rounded-xl bg-[#f8fafd] px-3.5 py-3 text-[13px] font-medium text-[#0d1b2a]">
          {restaurant.name} · {count} รายการ · {total} บาท
          {overage > 0 ? (
            <span className="text-[#b8720a]"> (ชำระเพิ่ม {overage} บาท)</span>
          ) : null}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
          ยังไม่รวม VAT ของร้าน ส่วนที่เกินงบ {budget} บาท (รวม VAT) ชำระเองที่ร้าน
        </p>
        {error ? (
          <p className="mt-3 rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="h-11 flex-1 rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
          >
            กลับไปแก้ไข
          </button>
          <button
            type="button"
            data-testid="confirm-submit"
            onClick={onConfirm}
            disabled={busy}
            className="h-11 flex-1 rounded-xl bg-[#d4f73f] text-[15px] font-semibold text-[#0d1b2a] shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "กำลังบันทึก…" : "ยืนยัน"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- line ---------------- */

function LineCard({ line, menu, bad, onQty, onRemove }) {
  const names = choiceNamesOf(line, menu);
  const lineTotal = unitPriceOf(line, menu) * line.qty;

  return (
    <div
      data-testid="summary-line"
      className={[
        "flex gap-3 rounded-2xl bg-white p-3 shadow-sm",
        bad ? "ring-2 ring-[#c2453e]" : "",
      ].join(" ")}
    >
      {menu.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={menu.image}
          alt={menu.name}
          className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
          <ImageOff className="h-5 w-5" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-medium text-[#0d1b2a]">{menu.name}</p>
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบ"
            className="shrink-0 text-slate-300 transition hover:text-[#c2453e]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {names.length ? (
          <p className="mt-0.5 text-[12px] text-slate-400">{names.join(", ")}</p>
        ) : null}
        {line.note ? (
          <p className="mt-0.5 break-words text-[12px] italic text-slate-400">
            “{line.note}”
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <QtyStepper
            qty={line.qty}
            onChange={onQty}
            min={MIN_QTY}
            max={MAX_QTY}
            size="sm"
          />
          <span
            data-testid="line-total"
            className="text-[15px] font-semibold text-[#0d1b2a]"
          >
            {lineTotal}฿
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function SummaryClient({
  token,
  restaurants,
  sessionNickname,
  budget,
  windowInfo,
  deadlineLabel,
}) {
  const router = useRouter();

  const [cart, setCart] = useState(null);
  const [nickname, setNickname] = useState("");
  const [menus, setMenus] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [removedNotice, setRemovedNotice] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [pageError, setPageError] = useState("");
  const [badLine, setBadLine] = useState(null);

  // ตะกร้า + ชื่อเล่น
  useEffect(() => {
    const stored = readCart(token);
    const nick =
      sessionNickname ||
      (stored.nicknameConfirmed && stored.nickname ? stored.nickname : "");
    if (!nick) {
      router.replace(`/lunch/${token}`);
      return;
    }
    setNickname(nick);
    setCart(stored);
  }, [token, sessionNickname, router]);

  const restaurantId = cart?.restaurantId || "";
  const restaurant = restaurants.find((r) => r.id === restaurantId) || null;
  const hasLines = (cart?.lines || []).length > 0;

  // เมนู DTO ของร้านในตะกร้า แล้ว reconcile ด้วยราคาปัจจุบัน
  useEffect(() => {
    if (!restaurantId || !restaurant) return;
    let cancelled = false;
    setLoadError("");

    (async () => {
      let res;
      try {
        res = await fetch(
          `/api/lunch/${token}/menu?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        );
      } catch {
        if (!cancelled) setLoadError(NETWORK_ERROR);
        return;
      }
      try {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(GENERIC_ERROR);
          return;
        }
        const { state, removed } = reconcile(readCart(token), data.menus || []);
        writeCart(token, state);
        setCart(state);
        setMenus(data.menus || []);
        if (removed > 0) setRemovedNotice(removed);
      } catch (err) {
        console.error("summary menu load failed:", err);
        if (!cancelled) setLoadError(GENERIC_ERROR);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurantId, !!restaurant, reloadKey]);

  const menuById = useMemo(
    () => new Map((menus || []).map((m) => [m.id, m])),
    [menus],
  );
  const { count, total } = useMemo(
    () => (cart && menus ? cartTotals(cart, menus) : { count: 0, total: 0 }),
    [cart, menus],
  );
  const overage = Math.max(0, total - budget);

  function persist(next) {
    setCart(next);
    writeCart(token, next);
    setBadLine(null);
  }

  const menuHref = restaurant ? `/lunch/${token}/r/${restaurant.id}` : `/lunch/${token}`;

  async function submit() {
    setBusy(true);
    setModalError("");
    let leaving = false;

    try {
      // requestId เก็บในตะกร้า: กดซ้ำ / reload / ลองใหม่หลังเน็ตหลุด ใช้ id เดิม
      const withId = ensureRequestId(readCart(token));
      writeCart(token, withId);
      setCart(withId);

      const body = JSON.stringify({
        requestId: withId.requestId,
        nickname,
        restaurantId: withId.restaurantId,
        mode: "order",
        lines: withId.lines.map((l) => ({
          menuId: l.menuId,
          qty: l.qty,
          choices: l.choices || [],
          note: l.note || "",
        })),
      });

      // ครอบเฉพาะ fetch: "เชื่อมต่อไม่สำเร็จ" = เน็ตมีปัญหาจริงเท่านั้น
      let res;
      try {
        res = await fetch(`/api/lunch/${token}/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch {
        setModalError(NETWORK_ERROR);
        return;
      }
      const data = await res.json().catch(() => ({}));

      // สำเร็จ / replay / สั่งไปแล้ว -> ล้างตะกร้า ไปหน้าขอบคุณ
      if (res.ok || (res.status === 409 && data?.reason === "already_ordered")) {
        clearCartLines(token, readCart(token));
        leaving = true;
        router.replace(`/lunch/${token}?done=1`);
        return;
      }

      // คูปองหมด / ร้านปิดรับ -> ล้างร้าน + รายการ แล้วกลับไปเลือกร้านใหม่
      if (
        res.status === 409 &&
        (data?.reason === "sold_out" || data?.reason === "restaurant_unavailable")
      ) {
        setConfirmOpen(false);
        setPageError(data?.error || GENERIC_ERROR);
        writeCart(token, switchRestaurant(readCart(token), ""));
        leaving = true;
        router.replace(`/lunch/${token}?notice=${data.reason}`);
        return;
      }

      // ข้อมูลไม่ผ่าน (เมนูหมด/ราคาไม่ได้ตั้ง/ตัวเลือกเปลี่ยน ฯลฯ)
      if (res.status === 422) {
        setConfirmOpen(false);
        setPageError(data?.error || GENERIC_ERROR);
        setBadLine(Number.isInteger(data?.lineIndex) ? data.lineIndex : null);
        setReloadKey((k) => k + 1);
        router.refresh();
        return;
      }

      // ปิดรับแล้ว -> ให้ด่านตรวจฝั่ง server พาไปหน้าปิดรับ
      if (res.status === 403) {
        leaving = true;
        router.refresh();
        return;
      }

      setModalError(data?.error || GENERIC_ERROR);
    } catch (err) {
      console.error("order submit failed:", err);
      setModalError(GENERIC_ERROR);
    } finally {
      if (!leaving) setBusy(false);
    }
  }

  const closing = windowInfo?.phase === "closing";

  /* ---------- render ---------- */

  const top = closing ? (
    <div className="sticky top-0 z-10">
      <CountdownBanner secondsLeft={windowInfo.secondsLeft} deadlineLabel={deadlineLabel} />
    </div>
  ) : null;

  if (!cart) return null;

  if (!restaurant || !hasLines) {
    return (
      <>
        {top}
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center">
          {pageError ? (
            <p className="rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]">
              {pageError}
            </p>
          ) : null}
          {removedNotice > 0 ? (
            <p className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] text-[#b8720a]">
              มีบางรายการถูกนำออกเพราะไม่พร้อมจำหน่าย
            </p>
          ) : null}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/60 text-slate-500">
            <ShoppingCart aria-hidden="true" className="h-8 w-8" />
          </div>
          <h1 className="text-[18px] font-bold text-[#0d1b2a]">ยังไม่มีรายการในตะกร้า</h1>
          <button
            type="button"
            onClick={() => router.replace(menuHref)}
            className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold text-white shadow-sm"
          >
            {restaurant ? "กลับไปหน้าเมนู" : "กลับไปเลือกร้าน"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {top}

      <div className="flex-1">
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
          {pageError ? (
            <p
              data-testid="page-error"
              className="rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]"
            >
              {pageError}
            </p>
          ) : null}
          {removedNotice > 0 ? (
            <p className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] text-[#b8720a]">
              มีบางรายการถูกนำออกเพราะไม่พร้อมจำหน่าย
            </p>
          ) : null}
          {loadError ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] text-[#c2453e]">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                ลองใหม่
              </button>
            </div>
          ) : null}

          {!menus ? (
            loadError ? null : (
              <p className="py-6 text-center text-[13px] text-slate-400">กำลังโหลด…</p>
            )
          ) : (
            <>
              {cart.lines.map((l, i) => {
                const m = menuById.get(String(l.menuId));
                if (!m) return null;
                return (
                  <LineCard
                    key={l.lineKey}
                    line={l}
                    menu={m}
                    bad={badLine === i}
                    onQty={(q) => persist(setLineQty(cart, l.lineKey, q))}
                    onRemove={() => persist(removeLine(cart, l.lineKey))}
                  />
                );
              })}

              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex justify-between text-[14px] text-[#0d1b2a]">
                  <span>ราคารวม</span>
                  <span data-testid="summary-total" className="font-semibold">
                    {total} บาท
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-[14px] text-slate-500">
                  <span>งบคูปอง</span>
                  <span>−{budget} บาท</span>
                </div>
                {overage > 0 ? (
                  <div className="mt-3 flex justify-between rounded-xl bg-[#d98a13]/10 px-3 py-2.5 text-[14px] font-semibold text-[#b8720a]">
                    <span>ส่วนที่ต้องชำระเองที่ร้าน</span>
                    <span>{overage} บาท</span>
                  </div>
                ) : null}
              </div>

              <div className="flex gap-2.5 rounded-2xl bg-[#48b0ff]/10 p-3.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#005cff]" />
                <p className="text-[13px] leading-relaxed text-[#0d1b2a]">
                  ราคานี้ยังไม่รวม VAT ของทางร้าน แม้ยอดไม่เกิน {budget} บาท
                  หากร้านคิด VAT เพิ่ม ส่วนที่เกิน {budget} บาทท่านต้องชำระเองที่ร้าน
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <StickyBottom className="flex gap-3">
        <button
          type="button"
          onClick={() => router.replace(menuHref)}
          className="h-12 flex-1 rounded-xl border border-black/10 bg-white text-[15px] font-medium text-[#0d1b2a] transition active:scale-[0.98]"
        >
          ย้อนกลับ
        </button>
        <button
          type="button"
          disabled={!menus || count === 0}
          onClick={() => {
            setModalError("");
            setConfirmOpen(true);
          }}
          className="h-12 flex-[1.4] rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          ยืนยันการสั่งอาหาร
        </button>
      </StickyBottom>

      {confirmOpen ? (
        <FinalConfirmModal
          restaurant={restaurant}
          count={count}
          total={total}
          budget={budget}
          busy={busy}
          error={modalError}
          onEdit={() => setConfirmOpen(false)}
          onConfirm={submit}
        />
      ) : null}
    </>
  );
}
