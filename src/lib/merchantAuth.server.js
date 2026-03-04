// src/lib/merchantAuth.server.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/mongoose"; // <-- ปรับตามของโปรเจกต์คุณ (บางที่เป็น dbConnect)
import MerchantUser from "@/models/MerchantUser";
import Restaurant from "@/models/Restaurant";

function clean(x) {
  return String(x ?? "").trim();
}

function getEnv(name, fallback = "") {
  return clean(process.env[name] || fallback);
}

export function getMerchantTokenName() {
  return getEnv("MERCHANT_TOKEN_NAME", "merchant_token");
}

export function safeReturnTo(path, fallback = "/m/dashboard") {
  const s = clean(path);
  if (!s) return fallback;
  if (!s.startsWith("/")) return fallback;
  // กัน open redirect แบบง่าย
  if (s.startsWith("//")) return fallback;
  return s;
}

export function signMerchantJwt(payload) {
  const secret = getEnv("MERCHANT_JWT_SECRET");
  if (!secret) throw new Error("Missing MERCHANT_JWT_SECRET");
  const expiresIn = getEnv("MERCHANT_JWT_EXPIRES_IN", "12h");
  return jwt.sign(payload, secret, { expiresIn });
}

export async function verifyMerchantJwt(token) {
  const secret = getEnv("MERCHANT_JWT_SECRET");
  if (!secret) throw new Error("Missing MERCHANT_JWT_SECRET");
  return jwt.verify(token, secret);
}

export function setMerchantCookie(res, token) {
  const name = getMerchantTokenName();
  res.cookies.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function clearMerchantCookie(res) {
  const name = getMerchantTokenName();
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getMerchantFromRequest(req) {
  try {
    const name = getMerchantTokenName();
    const token = req.cookies.get(name)?.value || "";
    if (!token) return { ok: false, error: "NO_TOKEN" };

    const decoded = await verifyMerchantJwt(token);
    const userId = decoded?.uid;
    if (!userId) return { ok: false, error: "BAD_TOKEN" };

    await dbConnect();
    const user = await MerchantUser.findById(userId).lean();
    if (!user || !user.isActive) return { ok: false, error: "USER_DISABLED" };

    const restaurant = await Restaurant.findById(user.restaurantId).lean();
    if (!restaurant || restaurant.isActive === false)
      return { ok: false, error: "RESTAURANT_DISABLED" };

    return {
      ok: true,
      userId: String(user._id),
      restaurantId: String(user.restaurantId),
      user,
      restaurant,
    };
  } catch (e) {
    return { ok: false, error: "AUTH_ERROR" };
  }
}

export async function requireMerchant(req) {
  const me = await getMerchantFromRequest(req);
  if (me.ok) return me;
  return NextResponse.json(
    { ok: false, error: "UNAUTHORIZED" },
    { status: 401 },
  );
}
