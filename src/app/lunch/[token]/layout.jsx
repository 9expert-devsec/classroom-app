// src/app/lunch/[token]/layout.jsx
//
// เปลือกฟอนต์ของหน้าสั่งอาหารบนมือถือ
// root layout ตั้ง body เป็น h-screen overflow-hidden ไว้ — lunch.css ปลดออกให้ตัวเอกสารเลื่อนเอง
import localFont from "next/font/local";
import { lunchTestTimesLabel } from "@/lib/lunchConfig";
import "./lunch.css";

const googleSans = localFont({
  src: [
    { path: "../../../../public/fonts/GoogleSans-Regular.ttf", weight: "400" },
    { path: "../../../../public/fonts/GoogleSans-Bold.ttf", weight: "700" },
  ],
  display: "swap",
});

export const metadata = {
  title: "สั่งอาหารกลางวัน | 9Expert",
};

// ไอคอนหมุนโทรศัพท์ (เส้น) — lucide ไม่มีตัวนี้
function RotatePhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="3" width="8" height="14" rx="1.6" />
      <path d="M11 14.5h2" />
      <path d="M4 15a8 8 0 0 0 7 6" />
      <path d="M9.5 19.5 11 21l-1.8 1" />
    </svg>
  );
}

export default function LunchLayout({ children }) {
  // C2d: preview/dev ที่เลื่อนเวลาปิดไว้ -> บอกบรรทัดเล็ก ๆ ท้ายหน้า กันเข้าใจผิดว่าเป็นของจริง
  const testTimes = lunchTestTimesLabel();
  return (
    <div className={`${googleSans.className} lunch-root min-h-dvh`}>
      {/* แนวตั้งเท่านั้น: โชว์/ซ่อนด้วย media query ใน lunch.css (ไม่ unmount หน้า) */}
      <div className="lunch-rotate" role="alert">
        <RotatePhoneIcon />
        <p className="text-[18px] font-bold text-[color:var(--bg)]">กรุณาหมุนโทรศัพท์เป็นแนวตั้ง</p>
        <p className="text-[14px] text-[color:var(--gray-light)]">หน้านี้ใช้งานได้ในแนวตั้งเท่านั้น</p>
      </div>

      <div className="lunch-page">
        {children}
        {testTimes ? (
          <p
            data-testid="lunch-test-times"
            className="lunch-test-times bg-[#f8fafd] py-1 text-center font-mono text-[10px] text-slate-400"
          >
            {testTimes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
