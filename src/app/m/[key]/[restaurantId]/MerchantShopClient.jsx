"use client";

// C3d: Merchant shop page — English only, mobile-first, no prices anywhere
//   home     : logo + name, Scan QR (primary), or enter code + Check, Recent redemptions + Usage summary link
//   scanning : camera (@zxing/browser, same reader as the old ScanClient)
//   result   : unused (info + Confirm) / used (Used at hh:mm) / expired / not_found
//   complete : Back, or auto-return to home after 3 s
// ทุก API ส่ง header x-merchant-key — server เป็นคนตัดสินทั้งหมด (ร้าน วัน เวลาปิด)
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Clock, Ban, XCircle, ArrowLeft, BarChart3 } from "lucide-react";

import { ShopLogo, LAST_SHOP_KEY } from "../ShopPickerClient";

const AUTO_RETURN_MS = 3000;

function hm(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function dateLabel(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

// รูปแบบเดียวกับ normalizeECouponCode (merchantLunch.server.js) — ใช้แค่เปิด/ปิดปุ่ม Check, server ตัดสินจริง
function isCodeShaped(input) {
  const s = String(input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^9XP[A-Z0-9]{4}$/.test(s) || /^[A-Z0-9]{4}$/.test(s);
}

/* ---------------- views ---------------- */

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-[#0d1b2a]">
        {children || "-"}
      </span>
    </div>
  );
}

function CustomerCard({ c }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" data-testid="merchant-customer">
      <p className="text-center font-mono text-lg font-bold tracking-widest text-[#0d1b2a]">
        {c.code}
      </p>
      <div className="mt-3 divide-y divide-black/5">
        <Row label="Nickname">{c.nickname}</Row>
        <Row label="First name">{c.firstName}</Row>
        <Row label="Last name">{c.lastName}</Row>
        <Row label="Room / Class">
          {[c.room, c.className].filter(Boolean).join(" · ")}
        </Row>
        <Row label="Date">{dateLabel(c.dayYMD)}</Row>
      </div>
      <div className="mt-3 border-t border-black/5 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Food items</p>
        {c.mode === "at_shop" ? (
          <p className="mt-2 text-sm text-[#0d1b2a]">Ordering at the shop (no pre-order)</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {(c.items || []).map((it, i) => (
              <li key={i} className="text-sm text-[#0d1b2a]">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{it.name}</span>
                  <span className="shrink-0 text-slate-500">×{it.qty}</span>
                </div>
                {it.options?.length ? (
                  <p className="text-xs text-slate-500">{it.options.join(", ")}</p>
                ) : null}
                {it.note ? <p className="text-xs italic text-slate-500">“{it.note}”</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Notice({ icon: Icon, tone, title, body }) {
  const ring =
    tone === "green"
      ? "bg-green-100 text-green-700"
      : tone === "amber"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${ring}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-bold text-[#0d1b2a]">{title}</h2>
      {body ? <p className="text-sm text-slate-500">{body}</p> : null}
    </div>
  );
}

function BackScanButtons({ onBack, onScan }) {
  return (
    <div className="mt-5 flex gap-3">
      <button
        type="button"
        onClick={onBack}
        className="h-12 flex-1 rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a] active:scale-[0.98]"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onScan}
        className="h-12 flex-1 rounded-xl bg-[#2486ff] text-base font-semibold text-white active:scale-[0.98]"
      >
        Scan again
      </button>
    </div>
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
      <div className="overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      </div>
      <p className="mt-3 text-center text-sm text-slate-500">
        {err || "Point the camera at the customer's e-coupon QR"}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 h-12 w-full rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a]"
      >
        Cancel
      </button>
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
  const codeOk = isCodeShaped(code);

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

  // Complete -> กลับหน้าแรกเองหลัง 3 วินาที
  useEffect(() => {
    if (view !== "complete") return undefined;
    const t = setTimeout(() => goHome(), AUTO_RETURN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function goHome() {
    setView("home");
    setResult(null);
    setError("");
    setCode("");
    loadRecent();
  }

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
        setResult(data);
        setView("result");
      } catch (e) {
        setError(e.message);
        setView("home");
      } finally {
        setBusy(false);
      }
    },
    [api, restaurant.id],
  );

  const onScanned = useCallback((text) => lookup(text, "scan"), [lookup]);

  async function confirm() {
    const c = result?.customer?.code;
    if (!c) return;
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/merchant/lunch/redeem", {
        method: "POST",
        body: JSON.stringify({ restaurantId: restaurant.id, code: c, via }),
      });
      setResult(data);
      setView(data.state === "used" && data.redeemed ? "complete" : "result");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startScan() {
    setError("");
    setResult(null);
    setView("scanning");
  }

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-5">
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

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="merchant-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        {view === "scanning" ? (
          <Scanner onCode={onScanned} onCancel={goHome} />
        ) : null}

        {view === "home" ? (
          <>
            <button
              type="button"
              onClick={startScan}
              disabled={busy}
              data-testid="merchant-scan"
              className="flex min-h-[112px] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-[#005cff] px-4 py-3 text-white shadow-card transition hover:bg-[#004bd1] active:scale-[0.99] active:bg-[#004bd1] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#005cff]/40 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <Camera className="h-8 w-8" aria-hidden="true" />
              <span className="text-xl font-bold">Scan QR</span>
              <span className="text-sm text-white/90">Point the camera at the learner&apos;s QR code</span>
            </button>

            <div className="mt-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-xs font-medium text-slate-500">or enter code</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (codeOk) lookup(code, "typed");
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 9XP-B6MW"
                aria-label="E-coupon code"
                autoCapitalize="characters"
                autoComplete="off"
                className="h-[52px] min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 font-mono text-base uppercase tracking-wider outline-none placeholder:normal-case placeholder:tracking-normal focus:border-[#2486ff] focus:ring-2 focus:ring-[#2486ff]/20"
              />
              <button
                type="submit"
                disabled={busy || !codeOk}
                className={
                  codeOk
                    ? "h-[52px] shrink-0 rounded-xl bg-[#2486ff] px-5 text-base font-semibold text-white transition hover:bg-[#005cff] active:bg-[#005cff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2486ff]/40 disabled:opacity-60"
                    : "h-[52px] shrink-0 rounded-xl bg-slate-200 px-5 text-base font-semibold text-slate-500"
                }
              >
                {busy ? "…" : "Check"}
              </button>
            </form>

            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-500">Recent redemptions</h2>
                <Link
                  href={`/m/${merchantKey}/${restaurant.id}/report`}
                  data-testid="merchant-usage-summary"
                  className="flex items-center gap-1.5 rounded-md text-sm font-semibold text-[#2486ff] hover:text-[#005cff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2486ff]/40"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Usage summary
                </Link>
              </div>
              <div className="mt-2 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
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
            {result.state === "unused" ? (
              <>
                <CustomerCard c={result.customer} />
                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={goHome}
                    disabled={busy}
                    className="h-12 flex-1 rounded-xl border border-black/10 bg-white text-base font-medium text-[#0d1b2a] disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={busy}
                    className="h-12 flex-[1.4] rounded-xl bg-[#2486ff] text-base font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Confirming…" : "Confirm"}
                  </button>
                </div>
              </>
            ) : null}

            {result.state === "used" ? (
              <>
                <Notice
                  icon={Ban}
                  tone="amber"
                  title="This e-coupon has already been used"
                  body={`Used at ${hm(result.usedAt)}`}
                />
                {result.customer ? (
                  <div className="mt-4">
                    <CustomerCard c={result.customer} />
                  </div>
                ) : null}
                <BackScanButtons onBack={goHome} onScan={startScan} />
              </>
            ) : null}

            {result.state === "expired" ? (
              <>
                <Notice
                  icon={Clock}
                  tone="red"
                  title={`This e-coupon has expired (valid until ${result.validUntil || ""})`}
                />
                <BackScanButtons onBack={goHome} onScan={startScan} />
              </>
            ) : null}

            {result.state === "not_found" ? (
              <>
                <Notice
                  icon={XCircle}
                  tone="red"
                  title="Code not found for this restaurant today"
                />
                <BackScanButtons onBack={goHome} onScan={startScan} />
              </>
            ) : null}
          </div>
        ) : null}

        {view === "complete" && result ? (
          <div data-testid="merchant-complete">
            <Notice
              icon={CheckCircle2}
              tone="green"
              title="Complete"
              body={`${result.customer?.code || ""} · used at ${hm(result.usedAt)}`}
            />
            <button
              type="button"
              onClick={goHome}
              className="mt-5 h-12 w-full rounded-xl bg-[#2486ff] text-base font-semibold text-white"
            >
              Back
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">Returning automatically…</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
