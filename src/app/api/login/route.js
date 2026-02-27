// src/app/api/login/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";
import { signAdminToken } from "@/utils/auth";
import { hashPassword, verifyPassword } from "@/lib/password.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_NAME = process.env.ADMIN_TOKEN_NAME || "admin_token";

function clean(x) {
  return String(x || "").trim();
}

export async function POST(req) {
  const { username, password } = await req.json();

  const u = clean(username).toLowerCase();
  const p = clean(password);

  if (!u || !p) {
    return NextResponse.json(
      { ok: false, error: "กรอก Username และ Password ให้ครบ" },
      { status: 400 },
    );
  }

  await dbConnect();

  // ✅ Bootstrap (ครั้งแรกเท่านั้น): ถ้า DB ยังไม่มี user
  const count = await AdminUser.countDocuments({});
  if (count === 0) {
    const ADMIN_USERNAME = clean(process.env.ADMIN_USERNAME).toLowerCase();
    const ADMIN_PASSWORD = clean(process.env.ADMIN_PASSWORD);

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          ok: false,
          error: "Server config error: ADMIN_USERNAME/ADMIN_PASSWORD not set",
        },
        { status: 500 },
      );
    }

    if (u !== ADMIN_USERNAME || p !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { ok: false, error: "Username หรือ Password ไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const created = await AdminUser.create({
      username: ADMIN_USERNAME,
      name: "Super Admin",
      roleCode: "SA",
      passwordHash,
      isActive: true,
    });

    const token = await signAdminToken({
      userId: String(created._id),
      username: created.username,
      roleCode: "SA",
    });

    const res = NextResponse.json({ ok: true, bootstrap: true });

    res.cookies.set(TOKEN_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  }

  // ✅ Login ปกติ: ใช้ DB user
  const user = await AdminUser.findOne({ username: u });
  if (!user || !user.isActive) {
    return NextResponse.json(
      { ok: false, error: "Username หรือ Password ไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(p, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Username หรือ Password ไม่ถูกต้อง" },
      { status: 401 },
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = await signAdminToken({
    userId: String(user._id),
    username: user.username,
    roleCode: user.roleCode,
  });

  const res = NextResponse.json({ ok: true });

  res.cookies.set(TOKEN_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
