// src/app/api/admin/food/merchant-links/route.js
//
// ลิงก์ Merchant สำหรับหน้าแอดมินร้านอาหาร (key อ่านที่ server เท่านั้น)
//   GET                 -> { ok, configured, pickerUrl }
//   GET ?restaurantId=  -> { ok, configured, pickerUrl, eligible, reason, shopUrl }
// ไม่ได้ตั้ง MERCHANT_PATH_KEY -> configured: false และไม่มี URL ใด ๆ
// ร้านไม่เข้าเกณฑ์ -> eligible: false + reason (กฎเดียวกับหน้าเลือกร้าน) ไม่มี shopUrl
// FOOD_WRITE เหมือน action จัดการร้าน — ลิงก์นี้ใช้กดใช้คูปองแทนร้านได้
import { NextResponse } from "next/server";

import dbConnect from "@/lib/mongoose";
import { adminGuard } from "@/lib/adminAuth.server";
import { PERM } from "@/lib/acl";
import { getBaseUrl } from "@/lib/baseUrl.server";
import { configuredKey } from "@/lib/merchantKey.server";
import { merchantEligibility } from "@/lib/merchantLunch.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req) {
  const denied = await adminGuard(PERM.FOOD_WRITE);
  if (denied) return denied;

  try {
    const key = configuredKey();
    const restaurantId = new URL(req.url).searchParams.get("restaurantId");
    const base = `${getBaseUrl().replace(/\/+$/, "")}/m/${encodeURIComponent(key)}`;
    const out = { ok: true, configured: !!key, pickerUrl: key ? base : "" };

    if (restaurantId) {
      await dbConnect();
      const el = await merchantEligibility(restaurantId);
      if (!el.found) {
        return NextResponse.json(
          { ok: false, error: "ไม่พบร้านอาหาร" },
          { status: 404, headers: NO_STORE },
        );
      }
      out.eligible = el.eligible;
      out.reason = el.reason || "";
      if (key && el.eligible) out.shopUrl = `${base}/${restaurantId}`;
    }

    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    console.error("GET /api/admin/food/merchant-links error:", err?.message || err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500, headers: NO_STORE });
  }
}
