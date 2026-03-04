// src/app/classroom/checkin/success/CheckinSuccessClient.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import StepHeader from "../StepHeader";
import UserButton from "@/components/ui/UserButton";
import AnimatedCheck from "@/components/icons/check-success";
import QRCode from "react-qr-code";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

function fmtDateTimeTH(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

export default function CheckinSuccessPage({ searchParams = {} }) {
  const router = useRouter();
  const sid = pick(searchParams, "sid");
  const cp = pick(searchParams, "cp"); // ✅ coupon publicId (ถ้ามี)

  const [countdown, setCountdown] = useState(5);
  const [coupon, setCoupon] = useState(null);

  const message = useMemo(() => {
    return "ระบบบันทึกการเช็คอินเรียบร้อยแล้ว";
  }, []);

  // ✅ ถ้ามีคูปอง ให้เพิ่มเวลาหน้า success เพื่อให้ลูกค้าสแกน
  useEffect(() => {
    if (cp) setCountdown(60);
  }, [cp]);

  // ✅ ดึงข้อมูลคูปอง (เพื่อแสดงรายละเอียดและ Ref)
  useEffect(() => {
    if (!cp) return;

    let canceled = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/coupon/${encodeURIComponent(cp)}`);
        const j = await r.json().catch(() => ({}));
        if (canceled) return;
        if (r.ok && j.ok) setCoupon(j.item);
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      canceled = true;
    };
  }, [cp]);

  // 🔥 Countdown & Auto-Redirect
  useEffect(() => {
    if (countdown <= 0) {
      router.push("/classroom/checkin");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router]);

  function handleBack() {
    router.push("/classroom/checkin");
  }

  // ✅ ใช้ origin จริงจาก browser
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://register.9expert.app";

  const couponPageUrl = cp ? `${origin}/coupon/${cp}` : "";

  return (
    <div className="flex flex-col">
      <StepHeader currentStep={4} />

      <div className="px-6 py-10 flex flex-col items-center text-center gap-6">
        <div className="p-6">
          <AnimatedCheck size={140} className="mx-auto" />
        </div>

        <div>
          <h2 className="sm:text-2xl lg:text-xl font-semibold text-front-text">
            เช็คอินสำเร็จ
          </h2>

          <p className="mt-2 sm:text-lg lg:text-base text-front-textMuted">
            {message}
          </p>

          {/* ✅ กล่องคูปอง (แสดงเฉพาะกรณีเลือก coupon) */}
          {cp ? (
            <div className="mt-6 w-full max-w-md rounded-2xl border border-brand-border bg-white p-4 text-left">
              <div className="text-center">
                <div className="text-sm text-front-textMuted">
                  กรุณาสแกนเพื่อรับคูปองส่วนลดอาหาร
                </div>

                <div className="mt-3 flex items-center justify-center rounded-xl bg-white p-3">
                  <QRCode value={couponPageUrl} size={190} />
                </div>

                <div className="mt-3 text-sm text-front-textMuted">
                  Ref.{" "}
                  <span className="font-semibold text-front-text">
                    {coupon?.displayCode || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-brand-border/60 bg-front-bgSoft px-3 py-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-front-textMuted">เจ้าของคูปอง</span>
                  <span className="font-medium text-front-text">
                    {coupon?.holderName || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-front-textMuted">หลักสูตร</span>
                  <span className="font-medium text-front-text text-right">
                    {coupon?.courseName || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-front-textMuted">ห้องอบรม</span>
                  <span className="font-medium text-front-text">
                    {coupon?.roomName || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3 mt-1">
                  <span className="text-front-textMuted">มูลค่า</span>
                  <span className="font-semibold text-front-text">180 บาท</span>
                </div>

                {coupon?.redeemedAt ? (
                  <div className="mt-2 text-xs text-front-textMuted text-center">
                    สถานะ: ใช้แล้ว ({fmtDateTimeTH(coupon.redeemedAt)})
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-6 sm:text-base lg:text-sm text-front-textMuted">
            ระบบจะพากลับไปหน้าเช็คอินอัตโนมัติใน {countdown} วินาที...
          </p>
        </div>

        <div className="mt-4 w-full max-w-sm">
          <UserButton className="w-full" onClick={handleBack}>
            กลับไปหน้าเช็คอิน
          </UserButton>
        </div>
      </div>
    </div>
  );
}
