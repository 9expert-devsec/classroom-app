"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowLeftRight, ImageOff } from "lucide-react";

import {
  readCart,
  writeCart,
  addLine,
  reconcile,
  cartTotals,
  canQuickAdd,
  newRequestId,
  switchRestaurant,
  enterRestaurant,
  clearCartLines,
} from "@/lib/lunchCart.client";
import { saveMenuScroll, takeMenuScroll, clearMenuScroll } from "@/lib/lunchScroll.client";
import { LogoTile, StickyBottom } from "../../_components/Shell";
import SwitchModal, { Sheet, CartConflictBanner } from "../../_components/SwitchModal";
import BudgetBar from "../../_components/BudgetBar";
import CountdownBanner from "../../_components/CountdownBanner";
import NoOrderModal, { postAtShop } from "../../_components/NoOrderModal";

/* ---------------- menu row ---------------- */

function MenuRow({ m, locked, onAdd, onOpen }) {
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
        disabled={out || locked}
        onClick={() => !out && !locked && onAdd(m)}
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

/* ---------------- sections ---------------- */

const OTHER_ID = "__other";

/**
 * ทุกหมวดเรียงตามลำดับที่แอดมินตั้ง แต่ละหมวดเป็น section ของตัวเอง
 * เมนูที่อยู่หลายหมวดโผล่ทุก section ที่มันสังกัด / หมวดที่ไม่มีเมนูไม่แสดง
 * เมนูที่ไม่มีหมวด -> section "อื่นๆ" ท้ายสุด
 * ร้านที่ไม่มีหมวดเลย -> section เดียวไม่มีหัว (เหมือนเดิมที่ไม่มีแถบหมวด)
 */
function buildSections(categories, menus) {
  const sections = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: menus.filter((m) => (m.categoryIds || []).includes(c.id)),
    }))
    .filter((s) => s.items.length > 0);

  const catIds = new Set(categories.map((c) => c.id));
  const orphans = menus.filter(
    (m) => !(m.categoryIds || []).some((id) => catIds.has(id)),
  );
  if (orphans.length > 0) {
    sections.push({
      id: OTHER_ID,
      name: sections.length > 0 ? "อื่นๆ" : "",
      items: orphans,
    });
  }
  return sections;
}

/** กล่องที่เลื่อนจริง (layout ของ lunch เป็น h-dvh overflow-y-auto ไม่ใช่ window) */
function scrollParentOf(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
  }
  return document.scrollingElement;
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

  // ตะกร้ามีรายการจากร้านอื่น (มาทางย้อนกลับ / พิมพ์ URL) -> ไม่แตะตะกร้า ถามก่อน
  const [conflict, setConflict] = useState(false);

  // โหลดตะกร้า + ตัดรายการที่ใช้ไม่ได้แล้วทิ้ง
  useEffect(() => {
    const stored = readCart(token);
    const { state: entered, conflict: other } = enterRestaurant(stored, restaurant.id);
    if (other) {
      // เมนูที่มีเป็นของร้านนี้ reconcile ไม่ได้ ไม่งั้นรายการของอีกร้านหายหมด
      setCart(stored);
      setConflict(true);
      return;
    }
    const { state, removed } = reconcile(entered, menus);
    setCart(state);
    setConflict(false);
    setRemovedNotice(removed);
    writeCart(token, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurant.id]);

  function persist(next) {
    setCart(next);
    writeCart(token, next);
  }

  const cartQty = (cart.lines || []).reduce((s, l) => s + (l.qty || 0), 0);
  const cartShop =
    cart.restaurantId === restaurant.id
      ? restaurant
      : others.find((r) => r.id === cart.restaurantId) || { name: "อื่น" };

  const { count, total } = useMemo(
    () => cartTotals(cart, menus),
    [cart, menus],
  );

  const sections = useMemo(() => buildSections(categories, menus), [categories, menus]);
  const showPills = sections.some((s) => s.name);

  /* ---- scroll-spy ---- */

  const stickyRef = useRef(null);
  const pillRowRef = useRef(null);
  const listRef = useRef(null);
  const spacerRef = useRef(null);
  const scrollerRef = useRef(null);
  const sectionEls = useRef({});
  const pillEls = useRef({});
  // ระหว่างเลื่อนเพราะกดหมวด -> ไม่ให้ spy เปลี่ยนหมวดตามทางที่เลื่อนผ่าน
  const jumping = useRef(false);
  const jumpTimer = useRef(null);

  // ความสูงของกองแถบบนที่ sticky (แถบร้าน + แถบเตือน + งบ + หมวด) วัดจริง ไม่เดา
  const [stickyH, setStickyH] = useState(0);
  const [spacerH, setSpacerH] = useState(0);

  // หมวดที่ไม่อยู่แล้ว (เมนูเปลี่ยน) -> กลับไปหมวดแรก
  useEffect(() => {
    if (!sections.some((s) => s.id === activeCat)) setActiveCat(sections[0]?.id || "");
  }, [sections, activeCat]);

  // ช่องว่างท้ายหน้า: ให้ section สุดท้ายเลื่อนขึ้นไปชนแถบหมวดได้ (หมวดสุดท้ายจึง active ได้)
  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    const sticky = stickyRef.current;
    const list = listRef.current;
    const spacer = spacerRef.current;
    if (!scroller || !sticky || !list || !spacer) return;

    const h = sticky.offsetHeight;
    setStickyH(h);

    const last = list.lastElementChild;
    if (!last) {
      setSpacerH(0);
      return;
    }
    const top0 = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const lastTop = last.getBoundingClientRect().top - top0;
    const spacerTop = spacer.getBoundingClientRect().top - top0;
    const wrapperBottom = spacer.parentElement.getBoundingClientRect().bottom - top0;
    // ของที่อยู่ต่อจากเนื้อหา (แถบตะกร้าล่าง ฯลฯ) ก็นับเป็นที่เลื่อนได้
    const after = scroller.scrollHeight - wrapperBottom;
    const need = scroller.clientHeight - h - (spacerTop - lastTop) - after;
    setSpacerH(Math.max(0, Math.ceil(need)));
  }, []);

  // ตำแหน่งที่จะคืนตอนกลับจากหน้ารายละเอียด (อ่านครั้งเดียว — StrictMode รัน effect ซ้ำ)
  const restoreTop = useRef(undefined);

  useEffect(() => {
    scrollerRef.current = scrollParentOf(stickyRef.current);
    measure();
    const ro = new ResizeObserver(() => measure());
    [scrollerRef.current, stickyRef.current, listRef.current].forEach(
      (el) => el && ro.observe(el),
    );

    if (restoreTop.current === undefined) {
      restoreTop.current = takeMenuScroll(token, restaurant.id);
    }
    // รอให้ช่องว่างท้ายหน้าถูกวัดก่อน ไม่งั้นตำแหน่งล่าง ๆ จะโดนตัด
    let raf = 0;
    let tries = 0;
    function restore() {
      raf = 0;
      const scroller = scrollerRef.current;
      const top = restoreTop.current;
      if (!scroller || !top) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (max < top && tries++ < 30) {
        raf = requestAnimationFrame(restore);
        return;
      }
      restoreTop.current = 0;
      jumping.current = false;
      // กระโดดทันที ไม่ smooth -> spy เห็นแค่ตำแหน่งปลายทาง
      scroller.scrollTop = top;
    }
    raf = requestAnimationFrame(restore);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure]);

  // แถบตะกร้าล่างโผล่/หาย เปลี่ยนความสูงที่เลื่อนได้
  useEffect(() => {
    measure();
  }, [measure, count, conflict, removedNotice]);

  // เลื่อนอยู่ -> หมวดของ section ที่อยู่บนสุด (ใต้แถบ sticky) เป็นหมวด active
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !showPills) return;
    let raf = 0;

    function spy() {
      raf = 0;
      const line = stickyRef.current.getBoundingClientRect().bottom + 8;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = sectionEls.current[s.id];
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (current) setActiveCat(current);
    }

    function onScroll() {
      if (jumping.current) {
        // ยังเลื่อนอยู่ -> ต่อเวลา, หยุดนิ่ง 150ms ถือว่าจบ
        clearTimeout(jumpTimer.current);
        jumpTimer.current = setTimeout(() => (jumping.current = false), 150);
        return;
      }
      if (!raf) raf = requestAnimationFrame(spy);
    }

    // ผู้ใช้แตะ/หมุนล้อเอง -> เลิกโหมดกดหมวดทันที
    function onUser() {
      jumping.current = false;
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("touchstart", onUser, { passive: true });
    scroller.addEventListener("wheel", onUser, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("touchstart", onUser);
      scroller.removeEventListener("wheel", onUser);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections, showPills]);

  useEffect(() => () => clearTimeout(jumpTimer.current), []);

  // หมวด active เปลี่ยน -> เลื่อนแถบหมวดแนวนอนให้เห็นปุ่มนั้น (กลางแถบ)
  useEffect(() => {
    const row = pillRowRef.current;
    const pill = pillEls.current[activeCat];
    if (!row || !pill) return;
    const r = row.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    const delta = p.left - r.left - (r.width - p.width) / 2;
    if (Math.abs(delta) > 1) row.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeCat]);

  function jumpTo(id) {
    const scroller = scrollerRef.current;
    const el = sectionEls.current[id];
    setActiveCat(id);
    if (!scroller || !el) return;
    jumping.current = true;
    clearTimeout(jumpTimer.current);
    // เผื่อไม่มี scroll event เลย (อยู่ตำแหน่งนั้นอยู่แล้ว)
    jumpTimer.current = setTimeout(() => (jumping.current = false), 150);
    const top =
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      stickyRef.current.offsetHeight;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  const openOthers = others.filter((r) => r.state === "open");

  function goDetail(m) {
    // กลับจากหน้ารายละเอียดแล้วอยู่ตำแหน่งเดิม
    saveMenuScroll(token, restaurant.id, scrollerRef.current?.scrollTop);
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
    const next = switchRestaurant(cart, target.id);
    writeCart(token, next);
    setSwitchTarget(null);
    if (target.id === restaurant.id) {
      // ยืนยันจากแถบ conflict: อยู่หน้านี้ต่อ
      setCart(next);
      setConflict(false);
      return;
    }
    clearMenuScroll(token, target.id);
    router.push(`/lunch/${token}/r/${target.id}`);
  }

  async function confirmAtShop() {
    setBusy(true);
    setSubmitError("");
    try {
      const r = await postAtShop({
        token,
        requestId: newRequestId(),
        nickname: cart.nickname,
        restaurantId: restaurant.id,
      });

      // สำเร็จ / replay / สั่งไปแล้ว -> หน้าขอบคุณ
      if (r.next === "done") {
        clearCartLines(token, readCart(token));
        router.replace(`/lunch/${token}?done=1`);
        return;
      }
      if (r.next === "sold_out") {
        setNoOrderOpen(false);
        router.replace(`/lunch/${token}?notice=sold_out`);
        return;
      }
      if (r.next === "refresh") {
        router.refresh();
        return;
      }
      setSubmitError(r.message);
    } catch (err) {
      console.error("at_shop submit failed:", err);
      setSubmitError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const closing = windowInfo?.phase === "closing";

  return (
    <>
      <div ref={stickyRef} className="sticky top-0 z-10">
        {conflict ? (
          <CartConflictBanner
            count={cartQty}
            cartRestaurantName={cartShop.name}
            onBack={() => router.replace(`/lunch/${token}/r/${cart.restaurantId}`)}
            onSwitch={() => setSwitchTarget(restaurant)}
          />
        ) : null}
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
                <LogoTile src={openOthers[0].logo} alt="" size={16} />
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

        {showPills ? (
          <div
            ref={pillRowRef}
            data-testid="category-pills"
            className="flex gap-2 overflow-x-auto border-b border-black/5 bg-[#f8fafd] px-4 py-2.5"
          >
            {sections.map((s) => (
              <button
                key={s.id}
                ref={(el) => (pillEls.current[s.id] = el)}
                type="button"
                onClick={() => jumpTo(s.id)}
                aria-current={activeCat === s.id ? "true" : undefined}
                className={[
                  "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition",
                  activeCat === s.id
                    ? "bg-[#2486ff] text-white shadow-sm"
                    : "bg-white text-slate-500 ring-1 ring-black/5",
                ].join(" ")}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-6 pt-1">
        {removedNotice > 0 ? (
          <p className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] text-[#b8720a]">
            มีบางรายการถูกนำออกเพราะไม่พร้อมจำหน่าย
          </p>
        ) : null}

        <div ref={listRef} className="flex flex-col gap-2">
          {sections.map((s) => (
            <section
              key={s.id}
              ref={(el) => (sectionEls.current[s.id] = el)}
              data-testid="menu-section"
              aria-label={s.name || undefined}
              className="pt-3"
              style={{ scrollMarginTop: stickyH }}
            >
              {s.name ? (
                <h2 className="mb-2.5 text-[16px] font-semibold text-[#0d1b2a]">
                  {s.name}
                </h2>
              ) : null}
              <div className="flex flex-col gap-2.5">
                {s.items.map((m) => (
                  <MenuRow
                    key={`${s.id}-${m.id}`}
                    m={m}
                    locked={conflict}
                    onAdd={quickAdd}
                    onOpen={goDetail}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {sections.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-slate-400">
            ยังไม่มีเมนู
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setSubmitError("");
            setNoOrderOpen(true);
          }}
          className="mt-6 h-11 w-full shrink-0 rounded-xl border border-[#2486ff]/40 bg-white text-[14px] font-medium text-[#005cff] transition active:scale-[0.99]"
        >
          ไม่เลือกอาหารตอนนี้ (ไปสั่งที่ร้านเอง)
        </button>

        {/* ที่ว่างท้ายหน้าให้ section สุดท้ายเลื่อนขึ้นถึงแถบหมวด */}
        <div ref={spacerRef} aria-hidden="true" className="shrink-0" style={{ height: spacerH }} />
      </div>

      {count > 0 && !conflict ? (
        <StickyBottom className="flex items-center justify-between gap-3">
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
        </StickyBottom>
      ) : null}

      {switchTarget ? (
        <SwitchModal
          currentName={cartShop.name}
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
          cartCount={cartQty}
          busy={busy}
          error={submitError}
          onCancel={() => setNoOrderOpen(false)}
          onConfirm={confirmAtShop}
        />
      ) : null}
    </>
  );
}
