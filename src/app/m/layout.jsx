import localFont from "next/font/local";

const lineSeedSansTH = localFont({
  src: [
    {
      // path: "../../../../public/fonts/LINESeedSansTH_W_Rg.woff2",
      path: "../../../public/fonts/GoogleSans-Regular.ttf",
      weight: "400",
    },
    {
      // path: "../../../../public/fonts/LINESeedSansTH_W_Bd.woff2",
      path: "../../../public/fonts/GoogleSans-Bold.ttf",
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

// ให้ทั้งหน้าเลื่อนเอง (document scroll) — root layout ล็อก body ไว้ (h-screen overflow-hidden)
// data-merchant-shell ปลดล็อกนั้นเฉพาะหน้า /m (globals.css) · min-h-dvh ให้พื้นหลังเต็มจอเมื่อเนื้อหาสั้น
export default function MerchantLayout({ children }) {
  return (
    <div
      data-merchant-shell=""
      className={`${lineSeedSansTH.className} min-h-dvh bg-admin-bg text-admin-text`}
    >
      <main style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </main>
    </div>
  );
}
