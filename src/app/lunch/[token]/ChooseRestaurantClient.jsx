"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";

import { isValidNickname, NICKNAME_MAX } from "@/lib/lunchConfig";
import {
  readCart,
  writeCart,
  parseCart,
  useCartRaw,
  enterRestaurant,
  switchRestaurant,
} from "@/lib/lunchCart.client";
import { clearMenuScrolls } from "@/lib/lunchScroll.client";
import { LogoTile } from "./_components/Shell";
import CountdownBanner from "./_components/CountdownBanner";
import SwitchModal from "./_components/SwitchModal";
import { ShopTypeChip, BlockedChip, shopBlockedText } from "./_components/ShopChips";

/* ---------------- hero band (navy) ---------------- */

function HeroBand({ className = "", children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-b-[28px] bg-[color:var(--navy)] ${className}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[color:var(--blue-deep)] opacity-[.55]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-2 top-16 h-24 w-24 rounded-full border-2 border-[color:var(--blue)] opacity-60" />
      <div className="relative">
        <p className="text-[13px] font-bold tracking-[.12em] text-[color:var(--lime)]">9EXPERT FOOD</p>
        {children}
      </div>
    </div>
  );
}

/* ---------------- A: nickname ---------------- */

function NicknameStep({ value, onChange, onSubmit }) {
  const v = value.trim();
  const valid = isValidNickname(v);
  const [touched, setTouched] = useState(false);
  // ขึ้นข้อผิดพลาดเมื่อออกจากช่องแล้วครั้งหนึ่ง หรือทันทีที่พิมพ์ตัวที่ไม่ใช่ภาษาอังกฤษ/เว้นวรรค
  // (ปุ่มยังกดไม่ได้จนกว่าจะถูกต้องเหมือนเดิม)
  const badChar = /[^A-Za-z ]/.test(value);
  const error = badChar || (touched && v.length > 0 && !valid);

  return (
    <div className="flex flex-1 flex-col">
      <HeroBand className="px-7 pb-10 pt-16">
        <h1 className="mt-3 text-[27px] font-bold leading-tight text-[color:var(--bg)]">
          สวัสดีครับ
          <br />
          วันนี้ให้เราเรียกคุณว่าอะไร?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--gray-light)]">
          ยืนยันชื่อเล่นก่อนเลือกอาหาร เพื่อให้ร้านเรียกชื่อได้ถูกต้องตอนรับอาหาร
        </p>
      </HeroBand>

      <form
        className="p-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(v);
        }}
      >
        <label htmlFor="lunch-nickname" className="text-[15px] font-semibold text-[color:var(--navy)]">
          ชื่อเล่น <span className="font-normal text-[color:var(--gray)]">(ภาษาอังกฤษ)</span>
        </label>
        <input
          id="lunch-nickname"
          value={value}
          maxLength={NICKNAME_MAX}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="เช่น Bas"
          autoComplete="nickname"
          aria-invalid={error || undefined}
          aria-describedby={error ? "lunch-nickname-error" : undefined}
          className={[
            "mt-2 h-14 w-full rounded-2xl border-2 bg-white px-4 text-[18px] text-[color:var(--navy)] outline-none transition",
            error
              ? "border-[#c2453e] ring-2 ring-[#c2453e]/20"
              : "border-[color:var(--blue)] focus:ring-4 focus:ring-[#2486ff]/15",
          ].join(" ")}
        />
        {error ? (
          <p id="lunch-nickname-error" className="mt-1.5 text-[13px] text-[#c2453e]">
            กรุณากรอกเป็นตัวอักษรภาษาอังกฤษเท่านั้น
          </p>
        ) : null}
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[13px] text-[color:var(--gray)]">
          <p>แก้ไขได้ก่อนยืนยันคำสั่งซื้อ</p>
          <span className="shrink-0 tabular-nums">
            {value.length}/{NICKNAME_MAX}
          </span>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="mt-6 h-14 w-full rounded-2xl bg-[color:var(--blue)] text-[16px] font-bold text-[color:var(--bg)] shadow-sm transition hover:bg-[color:var(--blue-deep)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          ยืนยันและเริ่มเลือกอาหาร →
        </button>
      </form>
    </div>
  );
}

/* ---------------- B: shop picker ---------------- */

function ShopCard({ r, onPick }) {
  const blockedText = shopBlockedText(r);
  const blocked = !!blockedText;

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={() => !blocked && onPick(r)}
      className={[
        "flex flex-col items-center gap-2.5 rounded-[20px] border p-4 text-center transition",
        blocked
          ? "cursor-not-allowed border-black/5 bg-slate-100"
          : "border-black/5 bg-white shadow-[0_4px_16px_rgba(13,27,42,0.06)] hover:border-[color:var(--blue)] active:scale-[0.98]",
      ].join(" ")}
    >
      <div className={blocked ? "opacity-50 grayscale" : ""}>
        <LogoTile src={r.logo} alt={r.name} size={72} />
      </div>
      <p
        className={`text-[15px] font-semibold leading-tight ${blocked ? "text-slate-400" : "text-[color:var(--navy)]"}`}
      >
        {r.name}
      </p>
      {blocked ? <BlockedChip text={blockedText} /> : <ShopTypeChip r={r} />}
    </button>
  );
}

function ShopStep({ session, headerLine, nickname, notice, short, finalLabel, onEdit, onPick }) {
  const firstName = String(session?.learner?.fullName || "").trim().split(/\s+/)[0] || "";
  const restaurants = session.restaurants || [];

  return (
    <div className="flex flex-1 flex-col pb-8">
      <HeroBand className="px-6 pb-16 pt-9">
        <h1 className="mt-2 text-[24px] font-bold leading-tight text-[color:var(--bg)]">
          วันนี้อยากทานร้านไหน?
        </h1>
        {headerLine ? (
          <p className="mt-1.5 text-[14px] text-[color:var(--gray-light)]">{headerLine}</p>
        ) : null}
      </HeroBand>

      <div className="flex flex-col gap-4 px-4">
        {/* การ์ดชื่อเล่น ทับขอบล่างของแถบน้ำเงินเข้ม */}
        <div className="relative -mt-11 flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_rgba(13,27,42,0.10)]">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--blue)] text-[20px] font-bold text-white"
          >
            {nickname.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[color:var(--gray)]">ร้านจะเรียกคุณว่า</p>
            <p className="truncate text-[20px] font-bold leading-tight text-[color:var(--navy)]">{nickname}</p>
            {firstName ? (
              <p className="truncate text-[12px] text-[color:var(--gray)]">คุณ {firstName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="h-10 shrink-0 rounded-full bg-[color:var(--blue-tint)] px-4 text-[14px] font-semibold text-[color:var(--blue-deep)] transition active:scale-[0.97]"
          >
            ✎ แก้ไข
          </button>
        </div>

        {short ? (
          <p
            data-testid="short-flow-note"
            className="rounded-xl bg-[color:var(--blue-tint)] px-3.5 py-2.5 text-[13px] font-medium text-[color:var(--blue-deep)]"
          >
            สั่งแบบย่อได้ถึง {finalLabel} น. · รับคูปองแล้วไปสั่งที่ร้าน
          </p>
        ) : null}

        {notice ? (
          <p
            data-testid="page1-notice"
            className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]"
          >
            {notice}
          </p>
        ) : null}

        {/* งบคูปอง */}
        <div
          className="flex items-center gap-3 rounded-[20px] p-4 text-white"
          style={{ backgroundImage: "var(--budget-gradient)" }}
        >
          <Ticket aria-hidden="true" className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-[18px] font-bold leading-tight">งบคูปอง {session.budget} บาท</p>
            <p className="mt-0.5 text-[13px]">สั่งเกินได้ ส่วนที่เกินชำระเองที่ร้าน</p>
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[15px] font-semibold text-[color:var(--navy)]">เลือกร้าน</p>
          <div className="grid grid-cols-2 gap-3">
            {restaurants.map((r) => (
              <ShopCard key={r.id} r={r} onPick={onPick} />
            ))}
          </div>
          {restaurants.length === 0 ? (
            <p className="text-[13px] text-[color:var(--gray)]">วันนี้ยังไม่มีร้านคูปอง</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function ChooseRestaurantClient({
  token,
  session,
  headerLine,
  deadlineLabel,
  notice = "",
  // C1: เลยเส้นตายแล้วแต่ยังไม่ถึง 15:00 — เลือกร้านแล้วไปหน้าสรุปแบบย่อ (ไม่มีเมนู)
  short = false,
  // C3a: เวลาปิดจริงจาก server (lunchTimes) — ไม่ฮาร์ดโค้ด
  finalLabel = "",
}) {
  const router = useRouter();

  // เข้าหน้าเมนูจากหน้านี้ต้องเริ่มบนสุด -> ทิ้งตำแหน่งเลื่อนที่ค้างไว้
  useEffect(() => {
    clearMenuScrolls(token);
  }, [token]);

  // ตะกร้าใน storage แบบ external store: null = ยังไม่รู้ (server / hydration)
  const raw = useCartRaw(token);
  const ready = raw !== null;
  const stored = useMemo(() => parseCart(raw), [raw]);

  // ชื่อเล่นเอาจาก DTO ก่อน ถ้าไม่มีค่อยดูใน storage
  const fromSession = session?.learner?.nickname || "";
  const nickname =
    stored.nicknameConfirmed && stored.nickname
      ? stored.nickname
      : fromSession || stored.nickname;
  const [editing, setEditing] = useState(false);
  const confirmed =
    !editing && (!!fromSession || (stored.nicknameConfirmed && !!stored.nickname));

  const [draft, setDraft] = useState(null); // null = ยังไม่พิมพ์ ใช้ค่าที่เก็บไว้
  const value = draft ?? nickname;
  const [switchTarget, setSwitchTarget] = useState(null);

  // เปลี่ยนขั้น (ชื่อเล่น <-> เลือกร้าน) -> เริ่มบนสุดของจอใหม่
  useEffect(() => {
    if (ready) window.scrollTo(0, 0);
  }, [ready, confirmed]);

  function persist(next) {
    writeCart(token, { ...readCart(token), ...next });
  }

  function submit(v) {
    if (!isValidNickname(v)) return;
    setEditing(false);
    setDraft(null);
    persist({ nickname: v, nicknameConfirmed: true });
  }

  function edit() {
    setEditing(true);
    setDraft(nickname);
    persist({ nicknameConfirmed: false });
  }

  // กติกาเดียวกับทุกหน้า: มีรายการจากร้านอื่น -> ถามก่อนล้าง
  function pick(r) {
    // แบบย่อไม่มีตะกร้าเมนู — ไม่ต้องถามเรื่องรายการจากร้านอื่น
    if (short) {
      router.push(`/lunch/${token}/short/${r.id}`);
      return;
    }
    const current = readCart(token);
    const { state, conflict } = enterRestaurant(current, r.id);
    if (conflict) {
      setSwitchTarget(r);
      return;
    }
    writeCart(token, state);
    router.push(`/lunch/${token}/r/${r.id}`);
  }

  function confirmSwitch() {
    const r = switchTarget;
    writeCart(token, switchRestaurant(readCart(token), r.id));
    setSwitchTarget(null);
    router.push(`/lunch/${token}/r/${r.id}`);
  }

  const cartShopName =
    (session.restaurants || []).find((r) => r.id === stored.restaurantId)?.name || "อื่น";

  const closing = session?.window?.phase === "closing";

  return (
    <>
      {closing ? (
        <CountdownBanner
          secondsLeft={session.window.secondsLeft}
          deadlineLabel={deadlineLabel}
        />
      ) : null}

      {!ready ? null : confirmed ? (
        <ShopStep
          session={session}
          headerLine={headerLine}
          nickname={nickname}
          notice={notice}
          short={short}
          finalLabel={finalLabel}
          onEdit={edit}
          onPick={pick}
        />
      ) : (
        <NicknameStep value={value} onChange={setDraft} onSubmit={submit} />
      )}

      {switchTarget ? (
        <SwitchModal
          currentName={cartShopName}
          target={switchTarget}
          onCancel={() => setSwitchTarget(null)}
          onConfirm={confirmSwitch}
        />
      ) : null}
    </>
  );
}
