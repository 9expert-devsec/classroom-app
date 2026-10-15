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

export default function LunchLayout({ children }) {
  // C2d: preview/dev ที่เลื่อนเวลาปิดไว้ -> บอกบรรทัดเล็ก ๆ ท้ายหน้า กันเข้าใจผิดว่าเป็นของจริง
  const testTimes = lunchTestTimesLabel();
  return (
    <div className={`${googleSans.className} lunch-root min-h-dvh`}>
      {children}
      {testTimes ? (
        <p
          data-testid="lunch-test-times"
          className="bg-[#f8fafd] py-1 text-center font-mono text-[10px] text-slate-400"
        >
          {testTimes}
        </p>
      ) : null}
    </div>
  );
}
