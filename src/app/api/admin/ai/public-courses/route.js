import { NextResponse } from "next/server";

const BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!BASE || !KEY) {
    return NextResponse.json(
      { error: "Missing AI_API_BASE or AI_API_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const url = `${BASE}/public-course${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, {
      headers: {
        "x-api-key": KEY,
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream error", detail: data },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("public-courses proxy error:", err);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
