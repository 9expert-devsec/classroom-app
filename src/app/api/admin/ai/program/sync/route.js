import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AiCache from "@/models/AiCache";
import { requireAdmin } from "@/lib/adminAuth.server";

import {
  requireAiEnv,
  buildProgramCandidates,
  tryFetchUpstream,
} from "@/lib/aiUpstream.server";

export const dynamic = "force-dynamic";

// ✅ TTL: program 1 วัน
const TTL_MS = 24 * 60 * 60 * 1000;

function cleanStr(x) {
  return String(x || "").trim();
}

export async function POST(req) {
  await requireAdmin();
  await dbConnect();

  const { BASE } = requireAiEnv();

  const { searchParams } = new URL(req.url);
  const id = cleanStr(searchParams.get("id"));
  const programId = cleanStr(searchParams.get("program_id"));

  if (![id, programId].some(Boolean)) {
    return NextResponse.json(
      { ok: false, error: "Missing query: id or program_id" },
      { status: 400 },
    );
  }

  const qs = new URLSearchParams();
  if (id) qs.set("id", id);
  if (!id && programId) qs.set("program_id", programId);

  const candidates = buildProgramCandidates({ BASE, qs: qs.toString() });
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

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  const cacheKey = id ? `id:${id}` : `program_id:${programId}`;

  await AiCache.findOneAndUpdate(
    { endpoint: "program", key: cacheKey },
    {
      $set: {
        data: { ok: true, upstreamUrl: upstream.url, ...upstream.body },
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
    endpoint: "program",
    key: cacheKey,
    syncedAt: now,
    expiresAt,
    upstreamUrl: upstream.url,
    ...upstream.body,
  });
}
