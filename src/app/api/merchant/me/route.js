// src/app/api/merchant/me/route.js
import { NextResponse } from "next/server";
import { getMerchantFromRequest } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const me = await getMerchantFromRequest(req);
  if (!me.ok)
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );

  return NextResponse.json({
    ok: true,
    user: {
      id: me.userId,
      name: me.user?.name || "",
      username: me.user?.username || "",
    },
    restaurant: {
      id: me.restaurantId,
      name: me.restaurant?.name || "",
      logoUrl: me.restaurant?.logoUrl || "",
    },
  });
}
