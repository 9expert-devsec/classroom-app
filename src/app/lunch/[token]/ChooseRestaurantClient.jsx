"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { isValidNickname, NICKNAME_MAX } from "@/lib/lunchConfig";
import {
  readCart,
  writeCart,
  parseCart,
  useCartRaw,
  enterRestaurant,
  switchRestaurant,
} from "@/lib/lunchCart.client";
import { LogoTile } from "./_components/Shell";
import CountdownBanner from "./_components/CountdownBanner";
import SwitchModal from "./_components/SwitchModal";

function RestaurantTile({ r, disabled, onPick }) {
  const isClosed = r.state === "closed";
  const isSoldOut = r.state === "sold_out";
  const blocked = disabled || isClosed || isSoldOut;

  const badge = isClosed ? "ปิดวันนี้" : isSoldOut ? "คูปองหมด" : "";

  return (
    <button
      type="button"
      disabled={blocked}
      onClick={() => !blocked && onPick(r)}
      className={[
        "relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition",
        blocked
          ? "cursor-not-allowed border-black/5 bg-slate-50 opacity-40"
          : "border-black/5 bg-white shadow-sm hover:border-[#2486ff]/40 active:scale-[0.98]",
      ].join(" ")}
    >
      {badge ? (
        <span
          className={[
            "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium",
            isClosed
              ? "bg-[#c2453e]/10 text-[#c2453e]"
              : "bg-slate-200 text-slate-500",
          ].join(" ")}
        >
          {badge}
        </span>
      ) : null}

      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
        {r.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.logo} alt={r.name} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-2xl text-slate-300">?</span>
        )}
      </div>

      <div>
        <p className="text-[14px] font-semibold leading-tight text-[#0d1b2a]">
          {r.name}
        </p>
      </div>

      {/* ร้าน stock = ไปรับคูปองกระดาษที่ Counter (ตรงข้ามกับ mockup) */}
      {r.isStock && !blocked ? (
        <span className="rounded-full bg-[#48b0ff]/15 px-2 py-0.5 text-[11px] font-medium text-[#005cff]">
          รับคูปองที่ Counter
        </span>
      ) : null}
    </button>
  );
}

export default function ChooseRestaurantClient({
  token,
  session,
  headerLine,
  deadlineLabel,
  notice = "",
}) {
  const router = useRouter();

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
  const [error, setError] = useState(false);
  const [switchTarget, setSwitchTarget] = useState(null);

  function persist(next) {
    writeCart(token, { ...readCart(token), ...next });
  }

  function submit() {
    const v = value.trim();
    if (!isValidNickname(v)) {
      setError(true);
      return;
    }
    setError(false);
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

      <div className="flex flex-col gap-5 px-4 py-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#0d1b2a]">
            สั่งอาหารกลางวัน
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">{headerLine}</p>
        </div>

        {notice ? (
          <p
            data-testid="page1-notice"
            className="rounded-xl bg-[#d98a13]/10 px-3.5 py-2.5 text-[13px] font-medium text-[#b8720a]"
          >
            {notice}
          </p>
        ) : null}

        {/* ชื่อเล่น */}
        {ready && !confirmed ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <label
              htmlFor="lunch-nickname"
              className="text-[14px] font-semibold text-[#0d1b2a]"
            >
              ชื่อเล่น (ภาษาอังกฤษเท่านั้น)
            </label>
            <input
              id="lunch-nickname"
              value={value}
              maxLength={NICKNAME_MAX}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(false);
              }}
              placeholder="เช่น Bas"
              className={[
                "mt-2 h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] outline-none transition",
                error
                  ? "border-[#c2453e] ring-2 ring-[#c2453e]/20"
                  : "border-black/10 focus:border-[#2486ff] focus:ring-2 focus:ring-[#2486ff]/20",
              ].join(" ")}
            />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              {error ? (
                <p className="text-[12px] text-[#c2453e]">
                  กรุณากรอกเป็นตัวอักษรภาษาอังกฤษเท่านั้น
                </p>
              ) : (
                <p className="text-[12px] text-slate-400">
                  ร้านใช้ชื่อเล่นนี้เรียกรับอาหาร จึงต้องเป็นตัวอักษรภาษาอังกฤษ
                </p>
              )}
              <span className="shrink-0 text-[12px] tabular-nums text-slate-400">
                {value.length}/{NICKNAME_MAX}
              </span>
            </div>
            <button
              type="button"
              onClick={submit}
              className="mt-3 h-11 w-full rounded-xl bg-[#2486ff] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.99]"
            >
              ยืนยันชื่อเล่น
            </button>
          </div>
        ) : null}

        {ready && confirmed ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2486ff]/10 px-3 py-1.5 text-[14px] font-semibold text-[#005cff]">
              {nickname}
              <Check className="h-4 w-4 text-[#2486ff]" />
            </span>
            <button
              type="button"
              onClick={edit}
              className="text-[13px] font-medium text-[#005cff] underline underline-offset-2"
            >
              แก้ไข
            </button>
          </div>
        ) : null}

        {/* ร้าน */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-slate-500">เลือกร้าน</p>
          {ready && !confirmed ? (
            <p className="mb-3 text-[12px] text-slate-400">
              กรอกชื่อเล่นก่อนเลือกร้าน
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {(session.restaurants || []).map((r) => (
              <RestaurantTile
                key={r.id}
                r={r}
                disabled={!confirmed}
                onPick={pick}
              />
            ))}
          </div>

          {(session.restaurants || []).length === 0 ? (
            <p className="text-[13px] text-slate-400">วันนี้ยังไม่มีร้านคูปอง</p>
          ) : null}
        </div>

        <p className="text-[13px] text-slate-500">
          งบคูปอง {session.budget} บาทต่อคน
        </p>
      </div>

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
