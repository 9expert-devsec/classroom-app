import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AiCache from "@/models/AiCache";
import { requireAdmin } from "@/lib/adminAuth.server";

import {
  requireAiEnv,
  buildPublicCoursesCandidates,
  tryFetchUpstream,
  pickSingleItem,
} from "@/lib/aiUpstream.server";

export const dynamic = "force-dynamic";

// ✅ TTL: public-courses 10 นาที
const TTL_MS = 10 * 60 * 1000;

function cleanStr(x) {
  return String(x || "").trim();
}

export async function POST(req) {
  await requireAdmin();
  await dbConnect();

  const { BASE } = requireAiEnv();

  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();

  const courseId =
    cleanStr(searchParams.get("course_id")) ||
    cleanStr(searchParams.get("courseId")) ||
    cleanStr(searchParams.get("courseCode"));

  const id = cleanStr(searchParams.get("id"));
  const keyParam = courseId || id;

  const cacheKey = keyParam ? `key:${keyParam}` : qs ? `qs:${qs}` : "__list__";

  const candidates = buildPublicCoursesCandidates({
    BASE,
    qs,
    key: keyParam,
  });

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
      { status: upstream.status || 502 },
    );
  }

  const payload = upstream.body;
  const item = keyParam ? pickSingleItem(payload, keyParam) : null;
  const items = Array.isArray(payload?.items) ? payload.items : null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  await AiCache.findOneAndUpdate(
    { endpoint: "public-courses", key: cacheKey },
    {
      $set: {
        data: {
          ok: true,
          upstreamUrl: upstream.url,
          item,
          items,
          data: items ? undefined : payload,
        },
        syncedAt: now,
        expiresAt,
        upstreamUrl: upstream.url,
      },
    },
    { upsert: true, new: true },
  );

  return NextResponse.json({
    ok: true,
    synced: true,
    endpoint: "public-courses",
    key: cacheKey,
    syncedAt: now,
    expiresAt,
    upstreamUrl: upstream.url,
    item: item || null,
    items: items || payload?.items || null,
  });
}
