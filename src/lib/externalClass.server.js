// src/lib/externalClass.server.js
//
// Serialization for the external (partner) API. This is the ONLY place that
// decides what leaves the building, and it builds each object key by key from
// an explicit allow-list - never by spreading a Mongo document. Student,
// check-in, food and document-receipt data has no path into this file.
import { buildContiguousDaysFromStart, uniqSortYMD, utcDateToYMD } from "@/lib/classDates";
import { displayInstructorName, resolveInstructorMatches } from "@/lib/instructorSignature.server";
import { signSignatureToken } from "@/lib/externalAuth.server";

function clean(x) {
  return String(x ?? "").trim();
}

/* ---------------- query helpers ---------------- */

/**
 * Match classes that teach on any day within [fromYmd, toYmd].
 *
 * Primary path uses the stored days[] (populated on every class today).
 * The fallback covers legacy rows with an empty days[] by deriving the span
 * from `date` + duration.dayCount, mirroring the same precedence the admin API
 * uses for dayCount.
 *
 * Lives here so /classes and /schedule can never drift apart on what "a class
 * happens on this day" means.
 */
export function classDateRangeFilter(fromYmd, toYmd) {
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

/* ---------------- serialization ---------------- */

/** days.length || duration.dayCount || 1 - same precedence as the admin API. */
export function dayCountOf(cls) {
  return (
    (Array.isArray(cls?.days) && cls.days.length) ||
    cls?.duration?.dayCount ||
    cls?.dayCount ||
    1
  );
}

/** Teaching dates: stored days[] when present, else contiguous from `date`. */
export function datesOf(cls) {
  const stored = uniqSortYMD(cls?.days);
  if (stored.length) return stored;

  const startYmd = utcDateToYMD(cls?.date ? new Date(cls.date) : null);
  if (!startYmd) return [];

  return buildContiguousDaysFromStart(startYmd, dayCountOf(cls));
}

/**
 * Resolve every instructor across a whole page of classes in ONE batched pair
 * of queries. Returns a Map keyed by "<classIndex>:<instructorIndex>".
 */
export async function buildInstructorIndex(classes) {
  const flat = [];
  const coords = [];

  (classes || []).forEach((cls, ci) => {
    (Array.isArray(cls?.instructors) ? cls.instructors : []).forEach((ins, ii) => {
      flat.push({ name: ins?.name || "", email: ins?.email || "", code: ins?.code || "" });
      coords.push(`${ci}:${ii}`);
    });
  });

  if (!flat.length) return new Map();

  const matches = await resolveInstructorMatches(flat);

  const map = new Map();
  coords.forEach((coord, i) => map.set(coord, matches[i]));
  return map;
}

function serializeInstructor(match, { includeSignature, baseUrl, keyId }) {
  const nameEn = clean(match?.nameEn);
  const nameTh = clean(match?.nameTh) || clean(match?.name);

  let signatureUrl = null;
  let signatureExpiresAt = null;

  if (includeSignature && match?.signature?.url) {
    const { token, expiresAt } = signSignatureToken({
      url: match.signature.url,
      keyId,
    });
    signatureUrl = `${baseUrl}/api/ext/v1/signature/${token}`;
    signatureExpiresAt = expiresAt;
  }

  return {
    // Display name follows MSDB's own rule: English when present, else Thai.
    name: displayInstructorName({ nameEn, nameTh }),
    name_en: nameEn,
    name_th: nameTh,
    email: clean(match?.email),
    code: clean(match?.code),
    signature_url: signatureUrl,
    signature_expires_at: signatureExpiresAt,
  };
}

/**
 * Build one external class object. Every key is written explicitly.
 */
export function serializeClass(cls, ci, instructorIndex, opts) {
  const dates = datesOf(cls);

  const instructors = (Array.isArray(cls?.instructors) ? cls.instructors : []).map(
    (ins, ii) =>
      serializeInstructor(
        instructorIndex?.get(`${ci}:${ii}`) || {
          nameEn: "",
          nameTh: ins?.name || "",
          email: ins?.email || "",
          code: "",
          signature: null,
        },
        opts,
      ),
  );

  return {
    class_id: String(cls?._id || ""),
    class_name: clean(cls?.title),
    course_code: clean(cls?.courseCode),
    course_name: clean(cls?.courseName) || clean(cls?.customCourseName),
    custom_course_name: clean(cls?.customCourseName),
    day_count: dayCountOf(cls),
    dates,
    date_start: dates[0] || "",
    date_end: dates[dates.length - 1] || "",
    start_time: clean(cls?.duration?.startTime) || "09:00",
    end_time: clean(cls?.duration?.endTime) || "16:00",
    room: clean(cls?.room),
    training_type: clean(cls?.trainingType),
    channel: clean(cls?.channel),
    program: {
      program_id: clean(cls?.program?.program_id),
      program_name: clean(cls?.program?.program_name),
    },
    class_image_url: clean(cls?.classImageUrl),
    instructors,
    updated_at: cls?.updatedAt ? new Date(cls.updatedAt).toISOString() : null,
  };
}

/** Serialize a page of classes, resolving all instructors in one batch. */
export async function serializeClasses(classes, opts) {
  const index = await buildInstructorIndex(classes);
  return (classes || []).map((cls, ci) => serializeClass(cls, ci, index, opts));
}
