import { NextResponse } from "next/server";

const RAW_BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!RAW_BASE || !KEY) {
    return NextResponse.json(
      {
        error: "Missing AI_API_BASE or AI_API_KEY",
        AI_API_BASE: RAW_BASE || null,
        AI_API_KEY: KEY ? "***set***" : null,
      },
      { status: 500 }
    );
  }

  // base เช่น https://9exp-sec.com/api/ai  (ไม่มี / ท้าย)
  const BASE = RAW_BASE.replace(/\/+$/, "");

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  // 🔴 เปลี่ยนเป็น schedules (มี s ท้าย)
  const url = `${BASE}/schedules${qs ? `?${qs}` : ""}`;

  try {
    const upstreamRes = await fetch(url, {
      headers: {
        "x-api-key": KEY,
      },
      cache: "no-store",
    });

    const text = await upstreamRes.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error(
        "schedule proxy body (first 300 chars):",
        text.slice(0, 300)
      );
      return NextResponse.json(
        {
          error: "upstream_not_json",
          status: upstreamRes.status,
          url,
          bodySnippet: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          error: "upstream_error",
          status: upstreamRes.status,
          url,
          detail: json,
        },
        { status: upstreamRes.status }
      );
    }

    return NextResponse.json(json);
  } catch (err) {
    console.error("schedule proxy fetch failed:", err);
    return NextResponse.json(
      {
        error: "fetch_failed",
        message: String(err),
        url,
      },
      { status: 500 }
    );
  }
}
