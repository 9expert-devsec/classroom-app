"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

async function shareUrl(url) {
  const text = "คูปองส่วนลดอาหาร 9Expert";
  if (navigator.share) {
    await navigator.share({ title: "9Expert Coupon", text, url });
    return;
  }
  // fallback: LINE share
  window.open(
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
    "_blank",
  );
}

export default function CouponPublicClient({ publicId }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState(null);

  const BASE = useMemo(() => {
    // ✅ ห้ามใช้ window.location.origin ใน dev เพราะมันจะเป็น localhost
    // ให้ใช้ NEXT_PUBLIC_BASE_URL เป็นหลัก
    const b =
      clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://register.9expert.app";
    return b.replace(/\/+$/, "");
  }, []);

  const pageUrl = useMemo(() => {
    if (!publicId) return "";
    return `${BASE}/coupon/${encodeURIComponent(publicId)}`;
  }, [BASE, publicId]);

  useEffect(() => {
    if (!publicId) {
      setErr("MISSING_PUBLIC_ID");
      setLoading(false);
      return;
    }
    let canceled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(
          `/api/public/coupon/${encodeURIComponent(publicId)}`,
        );
        const j = await r.json().catch(() => ({}));
        if (canceled) return;
        if (!r.ok || !j.ok) throw new Error(j.error || "LOAD_FAILED");
        setCoupon(j.item);
      } catch (e) {
        setErr(String(e?.message || "LOAD_FAILED"));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [publicId]);

  const merchantRedeemUrl = useMemo(() => {
    if (!coupon?.redeemCipher) return "";
    return `${BASE}/m/redeem?c=${encodeURIComponent(coupon.redeemCipher)}`;
  }, [BASE, coupon?.redeemCipher]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        กำลังโหลดคูปอง…
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">ไม่สามารถโหลดคูปองได้</div>
          <div className="mt-2 text-white/70 text-sm">{err}</div>
        </div>
      </div>
    );
  }

  const status = coupon?.status || "issued";
  const isUsed = status !== "issued";

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5">
          <div className="text-center">
            <div className="text-xl font-bold">9Expert Cash Coupon</div>
            <div className="mt-1 text-sm text-white/60">
              ใช้ได้ที่ CASA LAPIN และ Kaizen Sushi&Hibachi (ใช้ได้ 1 ครั้ง)
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-4 text-slate-900">
            <div className="text-center text-sm text-slate-500">
              {isUsed
                ? "คูปองนี้ถูกใช้แล้ว"
                : "ให้ร้านค้าสแกน QR ด้านล่างเพื่อใช้คูปอง"}
            </div>

            <div className="mt-3 flex items-center justify-center">
              {merchantRedeemUrl ? (
                <QRCode value={merchantRedeemUrl} size={190} />
              ) : (
                <div className="text-sm text-slate-500">QR ไม่พร้อมใช้งาน</div>
              )}
            </div>

            <div className="mt-3 text-center text-sm text-slate-500">
              Ref.{" "}
              <span className="font-semibold text-slate-900">
                {coupon?.displayCode || "-"}
              </span>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">เจ้าของคูปอง</span>
                <span className="font-medium">{coupon?.holderName || "-"}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">หลักสูตร</span>
                <span className="font-medium text-right">
                  {coupon?.courseName || "-"}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">ห้องอบรม</span>
                <span className="font-medium">{coupon?.roomName || "-"}</span>
              </div>
              <div className="flex justify-between mt-2 border-t pt-2">
                <span className="text-slate-500">มูลค่าคูปอง</span>
                <span className="font-semibold">
                  {fmtMoney(coupon?.couponPrice || 180)} บาท
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => shareUrl(pageUrl)}
              className="rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 px-4 py-3 font-semibold"
            >
              Share ไป LINE
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(pageUrl)}
              className="rounded-2xl bg-white/10 hover:bg-white/15 px-4 py-3 font-semibold"
            >
              Copy Link
            </button>
          </div>

          <div className="mt-3 text-xs text-white/50 text-center">
            ลิงก์หน้านี้: {pageUrl}
          </div>
        </div>
      </div>
    </div>
  );
}
