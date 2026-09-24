"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeftRight, ImageOff } from "lucide-react";

import {
  readCart,
  writeCart,
  addLine,
  reconcile,
  cartTotals,
  canQuickAdd,
} from "@/lib/lunchCart.client";
import { LogoTile } from "../../_components/Shell";
import BudgetBar from "../../_components/BudgetBar";
import CountdownBanner from "../../_components/CountdownBanner";

/* ---------------- menu row ---------------- */

function MenuRow({ m, onAdd, onOpen }) {
  const out = m.unavailableToday;

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm",
        out ? "opacity-50" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={out}
        onClick={() => !out && onOpen(m)}
        className="flex flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
      >
        {m.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.image}
            alt={m.name}
            className="h-14 w-14 rounded-xl bg-slate-100 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#0d1b2a]">{m.name}</p>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {out ? "หมดวันนี้" : `${m.price} ฿`}
          </p>
        </div>
      </button>

      <button
        type="button"
        disabled={out}
        onClick={() => !out && onAdd(m)}
        aria-label={`เพิ่ม ${m.name}`}
        data-testid="add-button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2486ff] text-white shadow-sm transition hover:bg-[#005cff] active:scale-90 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ---------------- modals ---------------- */

function Sheet({ children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 px-4 pb-4">
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function SwitchModal({ current, target, onCancel, onConfirm }) {
  return (
    <Sheet>
      <div className="mb-3 flex items-center gap-3">
        <LogoTile src={target.logo} alt={target.name} size={44} />
        <h3 className="text-[17px] font-bold text-[#0d1b2a]">
          เปลี่ยนไปร้าน {target.name}?
        </h3>
      </div>
      <p className="text-[14px] leading-relaxed text-slate-500">
        รายการที่เลือกไว้จากร้าน {current.name} จะถูกล้างทั้งหมด
      </p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100 active:scale-[0.98]"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-11 flex-1 rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98]"
        >
          เปลี่ยนร้าน
        </button>
      </div>
    </Sheet>
  );
}

function PickShopSheet({ others, onPick, onCancel }) {
  return (
    <Sheet>
      <h3 className="text-[17px] font-bold text-[#0d1b2a]">เปลี่ยนร้าน</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {others.map((r) => {
          const blocked = r.state !== "open";
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => !blocked && onPick(r)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl border border-black/5 p-3 text-left transition",
                  blocked
                    ? "cursor-not-allowed bg-slate-50 opacity-50"
                    : "bg-white hover:border-[#2486ff]/40 active:scale-[0.99]",
                ].join(" ")}
              >
                <LogoTile src={r.logo} alt={r.name} size={36} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#0d1b2a]">
                  {r.name}
                </span>
                {blocked ? (
                  <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                    {r.state === "closed" ? "ปิดวันนี้" : "คูปองหมด"}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 h-11 w-full rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100"
      >
        ยกเลิก
      </button>
    </Sheet>
  );
}

function NoOrderModal({ restaurant, budget, cartCount, busy, error, onCancel, onConfirm }) {
  return (
    <Sheet>
      <h3 className="text-[18px] font-bold text-[#0d1b2a]">
        ไปสั่งอาหารที่ร้านเอง?
      </h3>
      <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
        ท่านจะใช้คูปองมูลค่า {budget} บาทสั่งอาหารที่ร้าน {restaurant.name}{" "}
        ด้วยตัวเอง เมื่อยืนยันแล้วจะแก้ไขเองไม่ได้
      </p>
      {cartCount > 0 ? (
        <p className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]">
          รายการในตะกร้า {cartCount} รายการจะถูกล้าง
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-[#c2453e]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#c2453e]">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-11 flex-1 rounded-xl text-[15px] font-medium text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-11 flex-1 rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "กำลังบันทึก..." : "ยืนยัน"}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------------- page ---------------- */

export default function MenuClient({
  token,
  restaurant,
  others,
  budget,
  windowInfo,
  deadlineLabel,
  categories,
  menus,
}) {
  const router = useRouter();

  const [cart, setCart] = useState({ lines: [], nickname: "", nicknameConfirmed: false });
  const [removedNotice, setRemovedNotice] = useState(0);
  const [activeCat, setActiveCat] = useState(categories[0]?.id || "");

  const [switchTarget, setSwitchTarget] = useState(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [noOrderOpen, setNoOrderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // โหลดตะกร้า + ตัดรายการที่ใช้ไม่ได้แล้วทิ้ง
  useEffect(() => {
    const stored = readCart(token);
    const forThisShop =
      stored.restaurantId === restaurant.id
        ? stored
        : { ...stored, restaurantId: restaurant.id, lines: [] };

    const { state, removed } = reconcile(forThisShop, menus);
    setCart(state);
    setRemovedNotice(removed);
    writeCart(token, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurant.id]);

  function persist(next) {
    setCart(next);
    writeCart(token, next);
  }

  const { count, total } = useMemo(
    () => cartTotals(cart, menus),
    [cart, menus],
  );

  const shown = useMemo(() => {
    if (!activeCat) return menus;
    // เมนูหนึ่งตัวโผล่ได้ทุกหมวดที่มันสังกัด
    return menus.filter((m) => (m.categoryIds || []).includes(activeCat));
  }, [menus, activeCat]);

  const openOthers = others.filter((r) => r.state === "open");

  function goDetail(m) {
    router.push(`/lunch/${token}/r/${restaurant.id}/m/${m.id}`);
  }

  function quickAdd(m) {
    // มีกลุ่มตัวเลือกที่บังคับ -> ต้องไปหน้ารายละเอียด
    if (!canQuickAdd(m)) {
      goDetail(m);
      return;
    }
    persist(addLine(cart, { menuId: m.id, qty: 1 }));
  }

  function requestSwitch(target) {
    setPickOpen(false);
    if ((cart.lines || []).length === 0) {
      doSwitch(target);
      return;
    }
    setSwitchTarget(target);
  }

  function doSwitch(target) {
    const next = { ...cart, restaurantId: target.id, lines: [] };
    writeCart(token, next);
    setSwitchTarget(null);
    router.push(`/lunch/${token}/r/${target.id}`);
  }

  async function confirmAtShop() {
    setBusy(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/lunch/${token}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          nickname: cart.nickname,
          restaurantId: restaurant.id,
          mode: "at_shop",
          lines: [],
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        writeCart(token, { ...cart, lines: [] });
        router.replace(`/lunch/${token}`);
        return;
      }
      if (res.status === 409 && data?.reason === "sold_out") {
        setNoOrderOpen(false);
        router.replace(`/lunch/${token}`);
        return;
      }
      if (res.status === 403) {
        router.refresh();
        return;
      }
      setSubmitError(data?.error || "ทำรายการไม่สำเร็จ");
    } catch {
      setSubmitError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const closing = windowInfo?.phase === "closing";

  return (
    <>
      <div className="sticky top-0 z-10">
        {/* แถบร้าน + ปุ่มเปลี่ยนร้าน */}
        <div className="flex items-center justify-between gap-2 border-b border-black/5 bg-white px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoTile src={restaurant.logo} alt={restaurant.name} size={34} />
            <span className="truncate text-[15px] font-bold text-[#0d1b2a]">
              {restaurant.name}
            </span>
          </div>

          {openOthers.length === 1 ? (
            <button
              type="button"
              onClick={() => requestSwitch(openOthers[0])}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#2486ff]/40 bg-white px-3 text-[12px] font-medium text-[#005cff] transition active:scale-[0.97]"
            >
              {openOthers[0].logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={openOthers[0].logo}
                  alt=""
                  className="h-4 w-4 rounded object-contain"
                />
              ) : null}
              เปลี่ยนเป็น {openOthers[0].name}
            </button>
          ) : others.length > 0 ? (
            <button
              type="button"
              onClick={() => setPickOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#2486ff]/40 bg-white px-3 text-[12px] font-medium text-[#005cff] transition active:scale-[0.97]"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              เปลี่ยนร้าน
            </button>
          ) : null}
        </div>

        {closing ? (
          <CountdownBanner
            secondsLeft={windowInfo.secondsLeft}
            deadlineLabel={deadlineLabel}
          />
        ) : null}

        <BudgetBar budget={budget} selected={total} />

        {categories.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-black/5 bg-[#f8fafd] px-4 py-2.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={[
                  "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition",
                  activeCat === c.id
                    ? "bg-[#2486ff] text-white shadow-sm"
                    : "bg-white text-slate-500 ring-1 ring-black/5",
                ].join(" ")}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-4 pb-6">
        {removedNotice > 0 ? (
          <p className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] text-[#b8720a]">
            มีบางรายการถูกนำออกเพราะไม่พร้อมจำหน่าย
          </p>
        ) : null}

        {shown.map((m) => (
          <MenuRow key={m.id} m={m} onAdd={quickAdd} onOpen={goDetail} />
        ))}

        {shown.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">
            ยังไม่มีเมนูในหมวดนี้
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setSubmitError("");
            setNoOrderOpen(true);
          }}
          className="mt-3 h-11 w-full rounded-xl border border-[#2486ff]/40 bg-white text-[14px] font-medium text-[#005cff] transition active:scale-[0.99]"
        >
          ไม่เลือกอาหารตอนนี้ (ไปสั่งที่ร้านเอง)
        </button>
      </div>

      {count > 0 ? (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-black/5 bg-white px-4 py-3">
          <div>
            <p className="text-[13px] text-slate-500">ตะกร้า {count} รายการ</p>
            <p className="text-[16px] font-bold text-[#0d1b2a]">{total} บาท</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/lunch/${token}/summary`)}
            className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.98]"
          >
            ดูสรุป
          </button>
        </div>
      ) : null}

      {switchTarget ? (
        <SwitchModal
          current={restaurant}
          target={switchTarget}
          onCancel={() => setSwitchTarget(null)}
          onConfirm={() => doSwitch(switchTarget)}
        />
      ) : null}

      {pickOpen ? (
        <PickShopSheet
          others={others}
          onPick={requestSwitch}
          onCancel={() => setPickOpen(false)}
        />
      ) : null}

      {noOrderOpen ? (
        <NoOrderModal
          restaurant={restaurant}
          budget={budget}
          cartCount={count}
          busy={busy}
          error={submitError}
          onCancel={() => setNoOrderOpen(false)}
          onConfirm={confirmAtShop}
        />
      ) : null}
    </>
  );
}
