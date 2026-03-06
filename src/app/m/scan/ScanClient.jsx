// src/app/m/scan/ScanClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function clean(x) {
  return String(x ?? "").trim();
}

function pickEnvBase() {
  const b = clean(process.env.NEXT_PUBLIC_BASE_URL) || "";
  return b ? b.replace(/\/+$/, "") : "";
}

function isProbablyId(s) {
  return /^[A-Za-z0-9_-]{8,}$/.test(s);
}

function extractCouponIdFromPathname(pathname) {
  // /coupon/<publicId>
  const m = String(pathname || "").match(/^\/coupon\/([^\/?#]+)/);
  return m ? m[1] : "";
}

export default function ScanClient() {
  const router = useRouter();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(true);
  const [hint, setHint] = useState("กำลังเปิดกล้อง…");
  const [locked, setLocked] = useState(false);

  const BASE = useMemo(() => {
    return (
      pickEnvBase() ||
      (typeof window !== "undefined" ? window.location.origin : "")
    );
  }, []);

  // 1) ต้อง login ก่อน
  useEffect(() => {
    let canceled = false;

    (async () => {
      setBusy(true);
      const r = await fetch("/api/merchant/me", { cache: "no-store" });
      if (!r.ok) {
        const next = encodeURIComponent("/m/scan");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (canceled) return;

      if (!j?.ok) {
        const next = encodeURIComponent("/m/scan");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      setMe(j);
      setBusy(false);
    })();

    return () => {
      canceled = true;
    };
  }, [router]);

  // 2) เปิดกล้อง + สแกน QR
  useEffect(() => {
    if (!me) return;

    let cancelled = false;

    async function startScan() {
      setErr("");
      setHint("นำ QR ของลูกค้ามาไว้ในกรอบเพื่อสแกน");

      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();

        const videoEl = videoRef.current;
        if (!videoEl) throw new Error("NO_VIDEO_ELEMENT");

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoEl,
          async (result, error, controlsCb) => {
            if (cancelled) return;
            if (!result) return;
            if (locked) return;

            setLocked(true);
            setHint("สแกนสำเร็จ กำลังเปิดหน้าใช้งานคูปอง…");

            const rawText = result.getText?.() || "";
            const text = clean(rawText);

            try {
              // 1) QR เป็นลิงก์ /m/redeem?c=...
              try {
                const u = new URL(text, BASE || "http://localhost");

                if (u.pathname.startsWith("/m/redeem")) {
                  const c = u.searchParams.get("c");
                  if (c) {
                    controlsCb?.stop?.();
                    router.replace(`/m/redeem?c=${encodeURIComponent(c)}`);
                    return;
                  }
                }

                // 2) เผลอสแกน QR ลูกค้า (ไป /coupon/<id>)
                const couponId = extractCouponIdFromPathname(u.pathname);
                if (couponId) {
                  const rr = await fetch(
                    `/api/public/coupon/${encodeURIComponent(couponId)}`,
                    { cache: "no-store" },
                  );
                  const jj = await rr.json().catch(() => ({}));
                  const redeemCipher = jj?.item?.redeemCipher || "";

                  if (rr.ok && jj.ok && redeemCipher) {
                    controlsCb?.stop?.();
                    router.replace(
                      `/m/redeem?c=${encodeURIComponent(redeemCipher)}`,
                    );
                    return;
                  }

                  // fallback เปิดหน้า coupon ให้ร้านเห็น และให้สแกน QR ร้านจากหน้านั้น
                  controlsCb?.stop?.();
                  router.replace(`/coupon/${encodeURIComponent(couponId)}`);
                  return;
                }
              } catch {
                // ignore URL parse error
              }

              // 3) QR เป็น cipher ตรงๆ
              if (isProbablyId(text)) {
                controlsCb?.stop?.();
                router.replace(`/m/redeem?c=${encodeURIComponent(text)}`);
                return;
              }

              throw new Error("UNSUPPORTED_QR");
            } catch (e) {
              controlsCb?.stop?.();
              setErr(
                "QR นี้ไม่รองรับ กรุณาสแกน QR สำหรับร้านค้า (ที่อยู่ในหน้า /coupon)",
              );
              setLocked(false);
              setHint("สแกนไม่สำเร็จ ลองสแกนใหม่อีกครั้ง");
            }
          },
        );

        controlsRef.current = controls;
      } catch (e) {
        console.error(e);
        setErr(
          "เปิดกล้องไม่สำเร็จ (ตรวจสอบว่าใช้งานผ่าน https หรือ localhost และอนุญาตกล้องแล้ว)",
        );
        setHint("ไม่สามารถเปิดกล้องได้");
      }
    }

    startScan();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop?.();
      } catch {}
    };
  }, [me, router, BASE, locked]);

  const restaurantName = me?.restaurant?.name || "-";
  const logoUrl = me?.restaurant?.logoUrl || "";

  return (
    <div className="min-h-screen bg-[#F6F8FC] text-slate-900">
      {/* header gradient */}
      <div className="h-24 bg-gradient-to-r from-[#2B6CFF] via-[#66CCFF] to-[#F6B73C]" />

      <div className="-mt-14 px-4 pb-10">
        <div className="mx-auto max-w-xl">
          {/* Card */}
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* header row */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="logo"
                      className="h-12 w-12 rounded-2xl object-cover border border-slate-200 bg-white"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200" />
                  )}
                  <div>
                    <div className="text-xs text-slate-500">
                      Merchant • Scan
                    </div>
                    <div className="text-lg font-bold">{restaurantName}</div>
                  </div>
                </div>

                <button
                  className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-sm font-semibold"
                  onClick={() => router.push("/m/dashboard")}
                  title="กลับไปหน้า Dashboard"
                >
                  Dashboard
                </button>
              </div>

              <div className="mt-3 text-sm text-slate-600">{hint}</div>
              {err ? (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {err}
                </div>
              ) : null}
            </div>

            {/* camera frame */}
            <div className="px-5 pb-5">
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-[420px] object-cover"
                  muted
                  playsInline
                />

                {/* overlay scanner UI */}
                <div className="pointer-events-none absolute inset-0">
                  {/* darken edges */}
                  <div className="absolute inset-0 bg-black/25" />

                  {/* scan box */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative h-[240px] w-[240px] rounded-2xl border-2 border-white/80">
                      {/* corner accents */}
                      <div className="absolute -left-[2px] -top-[2px] h-8 w-8 border-l-4 border-t-4 border-[#66CCFF] rounded-tl-2xl" />
                      <div className="absolute -right-[2px] -top-[2px] h-8 w-8 border-r-4 border-t-4 border-[#66CCFF] rounded-tr-2xl" />
                      <div className="absolute -left-[2px] -bottom-[2px] h-8 w-8 border-l-4 border-b-4 border-[#66CCFF] rounded-bl-2xl" />
                      <div className="absolute -right-[2px] -bottom-[2px] h-8 w-8 border-r-4 border-b-4 border-[#66CCFF] rounded-br-2xl" />

                      {/* scan line */}
                      <div className="absolute left-3 right-3 top-1/2 h-[2px] bg-[#66CCFF]/90 shadow-[0_0_18px_rgba(102,204,255,0.9)]" />
                    </div>
                  </div>

                  {/* bottom helper */}
                  <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
                    วาง QR ให้อยู่ในกรอบ • ระบบจะเปิดหน้า Redeem ให้อัตโนมัติ
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="mt-4 flex gap-3">
                <button
                  className="flex-1 rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => window.location.reload()}
                >
                  เริ่มสแกนใหม่
                </button>

                {/* <button
                  className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 font-semibold"
                  onClick={() => router.push("/m/login")}
                >
                  เปลี่ยนบัญชี
                </button> */}
              </div>

              <div className="mt-3 text-xs text-slate-500">
                * แนะนำเปิดผ่าน <b>https</b> (หรือ <b>localhost</b>)
                เพื่อให้กล้องทำงานบนมือถือได้
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              Tip: ถ้าเผลอสแกน QR จากหน้า /coupon ระบบจะพยายามดึง redeemCipher
              แล้วพาไปหน้า Redeem ให้อัตโนมัติ
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500">
            © 9Expert Training
          </div>
        </div>
      </div>
    </div>
  );
}
