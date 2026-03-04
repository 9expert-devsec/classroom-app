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
    // ใช้เป็น base สำหรับ parse URL จาก QR (เผื่อ QR เป็น path ล้วน)
    return (
      pickEnvBase() ||
      (typeof window !== "undefined" ? window.location.origin : "")
    );
  }, []);

  // 1) ต้อง login ก่อน
  useEffect(() => {
    (async () => {
      setBusy(true);
      const r = await fetch("/api/merchant/me");
      if (!r.ok) {
        const next = encodeURIComponent("/m/scan");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (!j?.ok) {
        const next = encodeURIComponent("/m/scan");
        router.replace(`/m/login?next=${next}`);
        return;
      }
      setMe(j);
      setBusy(false);
    })();
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

        // เริ่มสแกนจากกล้อง default (มือถือส่วนใหญ่จะเลือกกล้องหลังเอง)
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
              // กรณี 1: QR เป็นลิงก์ /m/redeem?c=...
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

                // กรณี 2: เผลอสแกน QR ลูกค้า (ไป /coupon/<id>)
                const couponId = extractCouponIdFromPathname(u.pathname);
                if (couponId) {
                  const rr = await fetch(
                    `/api/public/coupon/${encodeURIComponent(couponId)}`,
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

              // กรณี 3: QR เป็น cipher ตรงๆ (c=...)
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
            }
          },
        );

        controlsRef.current = controls;
      } catch (e) {
        // ถ้าเป็น http ไม่ปลอดภัยบนมือถือ -> จะเจอ NotAllowedError/NotSupportedError
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-white/60">ร้านค้า</div>
              <div className="text-lg font-semibold">
                {me?.restaurant?.name || "-"}
              </div>
            </div>
            <button
              className="rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-sm font-semibold"
              onClick={() => router.push("/m/redeem")}
              title="ไปหน้า Redeem (ต้องมี QR param)"
            >
              Redeem
            </button>
          </div>

          <div className="mt-3 text-sm text-white/70">{hint}</div>
          {err ? <div className="mt-2 text-sm text-red-300">{err}</div> : null}

          <div className="mt-4 rounded-2xl overflow-hidden ring-1 ring-white/10 bg-black">
            {/* video สำหรับกล้อง */}
            <video
              ref={videoRef}
              className="w-full h-[380px] object-cover"
              muted
              playsInline
            />
          </div>

          <div className="mt-4 flex gap-3">
            <button
              className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-3 font-semibold disabled:opacity-60"
              disabled={busy}
              onClick={() => window.location.reload()}
            >
              เริ่มสแกนใหม่
            </button>
            <button
              className="rounded-xl bg-white/10 hover:bg-white/15 px-4 py-3 font-semibold"
              onClick={() => router.push("/m/login")}
            >
              เปลี่ยนบัญชี
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50">
            * แนะนำเปิดผ่าน https (หรือ localhost) เพื่อให้กล้องทำงานบนมือถือได้
          </div>
        </div>
      </div>
    </div>
  );
}
