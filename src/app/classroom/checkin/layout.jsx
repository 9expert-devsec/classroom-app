import localFont from "next/font/local";

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
    <div className={`${lineSeedSansTH.className} h-screen bg-[#F8FAFD] text-front-text`}>
      <div className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6">
        <header className="mb-6 shrink-0">
          <h1 className="text-2xl font-semibold">9Expert Classroom Check-in</h1>
          <p className="text-sm text-front-textMuted">
            กรุณาทำตามขั้นตอนเพื่อเช็คอินเข้าห้องเรียน
          </p>
        </header>

        {/* ✅ เลื่อนเฉพาะ main */}
        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 rounded-3xl bg-front-surface shadow-card">
            {children}
          </div>
        </main>

        <footer className="mt-4 shrink-0 text-center text-xs text-front-textMuted">
          © 9Expert Training
        </footer>
      </div>
    </div>
  );
}
