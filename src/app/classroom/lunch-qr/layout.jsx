// src/app/classroom/lunch-qr/layout.jsx
// เปลือกหน้าแท็บเล็ตแบบเดียวกับ /classroom/checkin (iPad-first)
import localFont from "next/font/local";
import Image from "next/image";
import StaffGate from "@/app/classroom/StaffGate";

const googleSans = localFont({
  src: [
    { path: "../../../../public/fonts/GoogleSans-Regular.ttf", weight: "400" },
    { path: "../../../../public/fonts/GoogleSans-Bold.ttf", weight: "700" },
  ],
  display: "swap",
});

export const metadata = {
  title: "แสดง QR สั่งอาหาร | 9Expert",
};

export default function LunchQrLayout({ children }) {
  return (
    <div className={`${googleSans.className} h-screen bg-[#F8FAFD] text-front-text`}>
      <div className="mx-auto flex h-dvh max-w-4xl flex-col px-4 py-6">
        <div className="my-4 flex flex-col items-center justify-center text-center">
          <Image src="/logo-9expert-app.png" alt="9Expert" width={90} height={90} priority />
          <header className="mt-4 flex flex-col items-center gap-1">
            <h1 className="font-semibold sm:text-4xl lg:text-2xl">แสดง QR สั่งอาหาร</h1>
            <p className="text-front-textMuted sm:text-lg lg:text-sm">
              ค้นหาชื่อผู้เรียน → แสดง QR สั่งอาหารของวันนี้
            </p>
          </header>
        </div>

        <main className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-md">
          <div className="h-full min-h-0 overflow-hidden rounded-3xl bg-front-surface">
            {/* L2b: staff tool - content only after the staff step-up */}
            <StaffGate fill>{children}</StaffGate>
          </div>
        </main>
      </div>
    </div>
  );
}
