import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AiSchedule from "@/models/AiSchedule";

const RAW_BASE = process.env.AI_API_BASE;
const KEY = process.env.AI_API_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 10 * 60 * 1000; // ✅ 10 นาที

function pickArray(json) {
  return (
    json?.items ||
    json?.data ||
    json?.schedules ||
    (Array.isArray(json) ? json : [])
  );
}

function toDateSafe(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function computeRange(s) {
  const dates = Array.isArray(s?.dates) ? s.dates : [];
  const ds = dates
    .map(toDateSafe)
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (ds.length) return { startAt: ds[0], endAt: ds[ds.length - 1] };

  const one =
    toDateSafe(s?.startDate) ||
    toDateSafe(s?.start_at) ||
    toDateSafe(s?.start) ||
    toDateSafe(s?.date) ||
    null;

  return { startAt: one, endAt: one };
}

async function getLatestSyncedAt() {
  const latest = await AiSchedule.findOne({}, { syncedAt: 1 })
    .sort({ syncedAt: -1 })
    .lean();
  return latest?.syncedAt ? new Date(latest.syncedAt) : null;
}

async function isStale() {
  const latest = await getLatestSyncedAt();
  if (!latest) return true;
  return Date.now() - latest.getTime() > TTL_MS;
}

async function syncFromUpstream({ qs }) {
  if (!RAW_BASE || !KEY) {
    throw new Error("Missing AI_API_BASE or AI_API_KEY");
  }

  const BASE = RAW_BASE.replace(/\/+$/, "");
  const url = `${BASE}/schedules${qs ? `?${qs}` : ""}`;

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
    .map((s) => {
      const externalId = String(s?._id || s?.id || s?.schedule_id || "").trim();
      if (!externalId) return null;

      const { startAt, endAt } = computeRange(s);

      const courseCode =
        s?.course?.course_id || s?.course_id || s?.courseCode || s?.code || "";
      const courseName =
        s?.course?.course_name || s?.course_name || s?.title || "";

      return {
        updateOne: {
          filter: { externalId },
          update: {
            $set: {
              startAt,
              endAt,
              type: String(s?.type || ""),
              room: String(s?.room || ""),
              courseCode: String(courseCode || ""),
              courseName: String(courseName || ""),
              dates: Array.isArray(s?.dates) ? s.dates.map(String) : [],
              raw: s,
              syncedAt: now,
            },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (ops.length) await AiSchedule.bulkWrite(ops, { ordered: false });

  return { upstreamCount: rows.length, upserted: ops.length, at: now };
}

function parseYMDToRange(ymd, endOfDay = false) {
  if (!ymd) return null;
  const t = endOfDay ? "T23:59:59" : "T00:00:00";
  const d = new Date(`${ymd}${t}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const refresh = searchParams.get("refresh") === "1";

    const stale = await isStale();
    let syncInfo = null;

    if (refresh || stale) {
      syncInfo = await syncFromUpstream({ qs });
    }

    const fromDt = parseYMDToRange(from, false);
    const toDt = parseYMDToRange(to, true);

    const filter = {};
    if (fromDt && toDt) {
      filter.startAt = { $lte: toDt };
      filter.endAt = { $gte: fromDt };
    } else if (fromDt) {
      filter.endAt = { $gte: fromDt };
    } else if (toDt) {
      filter.startAt = { $lte: toDt };
    }

    const docs = await AiSchedule.find(filter, { raw: 1, startAt: 1 })
      .sort({ startAt: 1 })
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
    console.error("ai/schedule:", err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 },
    );
  }
}
