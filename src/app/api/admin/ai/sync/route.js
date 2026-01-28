// src/app/api/admin/ai/sync/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";

import AiInstructor from "@/models/AiInstructor";
import AiSchedule from "@/models/AiSchedule";
import AiCache from "@/models/AiCache";

import {
  requireAiEnv,
  fetchAiJson,
  buildProgramCandidates,
  buildPublicCoursesCandidates,
  tryFetchUpstream,
  pickSingleItem,
} from "@/lib/aiUpstream.server";

// export const runtime = "nodejs"; // ถ้าต้องการ
export const dynamic = "force-dynamic";

/* ---------------- helpers ---------------- */

function pickArray(data) {
  return (
    data?.items ||
    data?.data ||
    data?.schedules ||
    data?.instructors ||
    (Array.isArray(data) ? data : [])
  );
}

function toDateSafe(x) {
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minMaxDates(dateStrs) {
  const ds = (Array.isArray(dateStrs) ? dateStrs : [])
    .map((x) => toDateSafe(x))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  if (!ds.length) return { startAt: null, endAt: null };
  return { startAt: ds[0], endAt: ds[ds.length - 1] };
}

async function upsertCache({ endpoint, key, data, ttlMs, upstreamUrl }) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  await AiCache.findOneAndUpdate(
    { endpoint, key },
    {
      $set: {
        data,
        syncedAt: now,
        expiresAt,
        upstreamUrl: upstreamUrl || "",
      },
    },
    { upsert: true },
  );

  return { endpoint, key, syncedAt: now, expiresAt };
}

/* ---------------- sync: instructors ---------------- */

async function syncInstructors() {
  const upstream = await fetchAiJson([
    "/api/admin/ai/instructors",
    "instructors",
  ]);
  const rows = pickArray(upstream);

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
  return { count: ops.length };
}

/* ---------------- sync: schedule ---------------- */

async function syncSchedule({ from, to }) {
  const upstream = await fetchAiJson(["/api/admin/ai/schedule", "schedule"], {
    query: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
  });
  const rows = pickArray(upstream);

  const now = new Date();
  const ops = rows
    .map((s) => {
      const externalId = String(s?._id || s?.id || s?.schedule_id || "").trim();
      if (!externalId) return null;

      const dates = Array.isArray(s?.dates) ? s.dates : [];
      const { startAt, endAt } = minMaxDates(
        dates.length
          ? dates
          : [s?.startDate || s?.start_at || s?.start || s?.date],
      );

      const courseCode =
        s?.course?.course_id || s?.course_id || s?.courseCode || s?.code || "";
      const courseName =
        s?.course?.course_name || s?.course_name || s?.title || "";

      return {
        updateOne: {
          filter: { externalId },
          update: {
            $set: {
              type: String(s?.type || ""),
              channel: String(
                s?.channel || s?.channelCode || s?.audience || "",
              ),
              courseCode: String(courseCode || ""),
              courseName: String(courseName || ""),
              room: String(s?.room || ""),
              dates: dates.map(String),
              startAt,
              endAt,
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
  return { count: ops.length };
}

/* ---------------- sync: public-courses ---------------- */
// TTL 10 นาที (เหมือน route)
const TTL_PUBLIC_COURSES = 10 * 60 * 1000;

async function syncPublicCourses({ qs = "", key = "" } = {}) {
  const { BASE } = requireAiEnv();
  const candidates = buildPublicCoursesCandidates({ BASE, qs, key });

  const upstream = await tryFetchUpstream(candidates);
  if (!upstream.ok) {
    const err = new Error("upstream public-courses error");
    err.upstream = upstream;
    throw err;
  }

  const payload = upstream.body;
  const item = key ? pickSingleItem(payload, key) : null;
  const items = Array.isArray(payload?.items) ? payload.items : null;

  const cacheKey = key ? `key:${key}` : qs ? `qs:${qs}` : "__list__";

  const cache = await upsertCache({
    endpoint: "public-courses",
    key: cacheKey,
    ttlMs: TTL_PUBLIC_COURSES,
    upstreamUrl: upstream.url,
    data: {
      ok: true,
      upstreamUrl: upstream.url,
      item,
      items,
      data: items ? undefined : payload,
    },
  });

  return {
    cacheKey,
    upstreamUrl: upstream.url,
    itemsCount: items?.length || 0,
    ...cache,
  };
}

/* ---------------- sync: program ---------------- */
// TTL 1 วัน
const TTL_PROGRAM = 24 * 60 * 60 * 1000;

async function syncProgram({ id = "", program_id = "" } = {}) {
  const { BASE } = requireAiEnv();

  // ถ้ามี id/program_id -> sync แบบ single เหมือน route
  if (id || program_id) {
    const qs = new URLSearchParams();
    if (id) qs.set("id", id);
    if (!id && program_id) qs.set("program_id", program_id);

    const candidates = buildProgramCandidates({ BASE, qs: qs.toString() });
    const upstream = await tryFetchUpstream(candidates);
    if (!upstream.ok) {
      const err = new Error("upstream program error");
      err.upstream = upstream;
      throw err;
    }

    const cacheKey = id ? `id:${id}` : `program_id:${program_id}`;

    const cache = await upsertCache({
      endpoint: "program",
      key: cacheKey,
      ttlMs: TTL_PROGRAM,
      upstreamUrl: upstream.url,
      data: { ok: true, upstreamUrl: upstream.url, ...upstream.body },
    });

    return { cacheKey, upstreamUrl: upstream.url, ...cache };
  }

  // ไม่มี param -> พยายาม sync “list” ถ้า upstream รองรับ
  const candidates = [`${BASE}/programs`, `${BASE}/program`];

  const upstream = await tryFetchUpstream(candidates);
  if (!upstream.ok) {
    const err = new Error("upstream program(list) error");
    err.upstream = upstream;
    throw err;
  }

  const payload = upstream.body;
  const items = Array.isArray(payload?.items)
    ? payload.items
    : pickArray(payload);

  const cache = await upsertCache({
    endpoint: "program",
    key: "__list__",
    ttlMs: TTL_PROGRAM,
    upstreamUrl: upstream.url,
    data: { ok: true, upstreamUrl: upstream.url, items, data: payload },
  });

  return {
    cacheKey: "__list__",
    upstreamUrl: upstream.url,
    itemsCount: items?.length || 0,
    ...cache,
  };
}

/* ---------------- POST handler ---------------- */

export async function POST(req) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const kind = String(searchParams.get("kind") || "all"); // all | instructors | schedule | public-courses | program

    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const qs = searchParams.get("qs") || ""; // สำหรับ public-courses
    const key = searchParams.get("key") || ""; // course_id/id สำหรับ public-courses

    const id = searchParams.get("id") || ""; // program id
    const program_id = searchParams.get("program_id") || "";

    const out = {};

    if (kind === "all" || kind === "instructors")
      out.instructors = await syncInstructors();
    if (kind === "all" || kind === "schedule")
      out.schedule = await syncSchedule({ from, to });
    if (kind === "all" || kind === "public-courses")
      out.publicCourses = await syncPublicCourses({ qs, key });
    if (kind === "all" || kind === "program")
      out.program = await syncProgram({ id, program_id });

    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const msg = String(e?.message || e);
    const upstream = e?.upstream?.upstream || e?.upstream || null;
    return NextResponse.json(
      { ok: false, error: msg, upstream },
      { status: e?.status || 500 },
    );
  }
}
