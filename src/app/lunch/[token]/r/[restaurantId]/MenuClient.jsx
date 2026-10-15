"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

import {
  readCart,
  writeCart,
  addLine,
  setLineQty,
  removeLine,
  reconcile,
  cartTotals,
  newRequestId,
  switchRestaurant,
  enterRestaurant,
  clearCartLines,
} from "@/lib/lunchCart.client";
import { saveMenuScroll, takeMenuScroll, clearMenuScroll } from "@/lib/lunchScroll.client";
import { LogoTile, StickyBottom } from "../../_components/Shell";
import SwitchModal, { CartConflictBanner } from "../../_components/SwitchModal";
import ChangeShopSheet from "../../_components/ChangeShopSheet";
import { shopTypeText } from "../../_components/ShopChips";
import BudgetBar from "../../_components/BudgetBar";
import CountdownBanner from "../../_components/CountdownBanner";
import NoOrderModal, { postAtShop } from "../../_components/NoOrderModal";

/* ---------------- menu row ---------------- */

/**
 * qty = จำนวนรวมของเมนูนี้ทุกบรรทัดในตะกร้า (เมนูเดียวกันในหลายหมวดจึงเห็นเลขเท่ากัน)
 * 0 = ปุ่ม "+" เดียว / ≥ 1 = กรอบน้ำเงิน + [−] n [+]
 */
function MenuRow({ m, qty, locked, onInc, onDec, onOpen }) {
  const out = m.unavailableToday;
  const inCart = qty > 0;

  return (
    <div
      data-testid="menu-row"
      className={[
        "flex items-center gap-3 rounded-2xl bg-white",
        inCart
          ? "border-2 border-[color:var(--blue)] p-[9px]"
          : "border border-black/[.08] p-2.5",
        out ? "opacity-50" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={out}
        onClick={() => !out && onOpen(m)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
      >
        {m.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.image}
            alt={m.name}
            className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[16px] font-medium leading-snug text-[color:var(--navy)]">{m.name}</p>
          <p className="mt-0.5 text-[14px] text-[color:var(--gray)]">
            {out ? "หมดวันนี้" : `${m.price} ฿`}
          </p>
        </div>
      </button>

      {inCart ? (
        <div className="flex shrink-0 items-center gap-1" data-testid="row-stepper">
          <button
            type="button"
            disabled={locked}
            onClick={() => !locked && onDec(m)}
            aria-label={`ลด ${m.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[color:var(--gray-light)] bg-white text-[color:var(--gray)] transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span
            data-testid="row-qty"
            className="min-w-[22px] text-center text-[17px] font-bold tabular-nums text-[color:var(--navy)]"
          >
            {qty}
          </span>
          <button
            type="button"
            disabled={locked}
            onClick={() => !locked && onInc(m)}
            aria-label={`เพิ่ม ${m.name}`}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[color:var(--blue)] text-white transition hover:bg-[color:var(--blue-deep)] active:scale-90 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={out || locked}
          onClick={() => !out && !locked && onInc(m)}
          aria-label={`เพิ่ม ${m.name}`}
          data-testid="add-button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--blue)] text-white shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-90 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}
    </div>
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

/* ---------------- page ---------------- */

/**
 * app shell สูงเท่าจอ: [หัว flex-none] [รายการ — ตัวเลื่อนเดียวของหน้า] [แถบตะกร้า flex-none]
 * scroll-spy / กดหมวด / จำตำแหน่ง ใช้กล่องรายการ (scrollRef) ไม่ใช่ window
 */
export default function MenuClient({
  token,
  testTimes = "",
  restaurant,
  others,
  shops,
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noOrderOpen, setNoOrderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const changeBtnRef = useRef(null);

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

  const cartLines = cart.lines || [];
  const cartQty = cartLines.reduce((s, l) => s + (l.qty || 0), 0);
  const cartShop =
    cart.restaurantId === restaurant.id
      ? restaurant
      : others.find((r) => r.id === cart.restaurantId) || { name: "อื่น" };

  const { count, total } = useMemo(
    () => cartTotals(cart, menus),
    [cart, menus],
  );

  // จำนวนรวมต่อเมนู (ทุกบรรทัด) — ตะกร้าของร้านอื่นไม่นับ
  const qtyByMenu = useMemo(() => {
    const map = new Map();
    if (conflict) return map;
    for (const l of cart.lines || []) {
      const id = String(l.menuId);
      map.set(id, (map.get(id) || 0) + (l.qty || 0));
    }
    return map;
  }, [cart, conflict]);

  const sections = useMemo(() => buildSections(categories, menus), [categories, menus]);
  const showPills = sections.some((s) => s.name);

  // จำนวนในตะกร้าต่อหมวด (ต่อท้ายปุ่มหมวด " · n")
  const qtyBySection = useMemo(() => {
    const map = new Map();
    for (const s of sections) {
      const n = s.items.reduce((sum, m) => sum + (qtyByMenu.get(String(m.id)) || 0), 0);
      if (n > 0) map.set(s.id, n);
    }
    return map;
  }, [sections, qtyByMenu]);

  /* ---- scroll-spy (กล่องรายการเป็นตัวเลื่อนตัวเดียว) ---- */

  const scrollRef = useRef(null);
  const sectionEls = useRef({});
  const pillEls = useRef({});
  // ระหว่างเลื่อนเพราะกดหมวด -> ไม่ให้ spy เปลี่ยนหมวดตามทางที่เลื่อนผ่าน
  const jumping = useRef(false);
  const jumpTimer = useRef(null);

  // หมวดที่ไม่อยู่แล้ว (เมนูเปลี่ยน) -> กลับไปหมวดแรก
  useEffect(() => {
    if (!sections.some((s) => s.id === activeCat)) setActiveCat(sections[0]?.id || "");
  }, [sections, activeCat]);

  // ตำแหน่งที่จะคืนตอนกลับจากหน้ารายละเอียด (อ่านครั้งเดียว — StrictMode รัน effect ซ้ำ)
  const restoreTop = useRef(undefined);

  useEffect(() => {
    if (restoreTop.current === undefined) {
      restoreTop.current = takeMenuScroll(token, restaurant.id);
    }
    // รอให้รายการวาดครบก่อน ไม่งั้นตำแหน่งล่าง ๆ จะโดนตัด
    let raf = 0;
    let tries = 0;
    function restore() {
      raf = 0;
      const scroller = scrollRef.current;
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
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เลื่อนอยู่ -> หมวดของ section ที่อยู่บนสุดของกล่องรายการเป็นหมวด active
  // เลื่อนถึงท้ายแล้ว (±2px) -> หมวดสุดท้าย แม้หัวข้อจะขึ้นไปไม่ถึงบนสุด (ไม่มีช่องว่างเผื่อท้ายแล้ว)
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !showPills) return;
    let raf = 0;

    function spy() {
      raf = 0;
      const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
      let current = sections[0]?.id;
      if (atEnd && scroller.scrollTop > 0) {
        current = sections[sections.length - 1]?.id;
      } else {
        const line = scroller.getBoundingClientRect().top + 8;
        for (const s of sections) {
          const el = sectionEls.current[s.id];
          if (el && el.getBoundingClientRect().top <= line) current = s.id;
        }
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

  // หมวด active เปลี่ยน -> เลื่อนปุ่มนั้นเข้ามาในแถบหมวด (เลื่อนแค่แถบหมวด ไม่ใช่ทั้งหน้า)
  useEffect(() => {
    pillEls.current[activeCat]?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeCat]);

  function jumpTo(id) {
    const scroller = scrollRef.current;
    const el = sectionEls.current[id];
    setActiveCat(id);
    if (!scroller || !el) return;
    jumping.current = true;
    clearTimeout(jumpTimer.current);
    // เผื่อไม่มี scroll event เลย (อยู่ตำแหน่งนั้นอยู่แล้ว)
    jumpTimer.current = setTimeout(() => (jumping.current = false), 150);
    const top =
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    // ปลายรายการ: เลื่อนได้แค่ถึงท้าย ก็หยุดตรงนั้น
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function goDetail(m) {
    // กลับจากหน้ารายละเอียดแล้วอยู่ตำแหน่งเดิม
    saveMenuScroll(token, restaurant.id, scrollRef.current?.scrollTop);
    router.push(`/lunch/${token}/r/${restaurant.id}/m/${m.id}`);
  }

  function goCart() {
    router.push(`/lunch/${token}/summary`);
  }

  // "+": เมนูที่มีกลุ่มตัวเลือก -> หน้ารายละเอียด (สร้างบรรทัดใหม่) / ไม่มี -> เพิ่ม 1 เลย
  function inc(m) {
    if ((m.optionGroups || []).length > 0) {
      goDetail(m);
      return;
    }
    persist(addLine(cart, { menuId: m.id, qty: 1 }));
  }

  // "−": มีบรรทัดเดียว -> ลด 1 (ถึง 0 = ลบบรรทัด) / หลายบรรทัด (ตัวเลือกต่างกัน) -> ไปตะกร้า ไม่เดา
  function dec(m) {
    const lines = cartLines.filter((l) => String(l.menuId) === String(m.id));
    if (lines.length === 0) return;
    if (lines.length > 1) {
      goCart();
      return;
    }
    const line = lines[0];
    persist(
      (line.qty || 0) > 1
        ? setLineQty(cart, line.lineKey, line.qty - 1)
        : removeLine(cart, line.lineKey),
    );
  }

  function closeSheet() {
    setSheetOpen(false);
    // คืนโฟกัสให้ปุ่มที่เปิดชีต
    requestAnimationFrame(() => changeBtnRef.current?.focus());
  }

  // จากชีตเปลี่ยนร้าน: แถบเตือนในชีตคือการยืนยันแล้ว -> ล้างตะกร้าแล้วไปเลย
  function pickFromSheet(target) {
    setSheetOpen(false);
    doSwitch(target);
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
      {/* หัว: ไม่เลื่อนตามรายการ */}
      <div className="z-10 flex-none border-b border-black/[.08] bg-white">
        {conflict ? (
          <CartConflictBanner
            count={cartQty}
            cartRestaurantName={cartShop.name}
            onBack={() => router.replace(`/lunch/${token}/r/${cart.restaurantId}`)}
            onSwitch={() => setSwitchTarget(restaurant)}
          />
        ) : null}

        {/* แถว 1: กลับ + ร้าน + เปลี่ยนร้าน */}
        <div className="flex items-center gap-2 px-2 py-2 pr-4">
          <button
            type="button"
            onClick={() => router.push(`/lunch/${token}`)}
            aria-label="กลับไปเลือกร้าน"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--navy)] transition hover:bg-slate-100"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <LogoTile src={restaurant.logo} alt={restaurant.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold leading-tight text-[color:var(--navy)]">
              {restaurant.name}
            </p>
            <p className="truncate text-[12px] text-[color:var(--gray)]">{shopTypeText(restaurant)}</p>
          </div>
          {others.length > 0 ? (
            <button
              ref={changeBtnRef}
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              className="h-9 shrink-0 rounded-full border border-[color:var(--gray-light)] bg-white px-3 text-[13px] font-semibold text-[color:var(--blue)] transition active:scale-[0.97]"
            >
              เปลี่ยนร้าน ▾
            </button>
          ) : null}
        </div>

        {closing ? (
          <CountdownBanner
            secondsLeft={windowInfo.secondsLeft}
            deadlineLabel={deadlineLabel}
          />
        ) : null}

        {/* แถว 2: งบ */}
        <BudgetBar budget={budget} selected={total} slim />

        {/* แถว 3: หมวด */}
        {showPills ? (
          // กล่องเลื่อนแนวนอนชิดขอบจอ (ไม่มี padding) — ระยะ 16px หัว/ท้ายอยู่ที่แถวด้านใน
          <div data-testid="category-pills" className="lunch-no-scrollbar overflow-x-auto pb-2.5">
            <div className="flex w-max gap-2 px-4">
              {sections.map((s) => {
                const active = activeCat === s.id;
                const n = qtyBySection.get(s.id);
                return (
                  <button
                    key={s.id}
                    ref={(el) => (pillEls.current[s.id] = el)}
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition",
                      active
                        ? "bg-[color:var(--blue)] text-white"
                        : "border border-[color:var(--gray-light)] bg-white text-[color:var(--gray)]",
                    ].join(" ")}
                  >
                    {s.name}
                    {n ? (
                      // บนปุ่ม active (พื้นน้ำเงิน) ใช้ตัวขาว ไม่งั้นมองไม่เห็น
                      <span className={`font-bold ${active ? "text-white" : "text-[color:var(--blue)]"}`}>
                        {` · ${n}`}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* รายการ: ตัวเลื่อนแนวตั้งตัวเดียวของหน้า */}
      <div
        ref={scrollRef}
        data-testid="menu-scroll"
        className="min-h-0 flex-auto overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex flex-col px-4 pb-6 pt-1">
          {removedNotice > 0 ? (
            <p className="mt-3 rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] text-[#b8720a]">
              มีบางรายการถูกนำออกเพราะไม่พร้อมจำหน่าย
            </p>
          ) : null}

          {/* ไปสั่งที่ร้านเอง — อยู่บนสุด ซ่อนเมื่อมีของในตะกร้า */}
          {cartLines.length === 0 ? (
            <button
              type="button"
              data-testid="at-shop-card"
              onClick={() => {
                setSubmitError("");
                setNoOrderOpen(true);
              }}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-[color:var(--gray-light)] bg-white px-4 py-3 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[color:var(--navy)]">ยังไม่เลือกเมนูตอนนี้</p>
                <p className="mt-0.5 text-[13px] text-[color:var(--gray)]">
                  รับคูปอง {budget} บาท แล้วไปสั่งที่ร้านเอง
                </p>
              </div>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[color:var(--gray)]" />
            </button>
          ) : null}

          <div className="flex flex-col gap-2">
            {sections.map((s) => (
              <section
                key={s.id}
                ref={(el) => (sectionEls.current[s.id] = el)}
                data-testid="menu-section"
                aria-label={s.name || undefined}
                className="pt-3"
              >
                {s.name ? (
                  <h2 className="mb-2.5 text-[16px] font-semibold text-[color:var(--navy)]">
                    {s.name}
                  </h2>
                ) : null}
                <div className="flex flex-col gap-2.5">
                  {s.items.map((m) => (
                    <MenuRow
                      key={`${s.id}-${m.id}`}
                      m={m}
                      qty={qtyByMenu.get(String(m.id)) || 0}
                      locked={conflict}
                      onInc={inc}
                      onDec={dec}
                      onOpen={goDetail}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {sections.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[color:var(--gray)]">
              ยังไม่มีเมนู
            </p>
          ) : null}
        </div>
        {/* TEST TIMES อยู่ท้ายรายการ (layout ซ่อนบรรทัดของตัวเองบนหน้านี้) */}
        {testTimes ? (
          <p
            data-testid="lunch-test-times"
            className="pb-1 text-center font-mono text-[10px] text-slate-400"
          >
            {testTimes}
          </p>
        ) : null}
      </div>

      {count > 0 && !conflict ? (
        <StickyBottom className="flex-none">
          <button
            type="button"
            onClick={goCart}
            data-testid="view-cart"
            className="flex h-[54px] w-full items-center justify-between rounded-[14px] bg-[color:var(--navy)] px-4 text-[color:var(--bg)] shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[color:var(--lime)] px-1.5 text-[13px] font-bold tabular-nums text-[color:var(--navy)]">
                {count}
              </span>
              <span className="text-[16px] font-semibold">ดูตะกร้า</span>
            </span>
            <span className="text-[16px] font-bold tabular-nums">{total} บาท</span>
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

      {sheetOpen ? (
        <ChangeShopSheet
          shops={shops}
          currentId={restaurant.id}
          currentName={cartShop.name}
          cartCount={cartQty}
          onPick={pickFromSheet}
          onClose={closeSheet}
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
