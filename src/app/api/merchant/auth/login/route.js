// src/app/api/merchant/auth/login/route.js
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongoose";
import MerchantUser from "@/models/MerchantUser";
import Restaurant from "@/models/Restaurant";
import { setMerchantCookie, signMerchantJwt } from "@/lib/merchantAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(x) {
  return String(x ?? "").trim();
}

function jsonError(error, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const username = clean(body?.username).toLowerCase();
  const password = clean(body?.password);

  if (!username || !password) return jsonError("MISSING_CREDENTIALS");

  await dbConnect();

  const user = await MerchantUser.findOne({ username }).lean();
  if (!user || !user.isActive) return jsonError("INVALID_LOGIN", 401);

  const restaurant = await Restaurant.findById(user.restaurantId).lean();
  if (!restaurant || restaurant.isActive === false)
    return jsonError("RESTAURANT_DISABLED", 403);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return jsonError("INVALID_LOGIN", 401);

  // update lastLoginAt best effort
  MerchantUser.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  ).catch(() => {});

  const token = signMerchantJwt({
    uid: String(user._id),
    rid: String(user.restaurantId),
  });

  const res = NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      name: user.name || "",
      username: user.username,
    },
    restaurant: {
      id: String(restaurant._id),
      name: restaurant.name,
      logoUrl: restaurant.logoUrl || "",
    },
  });

  setMerchantCookie(res, token);
  return res;
}
