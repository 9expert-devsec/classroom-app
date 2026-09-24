// src/app/lunch/[token]/r/[restaurantId]/m/[menuId]/page.jsx
//
// Placeholder — P3e สร้างหน้ารายละเอียดเมนู (ตัวเลือก/จำนวน/โน้ต) ที่นี่
import Link from "next/link";
import { Shell } from "../../../../_components/Shell";

export const dynamic = "force-dynamic";

export default function MenuDetailPlaceholder({ params }) {
  const token = String(params?.token || "");
  const restaurantId = String(params?.restaurantId || "");

  return (
    <Shell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-[18px] font-bold text-[#0d1b2a]">รายละเอียดเมนู</h1>
        <p className="text-[14px] text-slate-500">
          หน้านี้จะเปิดใช้งานในขั้นถัดไป
        </p>
        <Link
          href={`/lunch/${token}/r/${restaurantId}`}
          className="h-11 rounded-xl bg-[#2486ff] px-6 text-[15px] font-semibold leading-[44px] text-white shadow-sm"
        >
          กลับไปหน้าเมนู
        </Link>
      </div>
    </Shell>
  );
}
