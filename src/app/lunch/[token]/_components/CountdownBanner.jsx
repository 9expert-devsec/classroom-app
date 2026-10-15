"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";

/**
 * แถบนับถอยหลังช่วงใกล้ปิดรับ
 *
 * เวลาที่เชื่อถือได้มาจาก server ตัวเดียว (secondsLeft) เราแค่ตรึงเส้นตาย
 * ฝั่ง client ไว้ ณ ตอน render แล้วนับลง ไม่ได้อ่านนาฬิกาเครื่องมาเทียบเอง
 * พอถึง 0 ก็ refresh ให้ด่านตรวจฝั่ง server พาไปหน้า "ปิดรับแล้ว"
 */
export default function CountdownBanner({ secondsLeft, deadlineLabel }) {
  const router = useRouter();
  const [clientDeadline] = useState(() => Date.now() + (secondsLeft || 0) * 1000);
  const [secs, setSecs] = useState(() => Math.max(0, secondsLeft || 0));

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.round((clientDeadline - Date.now()) / 1000));
      setSecs(left);
      if (left <= 0) router.refresh();
    };
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [clientDeadline, router]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    // ทึบ 100% (ไม่มี alpha/blur) และเป็นลูกตัวแรกของแถบบนที่ไม่เลื่อน -> ไม่มีอะไรโผล่ทะลุ/ลอดข้างหลัง
    <div
      data-testid="countdown-banner"
      className="flex flex-none items-center gap-2 border-b border-[#f0dec4] bg-[#fbf1e4] px-4 py-2.5 text-[13px] text-[#7a4708]"
    >
      <Hourglass aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>
        ใกล้ปิดรับออเดอร์ · เหลือเวลา{" "}
        <span className="font-bold tabular-nums">
          {mm}:{ss}
        </span>{" "}
        นาที (ปิด {deadlineLabel} น.)
      </span>
    </div>
  );
}
