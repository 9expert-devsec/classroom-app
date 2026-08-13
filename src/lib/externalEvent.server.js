// src/lib/externalEvent.server.js
//
// Serialization for Event documents on the external (partner) API. Same rule
// as externalClass.server.js: every key is written out explicitly from an
// allow-list, never by spreading a Mongo document. EventAttendee is not
// imported here and must never be - no attendee, check-in or contact data has
// any path into this file.
//
// coverImagePublicId is deliberately absent: it is a Cloudinary handle that
// would let a partner address the asset directly, so only coverImageUrl leaves.
import { bangkokHM, bangkokYMD, expandEventDays } from "@/lib/classDates";

function clean(x) {
  return String(x ?? "").trim();
}

// Bangkok midnight means "this event has a date but no meaningful clock time"
// (an all-day entry). Reporting "00:00" would make partners render a 12am slot
// that does not exist in the source data.
const NO_CLOCK = "00:00";

function wallTimeOf(instant) {
  const hm = bangkokHM(instant);
  return !hm || hm === NO_CLOCK ? "" : hm;
}

/**
 * Build one external event object.
 *
 * day_count / dates / date_start / date_end / start_time / end_time are shaped
 * to match the class object exactly, so a partner can render a combined day
 * view from those six fields without branching on `type`.
 */
export function serializeEvent(ev) {
  const dates = expandEventDays(ev?.startAt, ev?.endAt);

  // endAt is nullable: a one-shot event has a start and nothing else.
  const endTime = ev?.endAt ? wallTimeOf(ev.endAt) : "";

  return {
    type: "event",
    event_id: String(ev?._id || ""),
    title: clean(ev?.title),
    location: clean(ev?.location),
    note: clean(ev?.note),
    day_count: dates.length || 1,
    dates,
    date_start: dates[0] || "",
    date_end: dates[dates.length - 1] || "",
    start_time: wallTimeOf(ev?.startAt),
    end_time: endTime,
    cover_image_url: clean(ev?.coverImageUrl),
    updated_at: ev?.updatedAt ? new Date(ev.updatedAt).toISOString() : null,
  };
}

/** Sort key for the merged feed: the event's first Bangkok day. */
export function eventDateStart(ev) {
  return bangkokYMD(ev?.startAt);
}

/** Mongo projection: the only Event fields the external API is allowed to read. */
export const EXTERNAL_EVENT_PROJECTION = {
  title: 1,
  location: 1,
  note: 1,
  startAt: 1,
  endAt: 1,
  coverImageUrl: 1,
  updatedAt: 1,
};
