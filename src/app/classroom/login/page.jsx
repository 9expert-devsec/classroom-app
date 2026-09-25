// src/app/classroom/login/page.jsx
// L2a: open this tablet as a /classroom kiosk.
import localFont from "next/font/local";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { requireKiosk } from "@/lib/kioskAuth.server";
import { safeKioskNext } from "@/lib/kioskToken";
import KioskLoginClient from "./KioskLoginClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "เปิด Kiosk | 9Expert",
};

const googleSans = localFont({
  src: [
    { path: "../../../../public/fonts/GoogleSans-Regular.ttf", weight: "400" },
    { path: "../../../../public/fonts/GoogleSans-Bold.ttf", weight: "700" },
  ],
  display: "swap",
});

export default async function KioskLoginPage({ searchParams }) {
  const next = safeKioskNext(searchParams?.next);

  // already a live kiosk on this device -> carry on
  let live = false;
  try {
    await requireKiosk();
    live = true;
  } catch {
    live = false;
  }
  if (live) redirect(next);

  // an admin logged in on this browser can open the kiosk in one tap
  let adminName = "";
  try {
    const ctx = await requireAdmin();
    if (ctx.permSet.has(PERM.CLASSROOM_OPERATE)) {
      adminName = ctx.user.name || ctx.user.username;
    }
  } catch {
    adminName = "";
  }

  return (
    <div className={`${googleSans.className} min-h-dvh bg-[#F8FAFD] text-front-text`}>
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
        <div className="my-4 flex flex-col items-center justify-center text-center">
          <Image src="/logo-9expert-app.png" alt="9Expert" width={90} height={90} priority />
          <header className="mt-4 flex flex-col items-center gap-1">
            <h1 className="font-semibold sm:text-4xl lg:text-2xl">เปิดเครื่อง Kiosk</h1>
            <p className="text-front-textMuted sm:text-lg lg:text-sm">
              สำหรับเจ้าหน้าที่ — เปิดใช้งานแท็บเล็ตนี้สำหรับหน้างานวันนี้
            </p>
          </header>
        </div>

        <main className="rounded-3xl bg-front-surface p-6 shadow-md sm:p-8">
          <KioskLoginClient next={next} adminName={adminName} />
        </main>

        <footer className="mt-4 text-center text-front-textMuted sm:text-base lg:text-xs">
          © 9Expert Training
        </footer>
      </div>
    </div>
  );
}
