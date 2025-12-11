// src/app/api/logout/route.js
import { NextResponse } from "next/server";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // set maxAge = 0 เพื่อลบ cookie
  res.cookies.set(TOKEN_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return res;
}
