// src/app/lunch/[token]/layout.jsx
//
// เปลือกฟอนต์ของหน้าสั่งอาหารบนมือถือ
// root layout ตั้ง body เป็น h-screen overflow-hidden ไว้ หน้านี้จึงต้องเลื่อนเอง
import localFont from "next/font/local";

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
  return (
    <div className={`${googleSans.className} h-dvh overflow-y-auto`}>
      {children}
    </div>
  );
}
