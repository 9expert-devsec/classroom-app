// src/app/lunch/[token]/summary/page.jsx
//
// Placeholder — P3e สร้างหน้าสรุป/ยืนยันออเดอร์ที่นี่
import Link from "next/link";
import { Shell } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default function SummaryPlaceholder({ params }) {
  const token = String(params?.token || "");

  return (
    <Shell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-[18px] font-bold text-[#0d1b2a]">สรุปรายการ</h1>
        <p className="text-[14px] text-slate-500">
          หน้านี้จะเปิดใช้งานในขั้นถัดไป
        </p>
        <Link
          href={`/lunch/${token}`}
          className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold leading-[44px] text-white shadow-sm"
        >
          กลับหน้าแรก
        </Link>
      </div>
    </Shell>
  );
}
