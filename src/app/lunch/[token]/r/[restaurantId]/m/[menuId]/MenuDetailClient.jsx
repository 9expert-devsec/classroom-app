"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, ImageOff } from "lucide-react";

import {
  readCart,
  writeCart,
  addLine,
  reconcile,
  cartTotals,
  unitPriceOf,
  switchRestaurant,
  enterRestaurant,
  MAX_NOTE,
  MIN_QTY,
  MAX_QTY,
} from "@/lib/lunchCart.client";
import { menuHeroSrc } from "@/lib/menuImage";
import { StickyBottom } from "../../../../_components/Shell";
import BudgetBar from "../../../../_components/BudgetBar";
import CountdownBanner from "../../../../_components/CountdownBanner";
import QtyStepper from "../../../../_components/QtyStepper";
import SwitchModal, { CartConflictBanner } from "../../../../_components/SwitchModal";

/* ---------------- option rows ---------------- */

// กลุ่มที่บังคับ = ดอกจันแดงต่อท้ายชื่อ (กลุ่มไม่บังคับไม่มีอะไรเพิ่ม)
// flagged = กดเพิ่มลงตะกร้าตอนที่กลุ่มนี้ยังไม่ได้เลือก -> บอกใต้หัวข้อ
function GroupHeader({ group, id, flagged }) {
  return (
    <div className="mb-2">
      <p id={id} className="text-[15px] font-semibold text-[#0d1b2a]">
        {group.name}
        {group.required ? (
          <span aria-hidden="true" className="ml-0.5 text-[#d92d20]">
            *
          </span>
        ) : null}
      </p>
      {flagged ? (
        <p role="alert" className="mt-0.5 text-[13px] text-[#d92d20]">
          กรุณาเลือก 1 รายการ
        </p>
      ) : null}
    </div>
  );
}

function ChoiceRow({ group, choice, on, onToggle }) {
  const multi = group.selectType === "multi";
  return (
    <label
      className={[
        "flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-[14px] transition",
        on ? "border-[#2486ff] bg-[#2486ff]/5" : "border-black/10 bg-white",
      ].join(" ")}
    >
      {multi ? (
        <span
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
            on ? "border-[#2486ff] bg-[#2486ff]" : "border-slate-300",
          ].join(" ")}
        >
          {on ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
        </span>
      ) : (
        <span
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
            on ? "border-[#2486ff]" : "border-slate-300",
          ].join(" ")}
        >
          {on ? <span className="h-2.5 w-2.5 rounded-full bg-[#2486ff]" /> : null}
        </span>
      )}
      <input
        type={multi ? "checkbox" : "radio"}
        name={`g-${group.id}`}
        className="sr-only"
        checked={on}
        onChange={onToggle}
      />
      <span className="flex-1 text-[#0d1b2a]">{choice.name}</span>
      {choice.priceDelta > 0 ? (
        <span className="text-[13px] text-slate-500">+{choice.priceDelta}฿</span>
      ) : null}
    </label>
  );
}

/* ---------------- hero ---------------- */

/**
 * รูปเมนูกรอบ 4:3 เต็มความกว้าง (รูปเดียว ไม่มีพื้นหลังเบลอ)
 *   1) รูปเมนูบน Cloudinary -> URL ที่ผ่าน AI upscale + c_fill 4:3 (menuHeroSrc) แสดงเต็มกรอบ
 *   2) โหลดไม่ได้ / ไม่ใช่รูป Cloudinary -> รูปต้นฉบับขนาดจริงตรงกลาง บนพื้นเรียบ (ไม่เกินกรอบ)
 *   3) ต้นฉบับก็โหลดไม่ได้ -> ImageOff
 * ระหว่างโหลดกรอบคงขนาดไว้ (bg-slate-100) แล้วค่อย fade รูปเข้า
 */
function MenuHero({ src, alt }) {
  const upscaled = useMemo(() => menuHeroSrc(src), [src]);
  const imgRef = useRef(null);
  // stage: upscaled | original | error ; loaded: รูปของ stage ปัจจุบันโหลดเสร็จแล้ว
  const [stage, setStage] = useState(upscaled ? "upscaled" : "original");
  const [loaded, setLoaded] = useState(false);

  function fail() {
    setLoaded(false);
    setStage((s) => (s === "upscaled" ? "original" : "error"));
  }

  function done(img) {
    if (!img.naturalWidth) {
      fail();
      return;
    }
    setLoaded(true);
  }

  useEffect(() => {
    setStage(upscaled ? "upscaled" : "original");
    setLoaded(false);
  }, [upscaled, src]);

  useEffect(() => {
    // โหลดเสร็จก่อน hydrate -> onLoad ไม่ยิง ต้องเช็กเอง
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth) done(img);
      else fail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  if (!src || stage === "error") {
    return (
      <div
        data-testid="menu-hero"
        data-mode="fallback"
        className="flex aspect-[4/3] w-full items-center justify-center bg-slate-100 text-slate-300"
      >
        <ImageOff className="h-10 w-10" />
      </div>
    );
  }

  const isUpscaled = stage === "upscaled";

  return (
    <div
      data-testid="menu-hero"
      data-mode={loaded ? stage : "loading"}
      className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={stage}
        ref={imgRef}
        src={isUpscaled ? upscaled : src}
        alt={alt}
        data-testid="menu-hero-img"
        onLoad={(e) => done(e.currentTarget)}
        onError={fail}
        className={
          isUpscaled
            ? loaded
              ? "absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-300"
              : "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300"
            : loaded
              ? "absolute inset-0 m-auto rounded-2xl object-contain opacity-100 shadow-sm transition-opacity duration-300"
              : "absolute inset-0 m-auto rounded-2xl object-contain opacity-0 shadow-sm transition-opacity duration-300"
        }
        // ต้นฉบับ: ขนาดจริง (img absolute ไม่กำหนด w/h) แต่ไม่เกินกรอบ
        style={
          isUpscaled
            ? undefined
            : { maxWidth: "calc(100% - 2rem)", maxHeight: "calc(100% - 2rem)" }
        }
      />
    </div>
  );
}

/* ---------------- page ---------------- */

export default function MenuDetailClient({
  token,
  restaurant,
  restaurants,
  budget,
  windowInfo,
  deadlineLabel,
  menu,
  menus,
}) {
  const router = useRouter();
  const backHref = `/lunch/${token}/r/${restaurant.id}`;

  const [cart, setCart] = useState({ lines: [] });
  // { [groupId]: choiceId[] } — ไม่เลือกอะไรไว้ก่อนเลย แม้แต่กลุ่มที่บังคับ
  const [picked, setPicked] = useState({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  // ตะกร้ามีรายการจากร้านอื่น -> ไม่แตะตะกร้า ปิดปุ่มเพิ่มจนกว่าจะยืนยันเปลี่ยนร้าน
  const [conflict, setConflict] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    const stored = readCart(token);
    const { state: entered, conflict: other } = enterRestaurant(stored, restaurant.id);
    if (other) {
      setCart(stored);
      setConflict(true);
      return;
    }
    const { state } = reconcile(entered, menus);
    setCart(state);
    setConflict(false);
    writeCart(token, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurant.id]);

  const cartQty = (cart.lines || []).reduce((s, l) => s + (l.qty || 0), 0);
  const cartShop = restaurants.find((r) => r.id === cart.restaurantId) || { name: "อื่น" };

  function confirmSwitch() {
    const next = switchRestaurant(cart, restaurant.id);
    writeCart(token, next);
    setCart(next);
    setConflict(false);
    setSwitchOpen(false);
  }

  const groups = useMemo(() => menu.optionGroups || [], [menu]);

  function toggle(group, choiceId) {
    setPicked((prev) => {
      const cur = prev[group.id] || [];
      if (group.selectType === "multi") {
        const next = cur.includes(choiceId)
          ? cur.filter((x) => x !== choiceId)
          : [...cur, choiceId];
        return { ...prev, [group.id]: next };
      }
      return { ...prev, [group.id]: [choiceId] };
    });
  }

  const choices = useMemo(
    () =>
      groups
        .map((g) => ({ groupId: g.id, choiceIds: picked[g.id] || [] }))
        .filter((c) => c.choiceIds.length > 0),
    [groups, picked],
  );

  const missing = groups.find((g) => g.required && !(picked[g.id] || []).length);
  const canAdd = !missing && !conflict;

  // กดเพิ่มลงตะกร้าตอนกลุ่มบังคับยังว่าง -> กลุ่มที่ยังว่างทุกกลุ่มขึ้นสีแดง
  // (กลุ่มไหนเลือกแล้วก็หายแดงเอง เพราะคิดจาก picked ทุกครั้ง)
  const [flagged, setFlagged] = useState(false);
  const isFlagged = (g) => flagged && g.required && !(picked[g.id] || []).length;
  const topBarRef = useRef(null);
  const groupEls = useRef({});

  const unit = unitPriceOf({ choices }, menu);
  const thisTotal = unit * qty;
  const { total: cartTotal } = useMemo(() => cartTotals(cart, menus), [cart, menus]);
  const preview = cartTotal + thisTotal;
  const previewOver = preview - budget;

  function commit() {
    if (conflict) return;
    if (missing) {
      setFlagged(true);
      // เลื่อนกลุ่มแรกที่ยังว่างขึ้นมาใต้แถบบน (sticky)
      const el = groupEls.current[missing.id];
      if (el) {
        const offset = (topBarRef.current?.offsetHeight || 0) + 8;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
      return;
    }
    const next = addLine(cart, { menuId: menu.id, qty, choices, note });
    writeCart(token, next);
    router.replace(backHref);
  }

  const closing = windowInfo?.phase === "closing";

  return (
    <>
      <div ref={topBarRef} className="sticky top-0 z-20">
        {conflict ? (
          <CartConflictBanner
            count={cartQty}
            cartRestaurantName={cartShop.name}
            onBack={() => router.replace(`/lunch/${token}/r/${cart.restaurantId}`)}
            onSwitch={() => setSwitchOpen(true)}
          />
        ) : null}
        {closing ? (
          <CountdownBanner
            secondsLeft={windowInfo.secondsLeft}
            deadlineLabel={deadlineLabel}
          />
        ) : null}
        {/* ปุ่มกลับอยู่ในแถบงบ (sticky) — ไม่ลอยทับรูป จึงไม่เลื่อนไปทับแถบงบ */}
        <BudgetBar
          budget={budget}
          selected={cartTotal}
          leading={
            <button
              type="button"
              onClick={() => router.replace(backHref)}
              aria-label="กลับไปรายการเมนู"
              className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-[#0d1b2a] pl-2.5 pr-3.5 text-[15px] font-semibold text-white transition active:scale-[0.97]"
            >
              <ChevronLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2.4} />
              กลับ
            </button>
          }
        />
      </div>

      <div className="flex-1 pb-6">
        <div className="relative">
          <MenuHero src={menu.image} alt={menu.name} />
        </div>

        <div className="flex flex-col gap-5 px-4 py-4">
          <div>
            <h1 className="text-[20px] font-bold text-[#0d1b2a]">{menu.name}</h1>
            {menu.description ? (
              <p className="mt-1 text-[13px] text-slate-500">{menu.description}</p>
            ) : null}
            <p className="mt-1.5 text-[16px] font-semibold text-[#2486ff]">
              {menu.price} ฿
            </p>
          </div>

          {groups.map((g) => (
            <div
              key={g.id}
              ref={(el) => (groupEls.current[g.id] = el)}
              data-testid="option-group"
              role={g.selectType === "multi" ? "group" : "radiogroup"}
              aria-labelledby={`g-${g.id}-label`}
              aria-required={g.required ? "true" : undefined}
              aria-invalid={isFlagged(g) ? "true" : undefined}
            >
              <GroupHeader group={g} id={`g-${g.id}-label`} flagged={isFlagged(g)} />
              <div
                className={[
                  "flex flex-col gap-2",
                  isFlagged(g) ? "rounded-2xl border-2 border-[#d92d20] p-2" : "",
                ].join(" ")}
              >
                {g.choices.map((c) => (
                  <ChoiceRow
                    key={c.id}
                    group={g}
                    choice={c}
                    on={(picked[g.id] || []).includes(c.id)}
                    onToggle={() => toggle(g, c.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <label
              htmlFor="lunch-note"
              className="text-[15px] font-semibold text-[#0d1b2a]"
            >
              หมายเหตุถึงร้าน
            </label>
            <textarea
              id="lunch-note"
              value={note}
              maxLength={MAX_NOTE}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ไม่เผ็ด ไม่ใส่ผัก"
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] outline-none transition focus:border-[#2486ff] focus:ring-2 focus:ring-[#2486ff]/20"
            />
            <p className="mt-1 text-right text-[12px] tabular-nums text-slate-400">
              {note.length}/{MAX_NOTE}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#0d1b2a]">จำนวน</span>
            <QtyStepper qty={qty} onChange={setQty} min={MIN_QTY} max={MAX_QTY} />
          </div>
        </div>
      </div>

      <StickyBottom>
        <p
          data-testid="preview-line"
          className={`mb-1.5 text-center text-[12px] ${previewOver > 0 ? "text-[#b8720a]" : "text-slate-500"}`}
        >
          หลังเพิ่มรายการนี้: {preview} บาท
          {previewOver > 0 ? (
            <span className="font-semibold"> · ชำระเพิ่ม {previewOver} บาท</span>
          ) : null}
        </p>
        <button
          type="button"
          data-testid="detail-add"
          onClick={commit}
          disabled={conflict}
          className={[
            "h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-sm transition",
            !conflict
              ? "bg-[#2486ff] hover:bg-[#005cff] active:scale-[0.99]"
              : "cursor-not-allowed bg-slate-300",
          ].join(" ")}
        >
          เพิ่มลงตะกร้า · {thisTotal} บาท
        </button>
      </StickyBottom>

      {switchOpen ? (
        <SwitchModal
          currentName={cartShop.name}
          target={restaurant}
          onCancel={() => setSwitchOpen(false)}
          onConfirm={confirmSwitch}
        />
      ) : null}
    </>
  );
}
