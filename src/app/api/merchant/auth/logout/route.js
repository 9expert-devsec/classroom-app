// src/app/api/merchant/auth/logout/route.js
//
// C3b: ระบบ Merchant / คูปองเดิม (CouponRecord) เลิกใช้แล้ว -> 410 gone
// Merchant ตัวใหม่: /api/merchant/lunch/* (ทำงานบน LunchOrder) — โค้ดเดิมเก็บไว้ข้างล่างเป็น comment
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gone() {
  return NextResponse.json(
    { ok: false, error: "This endpoint has been retired.", reason: "gone" },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return gone();
}

/* ---- ของเดิม (ก่อน C3b) /api/merchant/auth/logout ---- */
// // src/app/api/merchant/auth/logout/route.js
// import { NextResponse } from "next/server";
// import { clearMerchantCookie } from "@/lib/merchantAuth.server";
//
// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";
//
// export async function POST() {
//   const res = NextResponse.json({ ok: true });
//   clearMerchantCookie(res);
//   return res;
// }
