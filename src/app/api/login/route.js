// src/app/api/login/route.js
import { NextResponse } from "next/server";
import { signAdminToken } from "@/utils/auth";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";

export async function POST(req) {
  const { username, password } = await req.json();

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error("ADMIN_USERNAME / ADMIN_PASSWORD not set in env");
    return NextResponse.json(
      { ok: false, error: "Server config error" },
      { status: 500 }
    );
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Username หรือ Password ไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  // สร้าง JWT อายุ 7 วัน
  const token = await signAdminToken({ username });

  const res = NextResponse.json({ ok: true });

  // เขียน cookie
  res.cookies.set(TOKEN_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 วัน
  });

  return res;
}
