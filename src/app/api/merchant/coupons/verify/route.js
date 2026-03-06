// src/app/api/merchant/coupons/verify/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import CouponRecord from "@/models/CouponRecord";
import Restaurant from "@/models/Restaurant";
import { requireMerchant } from "@/lib/merchantAuth.server";
import { decryptCipher, sha256 } from "@/lib/couponCipher.server";
import {
  getCouponExpireAt,
  getCouponIssuedAt,
  syncCouponExpiredStatus,
} from "@/lib/couponExpiry.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}
function cleanRef(x) {
  return clean(x).toUpperCase().replace(/\s+/g, "");
}
function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req) {
  const me = await requireMerchant(req);
  if (me instanceof NextResponse) return me;

  const body = await req.json().catch(() => ({}));
  const c = clean(body?.c);
  const ref = cleanRef(body?.ref);

  if (!c && !ref) return jsonError("MISSING_C_OR_REF");

  await dbConnect();

  let where = null;

  if (c) {
    let tokenRaw = "";
    try {
      tokenRaw = decryptCipher(c);
    } catch {
      return jsonError("BAD_CIPHER", 400);
    }
    const tokenHash = sha256(tokenRaw);
    where = { redeemTokenHash: tokenHash };
  } else {
    where = { displayCode: ref };
  }

  const doc = await CouponRecord.findOne(where).lean();
  if (!doc) return jsonError("NOT_FOUND", 404);

  const allowed = Array.isArray(doc.allowedRestaurantIds)
    ? doc.allowedRestaurantIds.map(String)
    : [];
  if (allowed.length > 0 && !allowed.includes(String(me.restaurantId))) {
    return jsonError("COUPON_NOT_ALLOWED_FOR_RESTAURANT", 403);
  }

  const now = new Date();
  const status = await syncCouponExpiredStatus(CouponRecord, doc, now);
  const issuedAt = getCouponIssuedAt(doc);
  const expiresAt = getCouponExpireAt(doc);

  let merchantName = "";
  if (doc.merchantId) {
    const m = await Restaurant.findById(doc.merchantId).select("name").lean();
    merchantName = m?.name || "";
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: String(doc._id),
      publicId: doc.publicId || "",
      displayCode: doc.displayCode || "",
      status,
      couponPrice: doc.couponPrice ?? 180,

      holderName: doc.holderName || "",
      courseName: doc.courseName || "",
      roomName: doc.roomName || "",
      dayYMD: doc.dayYMD || "",

      issuedAt: issuedAt || null,
      expiresAt: expiresAt || null,

      redeemedAt: doc.redeemedAt || null,
      merchantId: doc.merchantId ? String(doc.merchantId) : "",
      merchantName,

      billCode: doc.billCode || "",
      billTotal: doc.billTotal ?? 0,
      billCouponTotal: doc.billCouponTotal ?? 0,
      billCouponCount: doc.billCouponCount ?? 0,
      billPayMore: doc.billPayMore ?? 0,
      billDayYMD: doc.billDayYMD || "",
    },
  });
}
