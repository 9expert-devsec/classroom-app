import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import CouponRecord from "@/models/CouponRecord";
import { requireMerchant } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toInt(x, d = 10) {
  const n = Number(x);
  if (!Number.isFinite(n)) return d;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

export async function GET(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  await dbConnect();

  const { searchParams } = new URL(req.url);
  const limit = toInt(searchParams.get("limit") || 10, 10);

  const items = await CouponRecord.find({
    merchantId: me.restaurantId,
    status: "redeemed",
  })
    .sort({ redeemedAt: -1 })
    .limit(limit)
    .select(
      "displayCode holderName courseName spentAmount diffAmount redeemedAt redeemCipher",
    )
    .lean();

  return NextResponse.json({
    ok: true,
    items: items.map((x) => ({
      id: String(x._id),
      displayCode: x.displayCode || "",
      holderName: x.holderName || "",
      courseName: x.courseName || "",
      spentAmount: x.spentAmount || 0,
      diffAmount: x.diffAmount || 0,
      redeemedAt: x.redeemedAt || null,
      redeemCipher: x.redeemCipher || "",
    })),
  });
}
