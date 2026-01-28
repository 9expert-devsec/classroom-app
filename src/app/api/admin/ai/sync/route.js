// src/app/api/admin/ai/sync/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import AiInstructor from "@/models/AiInstructor";
import AiSchedule from "@/models/AiSchedule";
import { fetchAiJson } from "@/lib/aiUpstream.server";
// import { requireAdmin } from "@/lib/adminAuth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function syncInstructors() {
  // ✅ ปรับให้เรียก upstream โดยตรง (ลองหลาย path เผื่อชื่อ endpoint ต่างกัน)
  const upstream = await fetchAiJson([
    "instructors",
    "instructor",
    "admin/ai/instructors",
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

async function syncSchedule({ from, to }) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  // ✅ ปรับให้เรียก upstream โดยตรง
  const upstream = await fetchAiJson(
    ["schedule", "schedules", "admin/ai/schedule"],
    {
      query: qs,
    },
  );

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

export async function POST(req) {
  try {
    // await requireAdmin(req);
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const kind = String(searchParams.get("kind") || "all");
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const out = {};
    if (kind === "all" || kind === "instructors")
      out.instructors = await syncInstructors();
    if (kind === "all" || kind === "schedule")
      out.schedule = await syncSchedule({ from, to });

    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const status = Number(e?.status) || 500;
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status },
    );
  }
}
