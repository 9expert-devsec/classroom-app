"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AnimatedCheck from "@/components/icons/check-success";

function pick(sp, key) {
  const v = sp?.[key];
  return Array.isArray(v) ? v[0] || "" : v || "";
}

export default function EventCompleteClient({ searchParams }) {
  const router = useRouter();
  const eventId = useMemo(() => pick(searchParams, "eventId"), [searchParams]);

  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!eventId) {
      router.replace("/classroom/event");
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.replace(
            `/classroom/event/attendees?eventId=${encodeURIComponent(eventId)}`,
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [eventId, router]);

  function goNow() {
    router.replace(
      `/classroom/event/attendees?eventId=${encodeURIComponent(eventId)}`,
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="text-center">
        <div className="p-6">
          <AnimatedCheck size={140} className="mx-auto" />
        </div>

        <h2 className="sm:text-2xl lg:text-xl font-semibold text-front-text">เช็คอินสำเร็จ</h2>

        <div className="mt-2 sm:text-lg lg:text-base text-zinc-600">
          บันทึกการเข้าร่วมเรียบร้อยแล้ว
        </div>

        <div className="mt-4 text-base text-zinc-500">
          ระบบจะกลับไปหน้าค้นหารายชื่อในอีก{" "}
          <span className="font-semibold text-zinc-900">{countdown}</span>{" "}
          วินาที
        </div>

        <div className="mt-6">
          <button
            className="rounded-xl bg-brand-primary p-5 font-normal text-[#0D1B2A] sm:text-2xl lg:text-base"
            onClick={goNow}
          >
            กลับไปหน้าค้นหารายชื่อ
          </button>
        </div>
      </div>
    </div>
  );
}
