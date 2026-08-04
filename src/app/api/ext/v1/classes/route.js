// src/app/api/ext/v1/classes/route.js
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import { isYMD } from "@/lib/classDates";
import {
  corsPreflight,
  externalBaseUrl,
  externalError,
  guardExternalRequest,
  withCors,
} from "@/lib/externalAuth.server";
import { serializeClasses } from "@/lib/externalClass.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPE = "classes.read";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clean(x) {
  return String(x ?? "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match classes that teach on any day within [fromYmd, toYmd].
 *
 * Primary path uses the stored days[] (populated on every class today).
 * The fallback covers legacy rows with an empty days[] by deriving the span
 * from `date` + duration.dayCount, mirroring the same precedence the admin API
 * uses for dayCount.
 */
function dateRangeFilter(fromYmd, toYmd) {
  const startOfFrom = new Date(`${fromYmd}T00:00:00.000Z`);
  const endOfTo = new Date(`${toYmd}T23:59:59.999Z`);

  return {
    $or: [
      { days: { $elemMatch: { $gte: fromYmd, $lte: toYmd } } },
      {
        $and: [
          { $or: [{ days: { $exists: false } }, { days: { $size: 0 } }] },
          { date: { $lte: endOfTo } },
          {
            $expr: {
              $gte: [
                {
                  $add: [
                    "$date",
                    {
                      $multiply: [
                        { $subtract: [{ $ifNull: ["$duration.dayCount", 1] }, 1] },
                        86400000,
                      ],
                    },
                  ],
                },
                startOfFrom,
              ],
            },
          },
        ],
      },
    ],
  };
}

export async function OPTIONS(req) {
  return corsPreflight(req);
}

export async function GET(req) {
  try {
    await dbConnect();

    const guard = await guardExternalRequest(req, { scope: SCOPE });
    if (guard.error) return guard.error;

    const { searchParams } = new URL(req.url);

    const date = clean(searchParams.get("date"));
    const from = clean(searchParams.get("from"));
    const to = clean(searchParams.get("to"));
    const course = clean(searchParams.get("course"));
    const q = clean(searchParams.get("q"));
    const room = clean(searchParams.get("room"));
    const sort = clean(searchParams.get("sort")) || "date_asc";
    const includeSignature = searchParams.get("signature") !== "0";

    const and = [];

    if (date) {
      if (!isYMD(date)) {
        return withCors(
          externalError(400, "invalid_date", "date must be YYYY-MM-DD"),
          guard.cors,
        );
      }
      and.push(dateRangeFilter(date, date));
    } else if (from || to) {
      const f = from || to;
      const t = to || from;
      if (!isYMD(f) || !isYMD(t)) {
        return withCors(
          externalError(400, "invalid_date", "from/to must be YYYY-MM-DD"),
          guard.cors,
        );
      }
      if (f > t) {
        return withCors(
          externalError(400, "bad_request", "from must not be after to"),
          guard.cors,
        );
      }
      and.push(dateRangeFilter(f, t));
    }

    if (course) {
      and.push({ courseCode: new RegExp(`^${escapeRegExp(course)}$`, "i") });
    }

    if (room) {
      and.push({ room: new RegExp(`^${escapeRegExp(room)}$`, "i") });
    }

    if (q) {
      const re = new RegExp(escapeRegExp(q), "i");
      and.push({
        $or: [
          { title: re },
          { courseCode: re },
          { courseName: re },
          { customCourseName: re },
          { room: re },
          { "instructors.name": re },
        ],
      });
    }

    const find = and.length ? { $and: and } : {};

    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const pageRaw = Number(searchParams.get("page"));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

    const sortSpec =
      sort === "date_desc" ? { date: -1, title: 1 } : { date: 1, title: 1 };

    const total = await Class.countDocuments(find);

    // Explicit projection: nothing student-related exists on Class, and this
    // keeps it that way even if the schema grows.
    const docs = await Class.find(find, {
      title: 1,
      courseCode: 1,
      courseName: 1,
      customCourseName: 1,
      classImageUrl: 1,
      date: 1,
      days: 1,
      duration: 1,
      program: 1,
      room: 1,
      trainingType: 1,
      channel: 1,
      instructors: 1,
      updatedAt: 1,
    })
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const items = await serializeClasses(docs, {
      includeSignature,
      baseUrl: externalBaseUrl(),
      keyId: String(guard.keyDoc._id),
    });

    return withCors(
      NextResponse.json({
        ok: true,
        version: "v1",
        count: items.length,
        total,
        page,
        limit,
        items,
      }),
      guard.cors,
    );
  } catch (e) {
    console.error("ext/v1/classes:", e?.message || e);
    return externalError(500, "server_error", "Internal server error");
  }
}
