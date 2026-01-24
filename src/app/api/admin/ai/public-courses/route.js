// src/app/api/admin/ai/public-courses/route.js
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

async function tryFetchUpstream(urls) {
  for (const url of urls) {
    const res = await fetch(url, {
      headers: {
        "x-api-key": KEY,
        accept: "application/json",
      },
      cache: "no-store",
    }).catch(() => null);

    if (!res) continue;

    const body = await readBodySafe(res);

    // ถ้า 200 แต่ไม่ใช่ JSON (เช่น HTML) ให้ลองตัวถัดไป
    if (res.ok && !body.okJson) continue;

    // ok + json => ใช้อันนี้เลย
    if (res.ok && body.okJson) {
      return { ok: true, url, status: res.status, body: body.json };
    }

    // ถ้า 404 ให้ลองตัวถัดไป (เผื่อ path ไม่ตรง)
    if (!res.ok && res.status === 404) continue;

    // error อื่น ๆ ส่งกลับทันที
    return {
      ok: false,
      url,
      status: res.status,
      contentType: body.ct,
      detail: body.okJson ? body.json : body.text.slice(0, 500),
    };
  }

  return {
    ok: false,
    url: urls[0] || "",
    status: 404,
    contentType: "text/plain",
    detail: "not found in any upstream path",
  };
}

// พยายาม normalize ให้ได้ item เดียว
function pickSingleItem(payload, courseIdOrId) {
  // upstream อาจคืน { ok:true, item } หรือ { item } ตรง ๆ
  const directItem = payload?.item || payload?.data || null;
  if (directItem) return directItem;

  const items = Array.isArray(payload?.items) ? payload.items : null;
  if (!items) return null;

  const key = String(courseIdOrId || "").trim();
  if (!key) return null;

  // match by course_id / courseCode / id / _id
  return (
    items.find((x) => String(x?._id || "") === key) ||
    items.find((x) => String(x?.id || "") === key) ||
    items.find((x) => String(x?.course_id || "") === key) ||
    items.find((x) => String(x?.courseId || "") === key) ||
    items.find((x) => String(x?.course_code || "") === key) ||
    items.find((x) => String(x?.courseCode || "") === key) ||
    null
  );
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

  // รองรับหลายชื่อ param ที่ฝั่ง client อาจใช้
  const courseId =
    cleanStr(searchParams.get("course_id")) ||
    cleanStr(searchParams.get("courseId")) ||
    cleanStr(searchParams.get("courseCode"));

  const id = cleanStr(searchParams.get("id"));

  // key ตัวเดียวที่เราจะใช้หา
  const key = courseId || id;

  // query string เดิมทั้งหมด (เผื่อ upstream รองรับ filter อื่น ๆ)
  const qs = searchParams.toString();

  // ถ้ามี key -> ทำ url candidates ให้ลองหลายแบบ
  // - ทั้ง plural/singular
  // - ทั้ง dash/underscore
  // - ทั้ง query/segment
  const candidates = [];

  // helpers
  function add(path, mode = "query") {
    if (mode === "query") {
      candidates.push(`${BASE}/${path}${qs ? `?${qs}` : ""}`);
    } else if (mode === "segment" && key) {
      candidates.push(`${BASE}/${path}/${encodeURIComponent(key)}`);
    }
  }

  // ✅ ลองชุด endpoint ที่เป็นไปได้
  const paths = [
    "public-courses",
    "public-course",
    "publiccourses",
    "public_course",
    "public_courses",
    "courses",
    "course",
  ];

  for (const p of paths) {
    add(p, "query");
    add(p, "segment");
  }

  const upstream = await tryFetchUpstream(candidates);

  if (!upstream.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "upstream error",
        url: upstream.url,
        status: upstream.status,
        contentType: upstream.contentType,
        detail: upstream.detail,
      },
      { status: upstream.status || 502 }
    );
  }

  const payload = upstream.body;

  // ถ้ามี key พยายามหา item เดียวให้
  const item = key ? pickSingleItem(payload, key) : null;

  // ถ้า upstream คืนมาทั้งชุด items เราก็ส่งต่อไปได้ แต่เพิ่ม item ให้ด้วย
  const items = Array.isArray(payload?.items) ? payload.items : null;

  // ส่งกลับแบบ normalize:
  // - ok:true
  // - item (ถ้าหาได้)
  // - items (ถ้ามี)
  // - upstreamUrl (debug)
  return NextResponse.json(
    {
      ok: true,
      upstreamUrl: upstream.url,
      item: item || null,
      items: items || payload?.items || null,
      data: items ? undefined : payload, // ถ้าไม่ได้เป็นรูปแบบ items ก็เก็บ payload เดิมไว้
    },
    { status: 200 }
  );
}
