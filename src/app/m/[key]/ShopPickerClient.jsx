"use client";

// C3d: Merchant shop picker — English only, mobile-first
// จำร้านล่าสุดใน localStorage ไว้เพื่อความสะดวกเท่านั้น (ไม่ใช่สิทธิ์ใด ๆ)
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Store } from "lucide-react";

export const LAST_SHOP_KEY = "merchant.lastShop";

function ShopLogo({ src, alt, size = 56 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-black/5"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Store className="h-6 w-6 text-slate-300" />
      )}
    </div>
  );
}

export { ShopLogo };

function subscribeStorage(cb) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readLastShop() {
  try {
    return window.localStorage.getItem(LAST_SHOP_KEY) || "";
  } catch {
    return ""; // storage ใช้ไม่ได้ก็ไม่เป็นไร
  }
}

export default function ShopPickerClient({ merchantKey, restaurants }) {
  // external store: server / hydration = "" แล้วค่อยอ่าน localStorage
  const lastId = useSyncExternalStore(subscribeStorage, readLastShop, () => "");

  const last = restaurants.find((r) => r.id === lastId);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-6">
      <h1 className="text-xl font-bold text-[#0d1b2a]">E-coupon Merchant</h1>
      <p className="mt-1 text-sm text-slate-500">Select your restaurant</p>

      {last ? (
        <Link
          href={`/m/${merchantKey}/${last.id}`}
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#2486ff] px-4 py-3 text-white shadow-sm active:scale-[0.99]"
        >
          <span className="text-sm">Continue as</span>
          <span className="truncate text-base font-semibold">{last.name}</span>
        </Link>
      ) : null}

      <ul className="mt-5 flex flex-col gap-3">
        {restaurants.map((r) => (
          <li key={r.id}>
            <Link
              href={`/m/${merchantKey}/${r.id}`}
              data-testid="merchant-shop"
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm transition hover:border-[#2486ff]/40 active:scale-[0.99]"
            >
              <ShopLogo src={r.logo} alt={r.name} />
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-[#0d1b2a]">
                {r.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {restaurants.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">No restaurants available.</p>
      ) : null}
    </div>
  );
}
