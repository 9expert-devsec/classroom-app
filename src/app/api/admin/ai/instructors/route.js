import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AiInstructor from "@/models/AiInstructor";

const RAW_BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 24 * 60 * 60 * 1000; // ✅ 1 วัน

function pickArray(json) {
  return (
    json?.items ||
    json?.data ||
    json?.instructors ||
    (Array.isArray(json) ? json : [])
  );
}

async function getLatestSyncedAt() {
  const latest = await AiInstructor.findOne({}, { syncedAt: 1 })
    .sort({ syncedAt: -1 })
    .lean();
  return latest?.syncedAt ? new Date(latest.syncedAt) : null;
}

async function isStale() {
  const latest = await getLatestSyncedAt();
  if (!latest) return true;
  return Date.now() - latest.getTime() > TTL_MS;
}

async function syncFromUpstream() {
  if (!RAW_BASE || !KEY) {
    throw new Error("Missing AI_API_BASE or AI_API_KEY");
  }

  const BASE = RAW_BASE.replace(/\/+$/, "");
  const url = `${BASE}/instructors`;

  const upstreamRes = await fetch(url, {
    headers: { "x-api-key": KEY },
    cache: "no-store",
  });

  const text = await upstreamRes.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`upstream_not_json: ${text.slice(0, 200)}`);
  }

  if (!upstreamRes.ok) {
    throw new Error(
      `upstream_error ${upstreamRes.status}: ${text.slice(0, 200)}`,
    );
  }

  const rows = pickArray(json);
  const now = new Date();

  const ops = rows
    .map((r) => {
      const externalId = String(
        r?._id || r?.id || r?.instructor_id || "",
      ).trim();
      if (!externalId) return null;

      return {
        updateOne: {
          filter: { externalId },
          update: {
            $set: {
              name:
                r?.name || r?.display_name || r?.fullname || r?.name_th || "",
              email: r?.email || r?.instructor_email || "",
              code: r?.code || r?.instructor_code || "",
              raw: r,
              syncedAt: now,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (ops.length) await AiInstructor.bulkWrite(ops, { ordered: false });

  return { upstreamCount: rows.length, upserted: ops.length, at: now };
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "1";

    const stale = await isStale();
    let syncInfo = null;

    if (refresh || stale) {
      syncInfo = await syncFromUpstream();
    }

    // ส่ง raw ออกไปให้ compat กับ UI เดิม
    const docs = await AiInstructor.find({}, { raw: 1 })
      .sort({ name: 1 })
      .lean();

    const items = docs.map((d) => d.raw).filter(Boolean);

    const latestSyncedAt = await getLatestSyncedAt();

    return NextResponse.json({
      ok: true,
      source: "db",
      synced: !!syncInfo,
      stale,
      latestSyncedAt: latestSyncedAt ? latestSyncedAt.toISOString() : null,
      syncInfo,
      items,
    });
  } catch (err) {
    console.error("ai/instructors:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
