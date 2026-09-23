// src/app/classroom/masterclass/layout.jsx
import localFont from "next/font/local";
import MasterclassLogo from "./MasterclassLogo";

const lineSeedSansTH = localFont({
  src: [
    {
      path: "../../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    {
      path: "../../../../public/fonts/GoogleSans-Bold.ttf",
      weight: "700",
    },
  ],
  display: "swap",
});

export default function MasterclassLayout({ children }) {
  return (
    // ✅ พื้นหลังเข้มต่อเนื่องทุกหน้าของ Masterclass (list → step 1 → 2 → 3)
    <div className={`${lineSeedSansTH.className} h-dvh bg-[#0d1b2a]`}>
      <div className="mx-auto flex h-full max-w-4xl flex-col px-4 py-6">
        <div className="my-4 flex flex-col items-center justify-center text-center">
          <MasterclassLogo size={90} />

          <header className="mt-4 flex flex-col items-center gap-1 text-[#F5F8FB]">
            <h1 className="sm:text-4xl lg:text-2xl font-semibold">
              9Expert Masterclass
            </h1>
            <p className="sm:text-lg lg:text-sm">
              กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าเรียน
            </p>
          </header>
        </div>

        {/* ✅ เลื่อนเฉพาะ main */}
        <main className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-md">
          <div className="h-full min-h-0 rounded-3xl bg-front-surface">
            {children}
          </div>
        </main>

        <footer className="mt-4 shrink-0 text-center sm:text-base lg:text-xs text-front-textMuted">
          © 9Expert Training
        </footer>
      </div>
    </div>
  );
}
