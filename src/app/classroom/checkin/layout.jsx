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

export default function CheckinLayout({ children }) {
  return (
    <div
      className={`${lineSeedSansTH.className} h-screen bg-[#F8FAFD] text-front-text`}
    >
      <div className="mx-auto flex h-dvh max-w-4xl flex-col px-4 py-6">
        <div className="flex flex-col items-center justify-center text-center my-4">
          <Image
            src="/logo-9expert-app.png"
            alt="9Expert"
            width={90}
            height={90}
            priority
          />

          <header className="mt-4 flex flex-col items-center gap-1">
            <h1 className="sm:text-4xl lg:text-2xl font-semibold">
              9Expert Register
            </h1>
            <p className="sm:text-lg lg:text-sm text-front-textMuted">
              กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าห้องเรียน
            </p>
          </header>
        </div>
        {/* <Image
          src="/logo-9expert-app.png"
          width={80}
          height={80}
          priority
        /> */}

        {/* <header className="mb-6 shrink-0 flex flex-row items-center gap-3"> */}
        {/* <Link
              href="/classroom"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-admin-border bg-white text-admin-text hover:bg-admin-surfaceMuted"
              aria-label="ย้อนกลับ"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link> */}

        {/* <div className="flex flex-col gap-1">
            <h1 className=" sm:text-4xl lg:text-2xl font-semibold">
              9Expert Classroom Check-in
            </h1>
            <p className="sm:text-lg lg:text-sm text-front-textMuted">
              กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าห้องเรียน
            </p>
          </div>
        </header> */}

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
