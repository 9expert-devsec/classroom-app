// src/app/classroom/checkin/success/CheckinSuccessClient.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import StepHeader from "../StepHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import AnimatedCheck from "@/components/icons/check-success";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function CheckinSuccessPage({ searchParams = {} }) {
  const router = useRouter();
  const sid = pick(searchParams, "sid");

  const [countdown, setCountdown] = useState(5); // ⬅️ เริ่ม 5 วินาที

  const message = useMemo(() => {
    return "ระบบบันทึกการเช็คอินเรียบร้อยแล้ว";
  }, []);

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

  return (
    <div className="flex flex-col">
      <StepHeader currentStep={4} />

      <div className="px-6 py-10 flex flex-col items-center text-center gap-6">
        {/* <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
          <span className="text-4xl text-green-500">✔</span>
        </div> */}
        <div className="p-6">
          <AnimatedCheck size={140} className="mx-auto" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-front-text">
            เช็คอินสำเร็จ
          </h2>

          <p className="mt-2 text-base text-front-textMuted">{message}</p>

          {/* {sid && (
            <p className="mt-1 text-[11px] text-front-textMuted">
              (รหัสผู้เรียน: {sid})
            </p>
          )} */}

          <p className="mt-4 text-sm text-front-textMuted">
            ระบบจะพากลับไปหน้าเช็คอินอัตโนมัติใน {countdown} วินาที...
          </p>
        </div>

        <div className="mt-4 w-full max-w-sm">
          <PrimaryButton className="w-full" onClick={handleBack}>
            กลับไปหน้าเช็คอิน
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
