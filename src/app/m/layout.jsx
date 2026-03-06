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

export default function MerchantLayout({ children }) {
  return (
    <div
      className={`${lineSeedSansTH.className} flex h-dvh overflow-hidden bg-admin-bg text-admin-text`}
    >
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 min-h-0">{children}</div>
      </main>
    </div>
  );
}
