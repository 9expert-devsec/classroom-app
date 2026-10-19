"use client";

// C3d: Merchant shop page — English only, mobile-first, no prices anywhere
//   home     : Scan QR card, or enter code + Check (not found -> inline error), Recent redemptions + Usage summary
//   scanning : camera (@zxing/browser, same reader as the old ScanClient)
//   result   : unused -> Found + Confirm redemption / used -> already used / cancelled / expired
//   complete : Coupon redeemed + Scan next / View usage summary
// ทุก API ส่ง header x-merchant-key — server เป็นคนตัดสินทั้งหมด (ร้าน วัน เวลาปิด)
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Check,
  CircleMinus,
  Loader2,
  QrCode,
  ScanLine,
  Search,
  UtensilsCrossed,
} from "lucide-react";

import { ShopLogo, LAST_SHOP_KEY } from "../ShopPickerClient";
import { optionGroupsOf } from "@/lib/lunchOptionGroups";

const NOT_FOUND_MSG = "Coupon not found. Check the code and try again.";

function hm(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function dmy(date) {
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function dateLabel(ymd) {
  if (!ymd) return "";
  return dmy(new Date(`${ymd}T00:00:00+07:00`)) || ymd;
}

/** "19 Oct 2026 at 10:16" (เวลาไทย) */
function atLabel(iso) {
  if (!iso) return "";
  return `${dmy(new Date(iso))} at ${hm(iso)}`;
}

/* ---------------- shared pieces ---------------- */

function Header({ merchantKey, restaurant }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/m/${merchantKey}`}
        aria-label="Change restaurant"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-black/5"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <ShopLogo src={restaurant.logo} alt={restaurant.name} size={48} />
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-[#0d1b2a]">{restaurant.name}</h1>
    </div>
  );
}

function Card({ children, className = "", testId }) {
  return (
    <div
      className={`rounded-2xl border border-black/5 bg-white p-4 shadow-sm ${className}`}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-[#0d1b2a]">
        {children || "-"}
      </span>
    </div>
  );
}

/** learner info rows + Food items (ไม่มีราคา) — ใช้ในทุกจอผลลัพธ์ */
function LearnerInfo({ c }) {
  return (
    <div data-testid="merchant-customer">
      <div className="divide-y divide-black/5">
        <Row label="Nickname">{c.nickname}</Row>
        <Row label="First name">{c.firstName}</Row>
        <Row label="Last name">{c.lastName}</Row>
        <Row label="Class">{[c.room, c.className].filter(Boolean).join(" · ")}</Row>
        <Row label="Training date">{dateLabel(c.dayYMD)}</Row>
      </div>
      <div className="mt-2 border-t border-black/5 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Food items</p>
        {c.mode === "at_shop" ? (
          <p className="mt-2 text-sm text-[#0d1b2a]">Ordering at the shop (no pre-order)</p>
        ) : (
          // 1 บรรทัดต่อ 1 รายการ: "<qty> × <เมนู>" แล้วตัวเลือก / หมายเหตุใต้ชื่อ
          <ul className="mt-2 flex flex-col gap-2.5">
            {(c.items || []).map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2486ff]/10 text-[#2486ff]">
                  <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-1.5 text-sm text-[#0d1b2a]">
                  <p className="break-words font-semibold">
                    {it.qty} × {it.name}
                  </p>
                  {optionGroupsOf(it).map((g, k) => (
                    <p key={k} className="text-[13px] text-[#0d1b2a]">
                      {g.group ? <span className="text-slate-500">{g.group}: </span> : null}
                      {g.values.join(", ")}
                    </p>
                  ))}
                  {it.note ? (
                    <p className="text-[13px] text-[#0d1b2a]">
                      <span className="text-slate-500">Note: </span>
                      {it.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2486ff] text-base font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:scale-[0.99] active:bg-[#005cff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2486ff]/40 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, children, href, testId }) {
  const cls =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a] transition hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2486ff]/30 disabled:opacity-50";
  if (href) {
    return (
      <Link href={href} className={cls} data-testid={testId}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} data-testid={testId}>
      {children}
    </button>
  );
}

function InlineError({ children }) {
  if (!children) return null;
  return (
    <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert" data-testid="merchant-error">
      {children}
    </p>
  );
}

const TONES = {
  red: { circle: "bg-red-50 text-red-600", title: "text-red-600", Icon: Ban },
  orange: { circle: "bg-orange-50 text-orange-500", title: "text-orange-500", Icon: CircleMinus },
};

/** จอ "ใช้ไม่ได้" (Screen 4 / 5 pattern): วงกลม + หัวข้อสี + บรรทัดเทา + การ์ดรหัส + Scan again / Back to home */
function BlockedScreen({ tone, title, body, customer, onScan, onHome }) {
  const t = TONES[tone];
  return (
    <>
      <div className="flex flex-col items-center pt-2 text-center">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full ${t.circle}`}>
          <t.Icon className="h-11 w-11" aria-hidden="true" />
        </div>
        <h2 className={`mt-4 text-xl font-bold ${t.title}`}>{title}</h2>
        {body ? <p className="mt-1 text-sm text-slate-500">{body}</p> : null}
      </div>
      {customer ? (
        <Card className="mt-5">
          <p className="font-mono text-lg font-bold tracking-wider text-[#0d1b2a]">{customer.code}</p>
          <div className="mt-1">
            <LearnerInfo c={customer} />
          </div>
        </Card>
      ) : null}
      <div className="mt-5 flex flex-col gap-3">
        <PrimaryButton onClick={onScan} testId="merchant-scan-again">
          <ScanLine className="h-5 w-5" aria-hidden="true" />
          Scan again
        </PrimaryButton>
        <SecondaryButton onClick={onHome}>Back to home</SecondaryButton>
      </div>
    </>
  );
}

/* ---------------- scanner ---------------- */

function Scanner({ onCode, onCancel }) {
  const videoRef = useRef(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    let controls = null;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        if (!videoRef.current || cancelled) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _e, c) => {
          if (cancelled || !result) return;
          const text = String(result.getText?.() || "").trim();
          if (!text) return;
          cancelled = true;
          try {
            c?.stop?.();
          } catch {
            // ignore
          }
          onCode(text);
        });
        if (cancelled) controls?.stop?.();
      } catch (e) {
        console.error(e);
        setErr("Could not open the camera. Allow camera access (HTTPS only) or enter the code instead.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        controls?.stop?.();
      } catch {
        // ignore
      }
    };
  }, [onCode]);

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-black shadow-sm">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      <p className="mt-3 text-center text-sm text-slate-500">
        {err || "Point the camera at the learner's QR code"}
      </p>
      <div className="mt-4">
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function MerchantShopClient({ merchantKey, restaurant }) {
  const [view, setView] = useState("home"); // home | scanning | result | complete
  const [code, setCode] = useState("");
  const [via, setVia] = useState("typed");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);
  const hasCode = code.trim() !== "";
  const reportHref = `/m/${merchantKey}/${restaurant.id}/report`;

  const api = useCallback(
    async (path, init = {}) => {
      const res = await fetch(path, {
        cache: "no-store",
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          "x-merchant-key": merchantKey,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("Too many attempts. Please wait a moment and try again.");
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      return data;
    },
    [merchantKey],
  );

  const loadRecent = useCallback(async () => {
    try {
      const data = await api(
        `/api/merchant/lunch/recent?restaurantId=${encodeURIComponent(restaurant.id)}`,
      );
      setRecent(data.items || []);
    } catch {
      // ตารางล่าสุดโหลดไม่ได้ไม่ต้องขึ้น error ใหญ่
    }
  }, [api, restaurant.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_SHOP_KEY, restaurant.id);
    } catch {
      // ignore
    }
    loadRecent();
  }, [restaurant.id, loadRecent]);

  function goHome() {
    setView("home");
    setResult(null);
    setError("");
    setCode("");
    loadRecent();
  }

  // not_found -> อยู่หน้าแรก + error ใต้ช่องกรอก, อย่างอื่น -> จอผลลัพธ์
  const show = useCallback((data) => {
    if (data?.state === "not_found") {
      setResult(null);
      setError(NOT_FOUND_MSG);
      setView("home");
      return;
    }
    setResult(data);
    setView(data?.state === "used" && data.redeemed ? "complete" : "result");
  }, []);

  const lookup = useCallback(
    async (raw, how) => {
      setBusy(true);
      setError("");
      setVia(how);
      try {
        const data = await api("/api/merchant/lunch/lookup", {
          method: "POST",
          body: JSON.stringify({ restaurantId: restaurant.id, code: raw }),
        });
        show(data);
      } catch (e) {
        setError(e.message);
        setView("home");
      } finally {
        setBusy(false);
      }
    },
    [api, restaurant.id, show],
  );

  const onScanned = useCallback((text) => lookup(text, "scan"), [lookup]);

  async function confirm() {
    const c = result?.customer?.code;
    if (!c || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/merchant/lunch/redeem", {
        method: "POST",
        body: JSON.stringify({ restaurantId: restaurant.id, code: c, via }),
      });
      show(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startScan() {
    setError("");
    setResult(null);
    setCode("");
    setView("scanning");
  }

  const customer = result?.customer || null;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-5">
      <Header merchantKey={merchantKey} restaurant={restaurant} />

      <div className="mt-5">
        {view === "scanning" ? <Scanner onCode={onScanned} onCancel={goHome} /> : null}

        {/* Screen 1 — Scan (home) */}
        {view === "home" ? (
          <>
            <button
              type="button"
              onClick={startScan}
              disabled={busy}
              data-testid="merchant-scan"
              className="flex w-full flex-col items-center rounded-2xl bg-gradient-to-br from-[#2486ff] to-[#005cff] px-4 pb-6 pt-7 text-white shadow-md transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2486ff]/40 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <span className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
                <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-white" />
                <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-white" />
                <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-white" />
                <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-lg border-b-[3px] border-r-[3px] border-white" />
                <ScanLine className="h-11 w-11" />
              </span>
              <span className="mt-4 text-xl font-bold">Scan QR code</span>
              <span className="mt-1 text-sm text-white/90">Point the camera at the learner&apos;s QR code</span>
            </button>

            <div className="mt-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-xs font-medium text-slate-500">or enter the code manually</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (hasCode && !busy) lookup(code, "typed");
              }}
            >
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="e.g. 9XP-Z6MW"
                  aria-label="E-coupon code"
                  aria-invalid={error ? true : undefined}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="h-[52px] w-full rounded-xl border border-black/10 bg-white pl-11 pr-14 font-mono text-base tracking-wider text-[#0d1b2a] outline-none placeholder:font-sans placeholder:tracking-normal focus:border-[#2486ff] focus:ring-2 focus:ring-[#2486ff]/20"
                />
                <button
                  type="button"
                  onClick={startScan}
                  disabled={busy}
                  aria-label="Scan QR code"
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#2486ff] hover:bg-[#2486ff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2486ff]/40 disabled:opacity-50"
                >
                  <QrCode className="h-5 w-5" />
                </button>
              </div>

              <InlineError>{error}</InlineError>

              <button
                type="submit"
                disabled={busy || !hasCode}
                data-testid="merchant-check"
                className={
                  hasCode
                    ? "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2486ff] text-base font-semibold text-white shadow-sm transition hover:bg-[#005cff] active:bg-[#005cff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2486ff]/40 disabled:opacity-60"
                    : "mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-slate-200 text-base font-semibold text-slate-500"
                }
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                Check
              </button>
            </form>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-500">Recent redemptions</h2>
                <Link
                  href={reportHref}
                  data-testid="merchant-usage-summary"
                  className="flex items-center gap-1.5 rounded-md text-sm font-semibold text-[#2486ff] hover:text-[#005cff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2486ff]/40"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Usage summary
                </Link>
              </div>
              <div className="mt-2 overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
                <table className="w-full text-left text-sm" data-testid="merchant-recent">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Nickname</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {recent.map((r, i) => (
                      <tr key={`${r.code}-${i}`}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums">{hm(r.usedAt)}</td>
                        <td className="px-3 py-2">{r.nickname || "-"}</td>
                        <td className="px-3 py-2">{r.name || "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{r.code}</td>
                      </tr>
                    ))}
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                          No redemptions yet today
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {view === "result" && result ? (
          <div data-testid="merchant-result" data-state={result.state}>
            {/* Screen 2 — Found, awaiting confirmation */}
            {result.state === "unused" && customer ? (
              <>
                <Card>
                  <div className="flex flex-col items-center text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700 ring-1 ring-green-600/20">
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Found
                    </span>
                    <p className="mt-3 font-mono text-2xl font-bold tracking-wider text-[#0d1b2a]">
                      {customer.code}
                    </p>
                  </div>
                  <div className="mt-3 border-t border-black/5">
                    <LearnerInfo c={customer} />
                  </div>
                </Card>
                <InlineError>{error}</InlineError>
                <div className="mt-5 flex flex-col gap-3">
                  <PrimaryButton onClick={confirm} disabled={busy} testId="merchant-confirm">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                    Confirm redemption
                  </PrimaryButton>
                  <SecondaryButton onClick={goHome} disabled={busy}>
                    Cancel
                  </SecondaryButton>
                </div>
              </>
            ) : null}

            {/* Screen 4 — Already used */}
            {result.state === "used" ? (
              <BlockedScreen
                tone="red"
                title="This coupon has already been used"
                body={result.usedAt ? `Used on ${atLabel(result.usedAt)}` : ""}
                customer={customer}
                onScan={startScan}
                onHome={goHome}
              />
            ) : null}

            {/* Screen 5 — Cancelled (มาได้ทั้งจาก lookup และ redeem) */}
            {result.state === "cancelled" ? (
              <BlockedScreen
                tone="orange"
                title="This coupon has been cancelled"
                body={result.cancelledAt ? `Cancelled on ${atLabel(result.cancelledAt)}` : "It can no longer be used"}
                customer={customer}
                onScan={startScan}
                onHome={goHome}
              />
            ) : null}

            {/* Screen 5 pattern — expired (หลังเวลาปิดของวัน) */}
            {result.state === "expired" ? (
              <BlockedScreen
                tone="orange"
                title="This coupon has expired"
                body="It can no longer be used"
                customer={customer}
                onScan={startScan}
                onHome={goHome}
              />
            ) : null}
          </div>
        ) : null}

        {/* Screen 3 — Redeemed successfully */}
        {view === "complete" && result ? (
          <div data-testid="merchant-complete">
            <div className="flex flex-col items-center pt-2 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
                <span className="absolute left-0 top-3 h-2.5 w-2.5 rounded-full bg-[#2486ff]/60" />
                <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-amber-400" />
                <span className="absolute -right-2 bottom-6 h-3 w-3 rounded-full bg-green-400" />
                <span className="absolute bottom-1 left-2 h-2 w-2 rounded-full bg-pink-400" />
                <span className="absolute -left-3 bottom-10 h-1.5 w-1.5 rounded-full bg-orange-400" />
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Check className="h-12 w-12" strokeWidth={3} />
                </div>
              </div>
              <h2 className="mt-3 text-xl font-bold text-[#0d1b2a]">Coupon redeemed</h2>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider text-[#0d1b2a]">
                {customer?.code || ""}
              </p>
              <p className="mt-1 text-sm text-slate-500">Redeemed on {atLabel(result.usedAt)}</p>
            </div>
            {customer ? (
              <Card className="mt-5">
                <p className="text-sm font-semibold text-[#0d1b2a]">Learner details</p>
                <div className="mt-1">
                  <LearnerInfo c={customer} />
                </div>
              </Card>
            ) : null}
            <div className="mt-5 flex flex-col gap-3">
              <PrimaryButton onClick={startScan} testId="merchant-scan-next">
                <ScanLine className="h-5 w-5" aria-hidden="true" />
                Scan next
              </PrimaryButton>
              <SecondaryButton href={reportHref}>View usage summary</SecondaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
