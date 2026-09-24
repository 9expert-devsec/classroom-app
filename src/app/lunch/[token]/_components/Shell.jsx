// src/app/lunch/[token]/_components/Shell.jsx
//
// เปลือกจอมือถือของหน้าสั่งอาหาร + หน้า error/ปิดรับ
// mobile-first: เต็มความกว้าง เนื้อหาอยู่กลางที่ max-w-[480px]
//
// โครงของหน้าที่มีแถบล่าง: คอลัมน์สูงเต็มจอเป็น flex-col
//   [แถบบน sticky] [เนื้อหา flex-1] [StickyBottom]
// เนื้อหาสั้นก็ยังดันแถบล่างไปติดขอบล่างของจอ ไม่ลอยอยู่ใต้รายการ
// (ไม่ใช้ position:fixed เพราะ body ของ root layout เป็น h-screen overflow-hidden)
import Image from "next/image";

const LOGO = "/logo-9experttraining-color.png";

export function Shell({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f8fafd] text-[#0d1b2a]">
      <div
        className="mx-auto flex w-full max-w-[480px] flex-1 flex-col"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** แถบล่างติดขอบจอ — ต้องเป็นลูกตัวสุดท้ายของ Shell และเนื้อหาข้างบนต้องเป็น flex-1 */
export function StickyBottom({ children, className = "" }) {
  return (
    <div
      data-testid="sticky-bottom"
      className={`sticky bottom-0 z-10 border-t border-black/5 bg-white px-4 pt-3 ${className}`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {children}
    </div>
  );
}

/** หน้า error / ปิดรับ — ไอคอนกลาง หัวข้อ เนื้อความ แล้วโลโก้จาง ๆ */
export function NoticeScreen({ icon, tone = "red", title, body }) {
  const ring =
    tone === "red"
      ? "bg-[#c2453e]/10"
      : tone === "amber"
        ? "bg-[#d98a13]/10"
        : "bg-slate-200/60";

  return (
    <Shell>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 py-16 text-center">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${ring}`}
        >
          {icon}
        </div>
        <h1 className="text-[19px] font-bold text-[#0d1b2a]">{title}</h1>
        {body ? (
          <p className="text-[14px] leading-relaxed text-slate-500">{body}</p>
        ) : null}
        <Image
          src={LOGO}
          alt="9Expert"
          width={120}
          height={24}
          className="mt-4 h-6 w-auto opacity-60"
        />
      </div>
    </Shell>
  );
}

export function LogoTile({ src, alt, size = 56 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="text-2xl text-slate-300">?</span>
      )}
    </div>
  );
}
