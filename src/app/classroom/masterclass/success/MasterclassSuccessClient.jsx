// src/app/classroom/masterclass/success/MasterclassSuccessClient.jsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MasterclassStepHeader from "../MasterclassStepHeader";
import UserButton from "@/components/ui/UserButton";
import AnimatedCheck from "@/components/icons/check-success";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function MasterclassSuccessClient({ searchParams = {} }) {
  const router = useRouter();

  const classId =
    pick(searchParams, "classId") || pick(searchParams, "classid");
  const day = Number(pick(searchParams, "day") || 1);

  const [countdown, setCountdown] = useState(5); // ⬅️ เริ่ม 5 วินาที

  const message = useMemo(() => {
    return "ระบบบันทึกการเช็คอินเรียบร้อยแล้ว";
  }, []);

  // ✅ กลับไป Step 1 ของ "คลาสเดิม" เพื่อเช็คอินคนถัดไปได้ทันที
  // ถ้าไม่มี classId (เข้าหน้านี้ตรง ๆ) ค่อยกลับไปหน้ารายการคอร์ส
  const nextHref = useMemo(() => {
    if (!classId) return "/classroom/masterclass";
    const qs = new URLSearchParams();
    qs.set("classId", classId);
    qs.set("day", String(day > 0 ? day : 1));
    return `/classroom/masterclass/checkin?${qs.toString()}`;
  }, [classId, day]);

  // 🔥 Countdown & Auto-Redirect
  useEffect(() => {
    if (countdown <= 0) {
      router.push(nextHref);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router, nextHref]);

  function handleBack() {
    router.push(nextHref);
  }

  return (
    <div className="flex flex-col">
      <MasterclassStepHeader currentStep={3} />

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

          <p className="mt-4 sm:text-base lg:text-sm text-front-textMuted">
            ระบบจะพากลับไปหน้าค้นหาชื่ออัตโนมัติใน {countdown} วินาที...
          </p>
        </div>

        <div className="mt-4 w-full max-w-sm">
          <UserButton className="w-full" onClick={handleBack}>
            เช็คอินคนถัดไป
          </UserButton>
        </div>
      </div>
    </div>
  );
}
