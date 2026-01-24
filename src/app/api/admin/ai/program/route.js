// src/app/api/admin/ai/program/route.js
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RAW_BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

function cleanStr(x) {
  return String(x || "").trim();
}

function normalizeBase(base) {
  const b = cleanStr(base);
  if (!b) return "";
  return b.replace(/\/+$/, "");
}

async function readBodySafe(res) {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text().catch(() => "");
  const isJson = ct.includes("application/json");

  if (!isJson) return { okJson: false, ct, text, json: null };

  try {
    const json = JSON.parse(text);
    return { okJson: true, ct, text, json };
  } catch {
    return { okJson: false, ct, text, json: null };
  }
}

export async function GET(req) {
  const BASE = normalizeBase(RAW_BASE);

  if (!BASE || !KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing AI_API_BASE or AI_API_KEY",
        AI_API_BASE: BASE || null,
        AI_API_KEY: KEY ? "***set***" : null,
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);

  // รับได้ทั้ง:
  // - id = Mongo _id ของ program (แนะนำ)
  // - program_id = รหัสเช่น "SQL" (ถ้าระบบ upstream รองรับ)
  const id = cleanStr(searchParams.get("id"));
  const programId = cleanStr(searchParams.get("program_id"));

  const qs = new URLSearchParams();
  if (id) qs.set("id", id);
  if (!id && programId) qs.set("program_id", programId);

  if (![id, programId].some(Boolean)) {
    return NextResponse.json(
      { ok: false, error: "Missing query: id or program_id" },
      { status: 400 }
    );
  }

  // สมมติ upstream เป็น /programs (พหูพจน์) หรือ /program
  // เราจะลอง programs ก่อน แล้วค่อย fallback
  const tries = [
    `${BASE}/programs?${qs.toString()}`,
    `${BASE}/program?${qs.toString()}`,
  ];

  let lastErr = null;

  for (const url of tries) {
    try {
      const res = await fetch(url, {
        headers: {
          "x-api-key": KEY,
          accept: "application/json",
        },
        cache: "no-store",
      });

      const body = await readBodySafe(res);

      if (!res.ok) {
        lastErr = {
          ok: false,
          error: "upstream error",
          url,
          status: res.status,
          contentType: body.ct,
          detail: body.okJson ? body.json : body.text.slice(0, 300),
        };
        continue;
      }

      if (!body.okJson) {
        lastErr = {
          ok: false,
          error: "upstream returned non-json",
          url,
          contentType: body.ct,
          preview: body.text.slice(0, 300),
        };
        continue;
      }

      return NextResponse.json(
        { ok: true, upstreamUrl: url, ...body.json },
        { status: 200 }
      );
    } catch (e) {
      lastErr = { ok: false, error: "fetch failed", url, detail: String(e) };
    }
  }

  return NextResponse.json(lastErr || { ok: false, error: "unknown error" }, {
    status: 502,
  });
}
