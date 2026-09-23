import localFont from "next/font/local";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";

const lineSeedSansTH = localFont({
  src: [
    {
      // path: "../../../../public/fonts/LINESeedSansTH_W_Rg.woff2",
      path: "../../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    {
      // path: "../../../../public/fonts/LINESeedSansTH_W_Bd.woff2",
      path: "../../../../public/fonts/GoogleSans-Bold.ttf",
      weight: "700",
    },
    // {
    //   path: "../../../../public/fonts/LINESeedSansTH_W_XBd.woff2",
    //   weight: "800",
    // },
    // {
    //   path: "../../../../public/fonts/LINESeedSansTH_W_He.woff2",
    //   weight: "900",
    // },
    // {
    //   path: "../../../../public/fonts/LINESeedSansTH_W_Th.woff2",
    //   weight: "200",
    // },
  ],
  display: "swap",
});

export default function EventLayout({ children }) {
  return (
    <div
      className={`${lineSeedSansTH.className} h-dvh bg-[#0A1F33]`}
    >
      <div className="mx-auto flex h-full max-w-4xl flex-col px-4 py-6">
        <div className="flex flex-col items-center justify-center text-center my-4">
          <Image
            src="/logo-9expert-app.png"
            alt="9Expert"
            width={90}
            height={90}
            priority
          />

          <header className="mt-4 flex flex-col items-center gap-1 text-[#F5F8FB]">
            <h1 className="sm:text-4xl lg:text-2xl font-semibold">
              9Expert Event Register
            </h1>
            <p className="sm:text-lg lg:text-sm">
              กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าร่วมงาน
            </p>
          </header>
        </div>
        
        {/* ✅ เลื่อนเฉพาะ main */}
        <main className="min-h-0 flex-1 overflow-hidden rounded-3xl shadow-md">
          <div className="h-full min-h-0 rounded-3xl bg-front-surface ">
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
