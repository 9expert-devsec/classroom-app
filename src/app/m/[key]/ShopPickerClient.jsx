"use client";

// C3d: Merchant shop picker — English only, mobile-first
// แสดงเฉพาะรายการร้านที่เข้าเกณฑ์ (ไม่จำร้านล่าสุดแล้ว)
import Link from "next/link";
import { Store } from "lucide-react";

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

export default function ShopPickerClient({ merchantKey, restaurants }) {
  return (
    <div className="mx-auto w-full max-w-[520px] px-4 py-6">
      <h1 className="text-xl font-bold text-[#0d1b2a]">E-coupon Merchant</h1>
      <p className="mt-1 text-sm text-slate-500">Select your restaurant</p>

      <ul className="mt-5 flex flex-col gap-3">
        {restaurants.map((r) => (
          <li key={r.id}>
            <Link
              replace
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
