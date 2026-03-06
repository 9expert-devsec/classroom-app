// src/app/coupon/[publicId]/CouponPublicClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import localFont from "next/font/local";

const lineSeedSansTH = localFont({
  src: [
    {
      path: "../../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    {
      path: "../../../../public/fonts/GoogleSans-Bold.ttf",
      weight: "700",
    },
  ],
  display: "swap",
});

function clean(x) {
  return String(x ?? "").trim();
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return x.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function fmtDateTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function fmtTimeTH(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

function toBkkYMD(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function issuedAtOf(coupon) {
  return (
    coupon?.issuedAt ||
    coupon?.createdAt ||
    coupon?.generatedAt ||
    coupon?.updatedAt ||
    ""
  );
}

function dayYMDOf(coupon) {
  const ymd = clean(coupon?.dayYMD);
  if (ymd) return ymd;

  const issuedAt = issuedAtOf(coupon);
  return issuedAt ? toBkkYMD(issuedAt) : "";
}

function expireAtOf(coupon) {
  if (coupon?.expiresAt) {
    const direct = new Date(coupon.expiresAt);
    if (!Number.isNaN(direct.getTime())) return direct;
  }

  const ymd = dayYMDOf(coupon);
  if (!ymd) return null;

  const dt = new Date(`${ymd}T15:00:00+07:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function shareUrl(url) {
  const text = "คูปองส่วนลดอาหาร 9Expert";
  if (navigator.share) {
    await navigator.share({ title: "9Expert Coupon", text, url });
    return;
  }
  window.open(
    `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
    "_blank",
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CouponPublicClient({ publicId }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [coupon, setCoupon] = useState(null);

  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [nowTs, setNowTs] = useState(Date.now());

  const qrWrapRef = useRef(null);
  const toastTimerRef = useRef(null);

  const BASE = useMemo(() => {
    const b =
      clean(process.env.NEXT_PUBLIC_BASE_URL) || "https://register.9expert.app";
    return b.replace(/\/+$/, "");
  }, []);

  const pageUrl = useMemo(() => {
    if (!publicId) return "";
    return `${BASE}/coupon/${encodeURIComponent(publicId)}`;
  }, [BASE, publicId]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

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
          {
            cache: "no-store",
          },
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

  const issuedAt = useMemo(() => issuedAtOf(coupon), [coupon]);
  const expireAt = useMemo(() => expireAtOf(coupon), [coupon]);
  const couponDayYMD = useMemo(() => dayYMDOf(coupon), [coupon]);

  const expiredByTime = useMemo(() => {
    if (!expireAt) return false;
    return nowTs >= expireAt.getTime();
  }, [nowTs, expireAt]);

  const rawStatus = clean(coupon?.status || "issued").toLowerCase();

  const effectiveStatus = useMemo(() => {
    if (rawStatus === "redeemed") return "redeemed";
    if (rawStatus === "expired") return "expired";
    if (expiredByTime) return "expired";
    return "issued";
  }, [rawStatus, expiredByTime]);

  const isReady = effectiveStatus === "issued";
  const isUsed = effectiveStatus === "redeemed";
  const isExpired = effectiveStatus === "expired";

  const statusLabel = isUsed
    ? "ใช้แล้ว"
    : isExpired
      ? "หมดอายุ"
      : "พร้อมใช้งาน";

  const statusClass = isUsed
    ? "bg-amber-100 text-amber-700"
    : isExpired
      ? "bg-rose-100 text-rose-700"
      : "bg-emerald-100 text-emerald-700";

  const activeRedeemUrl = isReady ? merchantRedeemUrl : "";

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1200);
  }

  async function handleCopyLink() {
    if (!pageUrl) return;
    const ok = await copyText(pageUrl);
    showToast(ok ? "คัดลอกลิงก์แล้ว" : "คัดลอกไม่สำเร็จ");
  }

  async function handleSaveQr() {
    if (!activeRedeemUrl) {
      showToast(isExpired ? "คูปองหมดอายุแล้ว" : "คูปองนี้ไม่พร้อมใช้งาน");
      return;
    }

    const wrap = qrWrapRef.current;
    const svg = wrap?.querySelector("svg");
    if (!svg) {
      showToast("หา QR ไม่เจอ");
      return;
    }

    setSaving(true);
    try {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);

      const svgBlob = new Blob([svgStr], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
        img.src = svgUrl;
      });

      const size = 240;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = size * scale;
      canvas.height = size * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("NO_CANVAS_CTX");

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(svgUrl);

      const blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("PNG_EXPORT_FAILED");

      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const displayCode = clean(coupon?.displayCode) || "coupon";
      a.href = pngUrl;
      a.download = `9expert-qr-${displayCode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(pngUrl);

      showToast("บันทึก QR แล้ว");
    } catch (e) {
      console.error(e);
      showToast("บันทึก QR ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] text-slate-900 flex items-center justify-center">
        กำลังโหลดคูปอง…
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] text-slate-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-2xl bg-white p-5">
          <div className="text-lg font-semibold">ไม่สามารถโหลดคูปองได้</div>
          <div className="mt-2 text-slate-500 text-sm">{err}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto h-screen bg-[#F6F8FC] text-slate-900 ${lineSeedSansTH.className}`}
    >
      <div className="pt-6 px-4 pb-10">
        <div className="mx-auto max-w-md">
          <div className="relative">
            <div className="drop-shadow-xl">
              <div
                className="bg-white rounded-[28px] overflow-hidden
                [-webkit-mask-image:radial-gradient(circle_20px_at_0_33.5%,transparent_99%,#000_100%),radial-gradient(circle_20px_at_100%_33.5%,transparent_99%,#000_100%),linear-gradient(#000,#000)]
                [-webkit-mask-composite:xor]
                [-webkit-mask-repeat:no-repeat]
                [-webkit-mask-size:100%_100%]"
              >
                <div className="px-6 pt-6 pb-5 text-center bg-gradient-to-r from-[#2486ff] to-[#48b0ff]">
                  <img
                    src="/logo-9experttraining-white-color (2).png"
                    alt="9Expert Training"
                    className="mx-auto h-12 w-auto"
                  />

                  <div className="mt-3 text-[26px] font-bold text-white">
                    Cash Coupon
                  </div>

                  <div className="mt-1 text-2xl font-bold tracking-tight text-white">
                    {fmtMoney(coupon?.couponPrice || 180)} THB
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-xs text-white">Status:</span>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusClass,
                      ].join(" ")}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* <div className="mt-2 text-[12px] text-white/90">
                    ใช้ได้ภายในเวลา <b>15:00 น.</b> ของวันคูปอง
                  </div> */}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => shareUrl(pageUrl)}
                      className="rounded-2xl bg-[#4cc764] hover:bg-[#06c755] text-white px-4 py-3 font-semibold"
                    >
                      Share ไป LINE
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 font-semibold"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="relative px-6">
                    <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-4 border-dashed border-[#f5f7fa]" />
                  </div>
                </div>

                <div className="px-6 pt-5 pb-6 text-center">
                  <div className="text-xs text-slate-500">
                    {isUsed
                      ? "คูปองนี้ถูกใช้แล้ว (สแกนซ้ำไม่ได้)"
                      : isExpired
                        ? "คูปองนี้หมดอายุแล้ว ไม่สามารถใช้ได้"
                        : "ให้ร้านค้าสแกน QR ด้านล่างเพื่อใช้คูปอง"}
                  </div>

                  <div
                    ref={qrWrapRef}
                    className="mt-3 mx-auto w-fit rounded-2xl bg-white border border-slate-200 p-4"
                  >
                    {activeRedeemUrl ? (
                      <QRCode value={activeRedeemUrl} size={190} />
                    ) : (
                      <div className="w-[190px] h-[190px] grid place-items-center text-sm text-slate-500">
                        {isExpired ? "คูปองหมดอายุแล้ว" : "QR ไม่พร้อมใช้งาน"}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 text-sm text-slate-600">
                    Ref.{" "}
                    <span className="font-extrabold text-slate-900">
                      {coupon?.displayCode || "-"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-left">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">เจ้าของคูปอง</span>
                      <span className="font-medium text-right">
                        {coupon?.holderName || "-"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">หลักสูตร</span>
                      <span className="font-medium text-right">
                        {coupon?.courseName || "-"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">ห้องอบรม</span>
                      <span className="font-medium text-right">
                        {coupon?.roomName || "-"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">วันที่ออกคูปอง</span>
                      <span className="font-medium text-right">
                        {fmtDateTH(issuedAt)} {"เวลา"}  {issuedAt ? `${fmtTimeTH(issuedAt)} น.` : "-"}
                      </span>
                    </div>


                    <div className="flex justify-between gap-3 mt-1">
                      <span className="text-slate-500">ใช้ได้ถึง</span>
                      <span className="font-medium text-right">
                        {expireAt
                          ? `${fmtDateTH(expireAt)} เวลา ${fmtTimeTH(expireAt)} น.`
                          : couponDayYMD
                            ? `${fmtDateTH(`${couponDayYMD}T15:00:00+07:00`)} เวลา 15:00 น.`
                            : "15:00 น. ของวันคูปอง"}
                      </span>
                    </div>

                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <button
                      onClick={handleSaveQr}
                      disabled={!activeRedeemUrl || saving}
                      className="rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 font-semibold disabled:opacity-60"
                      title="บันทึก QR เป็นรูป PNG"
                    >
                      {saving
                        ? "กำลังบันทึก..."
                        : isExpired
                          ? "คูปองหมดอายุแล้ว"
                          : isUsed
                            ? "คูปองถูกใช้แล้ว"
                            : "บันทึก QR ลงเครื่อง"}
                    </button>
                  </div>

                  {/* <div className="mt-3 text-[11px] text-slate-500 break-all">
                    ลิงก์หน้านี้: {pageUrl}
                  </div> */}
                </div>
              </div>

              {toast ? (
                <div className="fixed left-1/2 top-4 -translate-x-1/2 z-[90] rounded-full bg-black/80 px-4 py-2 text-xs text-white">
                  {toast}
                </div>
              ) : null}
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
