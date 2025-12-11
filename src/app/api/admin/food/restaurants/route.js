import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Restaurant from "@/models/Restaurant";

export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  const items = await Restaurant.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json({ ok: true, items });
}

export async function POST(req) {
  await dbConnect();
  const body = await req.json();
  const { name, logoUrl } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "กรุณากรอกชื่อร้าน" }, { status: 400 });
  }

  const r = await Restaurant.create({
    name: name.trim(),
    logoUrl: logoUrl || "",
  });

  return NextResponse.json({ ok: true, item: r });
}
