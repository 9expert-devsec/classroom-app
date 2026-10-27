// src/app/classroom/lunch-qr/layout.jsx
// เปลือกหน้าแท็บเล็ตแบบเดียวกับ /classroom/checkin (iPad-first)
import localFont from "next/font/local";
import Image from "next/image";
import StaffGate from "@/app/classroom/StaffGate";
import KioskCardBody, { KioskScroll } from "@/app/classroom/KioskCardBody";

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
    <div className={`${googleSans.className} h-dvh overflow-hidden bg-[#F8FAFD] text-front-text`}>
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

        <KioskCardBody>
          {/* R5-6a: ไม่มีแถบขั้นตอน — หน้าปลดล็อก (PIN) ที่สูงกว่าการ์ดเลื่อนได้
              หน้าค้นหา / QR สูงเต็มการ์ดและเลื่อนรายการของตัวเอง -> พื้นที่เลื่อนเดียว */}
          <KioskScroll>
            {/* L2b: staff tool - content only after the staff step-up */}
            <StaffGate fill>{children}</StaffGate>
          </KioskScroll>
        </KioskCardBody>
      </div>
    </div>
  );
}
