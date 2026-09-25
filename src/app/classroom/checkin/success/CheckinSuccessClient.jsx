// src/app/classroom/checkin/success/CheckinSuccessClient.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import StepHeader from "../StepHeader";
import UserButton from "@/components/ui/UserButton";
import AnimatedCheck from "@/components/icons/check-success";
import LunchQrStep from "./LunchQrStep";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function CheckinSuccessPage({ searchParams = {} }) {
  const router = useRouter();
  const sid = pick(searchParams, "sid");
  const cid = pick(searchParams, "cid"); // ✅ P3b: classId สำหรับขอ QR สั่งอาหาร

  // P3b: ถ้ามี Step 3 (QR สั่งอาหาร) ให้ผู้เรียนกดเองไม่ต้องรีบเด้งกลับ
  const [hasLunchStep, setHasLunchStep] = useState(false);

  const [countdown, setCountdown] = useState(5);

  const message = useMemo(() => {
    return "ระบบบันทึกการเช็คอินเรียบร้อยแล้ว";
  }, []);

  // 🔥 Countdown & Auto-Redirect
  useEffect(() => {
    if (hasLunchStep) return; // มี QR ให้สแกน อย่าเพิ่งเด้งกลับ
    if (countdown <= 0) {
      router.push("/classroom/checkin");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router, hasLunchStep]);

  function handleBack() {
    router.push("/classroom/checkin");
  }


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

          {/* ✅ P3b Step 3: QR สั่งอาหารกลางวัน (โผล่เฉพาะคนที่เลือกคูปองวันนี้) */}
          <LunchQrStep
            studentId={sid}
            classId={cid}
            onReady={() => setHasLunchStep(true)}
            onDone={handleBack}
          />

          {!hasLunchStep && (
            <p className="mt-6 sm:text-base lg:text-sm text-front-textMuted">
              ระบบจะพากลับไปหน้าเช็คอินอัตโนมัติใน {countdown} วินาที...
            </p>
          )}
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
