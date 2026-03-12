// src/app/coupon/[publicId]/CouponPublicClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import localFont from "next/font/local";
import { Copy } from "lucide-react";

import { toPng } from "html-to-image";
import CouponExportCard from "@/components/coupon/CouponExportCard";

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

const COUPON_TERMS = [
  {
    title:
      "คูปองนี้มีมูลค่า 180 บาท ใช้แทนเงินสดได้เฉพาะที่ร้านอาหารที่ระบุไว้บนคูปอง และใช้ได้เพียงหนึ่งร้านเท่านั้น",
    subs: ["ไม่สามารถนำยอดเงินที่เหลือจากคูปองของร้านหนึ่งไปใช้กับอีกร้านได้"],
  },
  {
    title: "สามารถใช้ได้เฉพาะ วันและเวลาที่ระบุไว้ในคูปองเท่านั้น",
  },
  {
    title: "คูปองนี้ไม่สามารถแลกเปลี่ยน หรือทอนเป็นเงินสดได้",
  },
  {
    title:
      "ในกรณีที่ยอดใช้บริการเกินมูลค่าคูปอง ผู้ใช้ต้องชำระส่วนต่างที่เกินด้วยตนเอง หากผู้ใช้ต้องการใบเสร็จรับเงินหรือบิลแยกส่วนต่างเพื่อการเบิกค่าใช้จ่าย",
    subs: [
      "ร้านไคเซ็น: ลูกค้าสามารถขอใบเสร็จรับเงินเฉพาะส่วนต่างที่ชำระเองได้",
      "ร้านคาซ่า: ลูกค้าไม่สามารถออกใบเสร็จส่วนต่างได้",
    ],
  },
  {
    title:
      "คูปองนี้ หมดอายุทันทีหลังเวลาที่กำหนด และ ไม่สามารถขยายระยะเวลาการใช้งานได้",
  },
  {
    title:
      "ทางร้านและบริษัท ขอสงวนสิทธิ์ไม่รับผิดชอบต่อความเสียหาย สูญหาย หรือการชำรุดของคูปอง",
  },
  {
    title: "ระยะเวลาในการเตรียมและจัดเสิร์ฟอาหารขึ้นอยู่กับร้านอาหารเท่านั้น",
  },
  {
    title:
      "ทางบริษัท ขอสงวนสิทธิ์ในการเปลี่ยนแปลงเงื่อนไขโดยไม่ต้องแจ้งให้ทราบล่วงหน้า",
  },
];

const COUPON_NOTE =
  "หมายเหตุ : กรณีลูกค้าเลือกใช้สิทธิ์เป็นคูปอง จะไม่สามารถเลือกเมนูอาหารของทางโรงแรมเอเวอร์กรีนได้ทุกกรณี";

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
  const [flipped, setFlipped] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const couponExportRef = useRef(null);

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
    const mq = window.matchMedia("(orientation: landscape)");

    function updateOrientation() {
      const landscape = mq.matches;
      const tabletOrMobile = window.innerWidth <= 1366;
      setIsLandscape(landscape && tabletOrMobile);
    }

    updateOrientation();
    mq.addEventListener?.("change", updateOrientation);
    window.addEventListener("resize", updateOrientation);

    return () => {
      mq.removeEventListener?.("change", updateOrientation);
      window.removeEventListener("resize", updateOrientation);
    };
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

  const stampSrc = isExpired
      ? "/stamps/expired-stamp.svg"
      : isUsed
        ? "/stamps/redeemed-stamp.svg"
        : "";

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

  const qrDisplayUrl = merchantRedeemUrl || "";

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

  // async function handleSaveQr() {
  //   if (!activeRedeemUrl) {
  //     showToast(isExpired ? "คูปองหมดอายุแล้ว" : "คูปองนี้ไม่พร้อมใช้งาน");
  //     return;
  //   }

  //   const wrap = qrWrapRef.current;
  //   const svg = wrap?.querySelector("svg");
  //   if (!svg) {
  //     showToast("หา QR ไม่เจอ");
  //     return;
  //   }

  //   setSaving(true);
  //   try {
  //     const serializer = new XMLSerializer();
  //     const svgStr = serializer.serializeToString(svg);

  //     const svgBlob = new Blob([svgStr], {
  //       type: "image/svg+xml;charset=utf-8",
  //     });
  //     const svgUrl = URL.createObjectURL(svgBlob);

  //     const img = new Image();
  //     img.crossOrigin = "anonymous";

  //     await new Promise((resolve, reject) => {
  //       img.onload = () => resolve(true);
  //       img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
  //       img.src = svgUrl;
  //     });

  //     const size = 240;
  //     const scale = 2;
  //     const canvas = document.createElement("canvas");
  //     canvas.width = size * scale;
  //     canvas.height = size * scale;

  //     const ctx = canvas.getContext("2d");
  //     if (!ctx) throw new Error("NO_CANVAS_CTX");

  //     ctx.fillStyle = "#FFFFFF";
  //     ctx.fillRect(0, 0, canvas.width, canvas.height);
  //     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  //     URL.revokeObjectURL(svgUrl);

  //     const blob = await new Promise((resolve) =>
  //       canvas.toBlob((b) => resolve(b), "image/png"),
  //     );
  //     if (!blob) throw new Error("PNG_EXPORT_FAILED");

  //     const pngUrl = URL.createObjectURL(blob);
  //     const a = document.createElement("a");
  //     const displayCode = clean(coupon?.displayCode) || "coupon";
  //     a.href = pngUrl;
  //     a.download = `9expert-qr-${displayCode}.png`;
  //     document.body.appendChild(a);
  //     a.click();
  //     a.remove();
  //     URL.revokeObjectURL(pngUrl);

  //     showToast("บันทึก QR แล้ว");
  //   } catch (e) {
  //     console.error(e);
  //     showToast("บันทึก QR ไม่สำเร็จ");
  //   } finally {
  //     setSaving(false);
  //   }
  // }

  async function handleSaveQr() {
    const node = couponExportRef.current;
    if (!node) {
      showToast("ไม่พบคูปองสำหรับบันทึก");
      return;
    }


    setSaving(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#F6F8FC",
      });

      const a = document.createElement("a");
      const displayCode = clean(coupon?.displayCode) || "coupon";
      a.href = dataUrl;
      a.download = `9expert-coupon-${displayCode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast("บันทึกคูปองแล้ว");
    } catch (e) {
      console.error(e);
      showToast("บันทึกคูปองไม่สำเร็จ");
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

  if (isLandscape) {
    return (
      <div
        className={`h-dvh bg-[#F6F8FC] text-slate-900 ${lineSeedSansTH.className}`}
      >
        <div className="flex h-full items-center justify-center p-6 text-center">
          <div className="max-w-sm rounded-[28px] bg-white p-6 shadow-xl">
            <div className="text-xl font-bold text-slate-800">
              กรุณาหมุนอุปกรณ์เป็นแนวตั้ง
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-500">
              หน้าคูปองนี้รองรับการใช้งานแบบแนวตั้ง เพื่อให้แสดงผลได้ถูกต้อง
            </div>

            <div className="mt-5 text-5xl">📱</div>

            <div className="mt-5 text-xs text-slate-400">
              Please rotate your device to portrait mode.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto h-dvh bg-[#F6F8FC] text-slate-900 ${lineSeedSansTH.className}`}
    >
      <div className="h-full p-4">
        <div className="mx-auto flex flex-col h-full max-w-md">
          <div
            className="relative min-h-0 flex-1"
            style={{ perspective: "1400px" }}
          >
            <div
              className="relative h-full overflow-hidden drop-shadow-2xl"
              style={{
                transformStyle: "preserve-3d",
                WebkitTransformStyle: "preserve-3d",
              }}
            >
              {/* Front */}
              <div
                aria-hidden={flipped}
                className={
                  flipped
                    ? "pointer-events-none absolute inset-0 h-full"
                    : "pointer-events-auto absolute inset-0 h-full"
                }
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: flipped
                    ? "rotateY(180deg) translateZ(0)"
                    : "rotateY(0deg) translateZ(0)",
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  transition: "transform 500ms, opacity 180ms",
                  opacity: flipped ? 0 : 1,
                  zIndex: flipped ? 0 : 2,
                }}
              >
                <div className="h-full rounded-[28px] overflow-hidden ">
                  <div
                    className="h-full bg-white rounded-[28px] overflow-hidden
                [-webkit-mask-image:radial-gradient(circle_20px_at_0_155px,transparent_99%,#000_100%),radial-gradient(circle_20px_at_100%_155px,transparent_99%,#000_100%),linear-gradient(#000,#000)]
  [-webkit-mask-composite:xor]
  [-webkit-mask-repeat:no-repeat]
  [-webkit-mask-size:100%_100%]"
                  >
                    <div className="flex h-full flex-col">
                      <div className="shrink-0 px-6 pt-6 pb-4 text-center bg-gradient-to-r from-[#2486ff] to-[#48b0ff]">
                        <img
                          src="/logo-9experttraining-white-color-2.png"
                          alt="9Expert Training"
                          className="mx-auto h-10 w-auto"
                        />

                        <div className="mt-2 text-[22px] font-bold text-white">
                          Cash Coupon
                        </div>

                        <div className="text-2xl font-bold tracking-tight text-white">
                          {fmtMoney(coupon?.couponPrice || 180)} THB
                        </div>

                        {/* <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="text-xs text-white">Status:</span>
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            statusClass,
                          ].join(" ")}
                        >
                          {statusLabel}
                        </span>
                      </div> */}
                        {/* <button
                        type="button"
                        onClick={() => setFlipped(true)}
                        className="mt-3 inline-flex items-center justify-center rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
                      >
                        ดูเงื่อนไขการใช้งาน
                      </button> */}

                        {/* <div className="mt-2 text-[12px] text-white/90">
                    ใช้ได้ภายในเวลา <b>15:00 น.</b> ของวันคูปอง
                  </div> */}

                        {/* <div className="mx-3 mt-3 grid grid-cols-2 gap-3">
                          <button
                            onClick={() => shareUrl(pageUrl)}
                            className="rounded-2xl bg-[#4cc764] hover:bg-[#06c755] text-white p-2 text-sm font-semibold"
                          >
                            Share ไป LINE
                          </button>
                          <button
                            onClick={handleCopyLink}
                            className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 p-2 text-sm font-semibold"
                          >
                            Copy Link
                          </button>
                        </div> */}
                      </div>
                      <div className="relative shrink-0">
                        <div className="relative px-6">
                          <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-4 border-dashed border-[#f5f7fa]" />
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 px-6 pt-5 pb-6 text-center">
                        <div className="text-sm font-bold ">
                          {isUsed
                            ? "คูปองนี้ถูกใช้แล้ว (สแกนซ้ำไม่ได้)"
                            : isExpired
                              ? "คูปองนี้หมดอายุแล้ว ไม่สามารถใช้ได้"
                              : "ให้ร้านค้าสแกน QR ด้านล่างเพื่อใช้คูปอง"}
                        </div>

                        <div
                          ref={qrWrapRef}
                          className="relative mt-3 mx-auto w-[42vw] max-w-[220px] min-w-[150px] rounded-2xl bg-white border-2 border-[#48B0FF] p-3"
                        >
                          <div className={isExpired || isUsed ? "opacity-10" : ""}>
                            {qrDisplayUrl ? (
                              <QRCode
                                value={qrDisplayUrl}
                                size={256}
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  display: "block",
                                }}
                              />
                            ) :null}
                          </div>
                          {stampSrc ? (
                            <img
                              src={stampSrc}
                              alt={isExpired ? "Expired" : "Used"}
                              className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[100%] -translate-x-1/2 -translate-y-1/2"
                            />
                          ) : null}
                        </div>

                        <div className="mt-2 text-sm text-slate-600">
                          Ref.{" "}
                          <span className="font-extrabold text-slate-900">
                            {coupon?.displayCode || "-"}
                          </span>
                        </div>

                        <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-left">
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
                            <span className="text-slate-500">
                              วันที่ออกคูปอง
                            </span>
                            <span className="font-medium text-right">
                              {fmtDateTH(issuedAt)} {"เวลา"}{" "}
                              {issuedAt ? `${fmtTimeTH(issuedAt)} น.` : "-"}
                            </span>
                          </div>

                          <div className="flex justify-between gap-3 mt-1 font-bold">
                            <span className="text-slate-500">ใช้ได้ถึง</span>
                            <span className=" text-right">
                              {expireAt
                                ? `${fmtDateTH(expireAt)} เวลา ${fmtTimeTH(expireAt)} น.`
                                : couponDayYMD
                                  ? `${fmtDateTH(`${couponDayYMD}T15:00:00+07:00`)} เวลา 15:00 น.`
                                  : "15:00 น. ของวันคูปอง"}
                            </span>
                          </div>
                        </div>

                        {/* <div className="mt-3 text-[11px] text-slate-500 break-all">
                    ลิงก์หน้านี้: {pageUrl}
                  </div> */}
                        <button
                          onClick={handleCopyLink}
                          className="rounded-2xl mt-2 p-2 text-sm font-base text-slate-400"
                        >
                          <div className="flex flex-row gap-1">
                            <Copy size={18} />
                            <div className="underline underline-offset-2">
                              คัดลอกลิงก์
                            </div>
                          </div>
                        </button>
                      </div>
                      <div className="shrink-0 border-t px-6 py-4 bg-white">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={handleSaveQr}
                            disabled={!activeRedeemUrl || saving}
                            className="rounded-2xl bg-[#2B6CFF] hover:bg-[#255DE0] text-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
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
                          <button
                            type="button"
                            onClick={() => setFlipped(true)}
                            className="inline-flex items-center justify-center rounded-2xl  border border-[#FFB020] px-3 py-1.5 text-sm font-semibold text-[#FFB020]"
                          >
                            ดูเงื่อนไขการใช้งาน
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Back */}
              <div
                aria-hidden={!flipped}
                className={
                  flipped
                    ? "pointer-events-auto absolute inset-0 h-full"
                    : "pointer-events-none absolute inset-0 h-full"
                }
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: flipped
                    ? "rotateY(0deg) translateZ(0)"
                    : "rotateY(-180deg) translateZ(0)",
                  transformStyle: "preserve-3d",
                  WebkitTransformStyle: "preserve-3d",
                  transition: "transform 500ms, opacity 180ms",
                  opacity: flipped ? 1 : 0,
                  zIndex: flipped ? 2 : 0,
                }}
              >
                <div
                  className="h-full bg-white rounded-[28px] overflow-hidden
                [-webkit-mask-image:radial-gradient(circle_20px_at_0_155px,transparent_99%,#000_100%),radial-gradient(circle_20px_at_100%_155px,transparent_99%,#000_100%),linear-gradient(#000,#000)]
  [-webkit-mask-composite:xor]
  [-webkit-mask-repeat:no-repeat]
  [-webkit-mask-size:100%_100%]"
                >
                  <div className="h-full flex flex-col">
                    <div className="px-6 py-4 bg-white border-b">
                      <div className="text-lg font-bold text-slate-800 text-left">
                        เงื่อนไขการใช้คูปองร้านอาหาร
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-5">
                      <ol className="m-0 flex flex-col gap-2 text-sm leading-5 text-slate-700">
                        {COUPON_TERMS.map((item, idx) => (
                          <li key={idx}>
                            <div className="flex gap-2">
                              <span className="font-semibold text-slate-900">
                                {idx + 1}.
                              </span>
                              <span>{item.title}</span>
                            </div>

                            {Array.isArray(item.subs) && item.subs.length ? (
                              <ul className="mt-1 ml-7 list-disc space-y-1 text-slate-600">
                                {item.subs.map((sub, subIdx) => (
                                  <li key={subIdx}>{sub}</li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ol>

                      <div className="mt-4 border-t pt-4 text-sm leading-5 text-red-500 font-medium">
                        {COUPON_NOTE}
                      </div>
                    </div>

                    <div className="border-t px-6 py-4 bg-white">
                      <button
                        type="button"
                        onClick={() => setFlipped(false)}
                        className="w-full rounded-2xl bg-[#2B6CFF] px-4 py-3 font-semibold text-white hover:bg-[#255DE0]"
                      >
                        กลับไปหน้าคูปอง
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {toast ? (
            <div className="fixed left-1/2 top-4 -translate-x-1/2 z-[90] rounded-full bg-black/80 px-4 py-2 text-sm text-white">
              {toast}
            </div>
          ) : null}

          <div className="mt-3 text-center text-xs text-slate-500">
            © 9Expert Training
          </div>

          <div className="fixed -left-[99999px] top-0 pointer-events-none">
            <CouponExportCard
              ref={couponExportRef}
              coupon={coupon}
              issuedAt={issuedAt}
              expireAt={expireAt}
              couponDayYMD={couponDayYMD}
              qrValue={activeRedeemUrl}
              terms={COUPON_TERMS}
              note={COUPON_NOTE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
