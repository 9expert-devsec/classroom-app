// src/app/api/ext/v1/schedule/route.js
//
// Unified day-oriented feed: training classes and events in ONE list, merged,
// sorted and paged together.
//
// Two collections, one page. The strategy is a bounded merge, never a
// "load everything and sort in memory":
//
//   1. count each side (2 counts)
//   2. pull at most (skip + limit) SORT KEYS from each side - a light
//      projection, not the documents
//   3. merge, sort, slice to the requested page
//   4. hydrate ONLY the <= limit ids that survived, then serialize
//
// So the biggest read is bounded by the page window, and the expensive part
// (instructor + signature resolution) only ever touches the items actually
// being returned.
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Class from "@/models/Class";
import Event from "@/models/Event";
import {
  bangkokDayEndUTC,
  bangkokDayStartUTC,
  bangkokTodayYMD,
  bangkokYMD,
  isYMD,
} from "@/lib/classDates";
import {
  corsPreflight,
  externalBaseUrl,
  externalError,
  guardExternalRequest,
  withCors,
} from "@/lib/externalAuth.server";
import {
  classDateRangeFilter,
  datesOf,
  serializeClasses,
} from "@/lib/externalClass.server";
import {
  EXTERNAL_EVENT_PROJECTION,
  serializeEvent,
} from "@/lib/externalEvent.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLASS_SCOPE = "classes.read";
const EVENT_SCOPE = "events.read";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const TYPE_CLASS = "class";
const TYPE_EVENT = "event";
const VALID_TYPES = [TYPE_CLASS, TYPE_EVENT, "all"];

// Same explicit allow-list /classes uses. Nothing student-related exists on
// Class today and this keeps it that way if the schema ever grows.
const CLASS_PROJECTION = {
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
};

// Enough to compute a sort key, nothing more.
const CLASS_KEY_PROJECTION = { date: 1, days: 1, "duration.dayCount": 1, title: 1 };
const EVENT_KEY_PROJECTION = { startAt: 1, title: 1 };

function clean(x) {
  return String(x ?? "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Events overlapping the Bangkok day range [fromYmd, toYmd].
 *
 * An event occupies [startAt, endAt ?? startAt]. The second $or branch also
 * rescues rows whose endAt is missing or (through bad data) earlier than
 * startAt: any event STARTING inside the window is in, whatever endAt says.
 */
function eventDateRangeFilter(fromYmd, toYmd) {
  const rangeStart = bangkokDayStartUTC(fromYmd);
  const rangeEnd = bangkokDayEndUTC(toYmd);

  return {
    $and: [
      { startAt: { $lte: rangeEnd } },
      {
        $or: [
          { endAt: { $ne: null, $gte: rangeStart } },
          { startAt: { $gte: rangeStart } },
        ],
      },
    ],
  };
}

/**
 * Deterministic merged ordering: date_start, then class before event, then
 * name, then id. Plain string comparison (not localeCompare) so the JS merge
 * orders Thai titles exactly the way the Mongo sort that produced the window
 * did.
 */
function compareKeys(a, b, dir) {
  if (a.dateStart !== b.dateStart) {
    // A row with no resolvable date sorts last in both directions.
    if (!a.dateStart) return 1;
    if (!b.dateStart) return -1;
    return a.dateStart < b.dateStart ? -dir : dir;
  }
  if (a.type !== b.type) return a.type === TYPE_CLASS ? -1 : 1;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function OPTIONS(req) {
  return corsPreflight(req);
}

export async function GET(req) {
  try {
    await dbConnect();

    // classes.read is the price of admission. A key holding only events.read
    // gets 403 here, not a class-free list.
    const guard = await guardExternalRequest(req, { scope: CLASS_SCOPE });
    if (guard.error) return guard.error;

    const scopes = Array.isArray(guard.keyDoc.scopes) ? guard.keyDoc.scopes : [];
    const mayReadEvents = scopes.includes(EVENT_SCOPE);

    const { searchParams } = new URL(req.url);

    /* ---------------- type + scope ---------------- */

    const type = clean(searchParams.get("type")).toLowerCase() || "all";
    if (!VALID_TYPES.includes(type)) {
      return withCors(
        externalError(400, "bad_request", `type must be one of: ${VALID_TYPES.join(", ")}`),
        guard.cors,
      );
    }

    // Asking for events without the scope is an explicit denial, never a
    // silently empty list.
    if (type === TYPE_EVENT && !mayReadEvents) {
      return withCors(
        externalError(
          403,
          "scope_denied",
          `This API key does not have the "${EVENT_SCOPE}" scope`,
        ),
        guard.cors,
      );
    }

    // What this response can contain: what the key is allowed to see, narrowed
    // by what was asked for. With the default type=all this is simply the
    // key's own reach.
    const includedTypes = [];
    if (type === "all" || type === TYPE_CLASS) includedTypes.push(TYPE_CLASS);
    if ((type === "all" || type === TYPE_EVENT) && mayReadEvents) {
      includedTypes.push(TYPE_EVENT);
    }

    const wantClasses = includedTypes.includes(TYPE_CLASS);
    const wantEvents = includedTypes.includes(TYPE_EVENT);

    /* ---------------- date window ---------------- */

    const date = clean(searchParams.get("date"));
    const from = clean(searchParams.get("from"));
    const to = clean(searchParams.get("to"));

    let fromYmd = "";
    let toYmd = "";

    if (date) {
      if (!isYMD(date)) {
        return withCors(
          externalError(400, "invalid_date", "date must be YYYY-MM-DD"),
          guard.cors,
        );
      }
      fromYmd = date;
      toYmd = date;
    } else if (from || to) {
      fromYmd = from || to;
      toYmd = to || from;
      if (!isYMD(fromYmd) || !isYMD(toYmd)) {
        return withCors(
          externalError(400, "invalid_date", "from/to must be YYYY-MM-DD"),
          guard.cors,
        );
      }
      if (fromYmd > toYmd) {
        return withCors(
          externalError(400, "bad_request", "from must not be after to"),
          guard.cors,
        );
      }
    } else {
      // No filter at all would mean "every class and event ever". Default to
      // today in Bangkok instead - this is a day feed.
      fromYmd = bangkokTodayYMD();
      toYmd = fromYmd;
    }

    /* ---------------- other params ---------------- */

    const q = clean(searchParams.get("q"));
    const sort = clean(searchParams.get("sort")) || "date_asc";
    const dir = sort === "date_desc" ? -1 : 1;
    const includeSignature = searchParams.get("signature") !== "0";

    const limitRaw = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
        : DEFAULT_LIMIT;

    const pageRaw = Number(searchParams.get("page"));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

    const skip = (page - 1) * limit;
    const need = skip + limit;

    /* ---------------- filters ---------------- */

    const classAnd = [classDateRangeFilter(fromYmd, toYmd)];
    const eventAnd = [
      // Only live events. `isActive: { $ne: false }` also covers legacy rows
      // where the field was never written.
      { isActive: { $ne: false } },
      eventDateRangeFilter(fromYmd, toYmd),
    ];

    if (q) {
      const re = new RegExp(escapeRegExp(q), "i");
      classAnd.push({
        $or: [
          { title: re },
          { courseCode: re },
          { courseName: re },
          { customCourseName: re },
          { room: re },
          { "instructors.name": re },
        ],
      });
      eventAnd.push({ $or: [{ title: re }, { location: re }, { note: re }] });
    }

    const classFind = { $and: classAnd };
    const eventFind = { $and: eventAnd };

    /* ---------------- counts + sort-key windows ---------------- */

    const [classTotal, eventTotal] = await Promise.all([
      wantClasses ? Class.countDocuments(classFind) : Promise.resolve(0),
      wantEvents ? Event.countDocuments(eventFind) : Promise.resolve(0),
    ]);

    const total = classTotal + eventTotal;

    const [classKeyDocs, eventKeyDocs] = await Promise.all([
      wantClasses && need > 0
        ? Class.find(classFind, CLASS_KEY_PROJECTION)
            .sort({ date: dir, title: 1, _id: 1 })
            .limit(need)
            .lean()
        : Promise.resolve([]),
      wantEvents && need > 0
        ? Event.find(eventFind, EVENT_KEY_PROJECTION)
            .sort({ startAt: dir, title: 1, _id: 1 })
            .limit(need)
            .lean()
        : Promise.resolve([]),
    ]);

    // Each collection is already in its own sorted order, so the first `need`
    // rows of each are guaranteed to contain the first `need` rows of the
    // merge. Slicing to the page after merging is therefore exact.
    const keys = [];

    for (const doc of classKeyDocs) {
      const dates = datesOf(doc);
      keys.push({
        type: TYPE_CLASS,
        id: String(doc._id),
        dateStart: dates[0] || "",
        name: clean(doc.title),
      });
    }

    for (const doc of eventKeyDocs) {
      keys.push({
        type: TYPE_EVENT,
        id: String(doc._id),
        dateStart: bangkokYMD(doc.startAt),
        name: clean(doc.title),
      });
    }

    keys.sort((a, b) => compareKeys(a, b, dir));
    const pageKeys = keys.slice(skip, skip + limit);

    /* ---------------- hydrate only this page ---------------- */

    const classIds = pageKeys.filter((k) => k.type === TYPE_CLASS).map((k) => k.id);
    const eventIds = pageKeys.filter((k) => k.type === TYPE_EVENT).map((k) => k.id);

    const [classDocs, eventDocs] = await Promise.all([
      classIds.length
        ? Class.find({ _id: { $in: classIds } }, CLASS_PROJECTION).lean()
        : Promise.resolve([]),
      eventIds.length
        ? Event.find({ _id: { $in: eventIds } }, EXTERNAL_EVENT_PROJECTION).lean()
        : Promise.resolve([]),
    ]);

    const classById = new Map(classDocs.map((d) => [String(d._id), d]));
    const eventById = new Map(eventDocs.map((d) => [String(d._id), d]));

    // serializeClasses resolves every instructor for the whole page in one
    // batched pair of queries, so feed it the page as a single array.
    const orderedClassDocs = [];
    const classSlot = new Map();

    pageKeys.forEach((k, i) => {
      if (k.type !== TYPE_CLASS) return;
      const doc = classById.get(k.id);
      if (!doc) return;
      classSlot.set(i, orderedClassDocs.length);
      orderedClassDocs.push(doc);
    });

    const serializedClasses = await serializeClasses(orderedClassDocs, {
      includeSignature,
      baseUrl: externalBaseUrl(),
      keyId: String(guard.keyDoc._id),
    });

    const items = [];

    pageKeys.forEach((k, i) => {
      if (k.type === TYPE_CLASS) {
        const slot = classSlot.get(i);
        if (slot === undefined) return;
        // `type` first, then the class object /classes already returns,
        // verbatim - same serializer, no fork.
        items.push({ type: TYPE_CLASS, ...serializedClasses[slot] });
        return;
      }

      const doc = eventById.get(k.id);
      if (doc) items.push(serializeEvent(doc));
    });

    return withCors(
      NextResponse.json({
        ok: true,
        version: "v1",
        included_types: includedTypes,
        date_from: fromYmd,
        date_to: toYmd,
        count: items.length,
        total,
        page,
        limit,
        items,
      }),
      guard.cors,
    );
  } catch (e) {
    console.error("ext/v1/schedule:", e?.message || e);
    return externalError(500, "server_error", "Internal server error");
  }
}
