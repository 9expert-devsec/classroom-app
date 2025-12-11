import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/mongoose";
import AdminUser from "@/models/AdminUser";

const TOKEN_NAME = "admin_token";

export const dynamic = "force-dynamic";

export async function GET(req) {
  await dbConnect();
  const token = req.cookies.get(TOKEN_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await AdminUser.findById(decoded.sub).lean();
    if (!user) throw new Error("User not found");

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }
}
