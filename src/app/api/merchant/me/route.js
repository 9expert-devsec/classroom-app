// src/app/api/merchant/me/route.js
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

export async function GET() {
  return gone();
}

/* ---- ของเดิม (ก่อน C3b) /api/merchant/me ---- */
// // src/app/api/merchant/me/route.js
// import { NextResponse } from "next/server";
// import { getMerchantFromRequest } from "@/lib/merchantAuth.server";
//
// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";
//
// export async function GET(req) {
//   const me = await getMerchantFromRequest(req);
//   if (!me.ok)
//     return NextResponse.json(
//       { ok: false, error: "UNAUTHORIZED" },
//       { status: 401 },
//     );
//
//   return NextResponse.json({
//     ok: true,
//     user: {
//       id: me.userId,
//       name: me.user?.name || "",
//       username: me.user?.username || "",
//     },
//     restaurant: {
//       id: me.restaurantId,
//       name: me.restaurant?.name || "",
//       logoUrl: me.restaurant?.logoUrl || "",
//     },
//   });
// }
