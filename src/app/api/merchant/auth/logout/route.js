// src/app/api/merchant/auth/logout/route.js
import { NextResponse } from "next/server";
import { clearMerchantCookie } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearMerchantCookie(res);
  return res;
}
