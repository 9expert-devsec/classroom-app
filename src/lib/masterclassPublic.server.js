// src/lib/masterclassPublic.server.js
//
// Shape a Masterclass Class document for the learner-facing screens.
// Shared by /api/classroom/masterclass/list and /api/classroom/masterclass/class
// so the card list and the check-in header can never disagree about a class.

import { getDayCountFromClassDoc } from "@/lib/classDates";

/** Fields both endpoints need from Class, plus the populated course. */
export const MASTERCLASS_CLASS_SELECT =
  "title courseName courseCode classImageUrl room date days dayCount duration classKind masterclassCourseId";

/** Fields we pull off the linked MasterclassCourse. */
export const MASTERCLASS_COURSE_SELECT = "courseId name coverImageUrl";

function clean(x) {
  return String(x ?? "").trim();
}

/**
 * @param {object} cls   lean Class doc with masterclassCourseId populated
 * @param {number|null} dayIndexToday  1-based training day, or null
 */
export function buildMasterclassCard(cls, dayIndexToday = null) {
  if (!cls) return null;

  // populate() leaves a bare ObjectId when the course was deleted; guard for it.
  const course =
    cls.masterclassCourseId && typeof cls.masterclassCourseId === "object"
      ? cls.masterclassCourseId
      : null;

  return {
    _id: String(cls._id),
    title: clean(cls.title),

    // course name is the headline on the card; fall back to the snapshot the
    // class was created with so a deleted course still renders something.
    courseName: clean(course?.name) || clean(cls.courseName) || clean(cls.title),
    courseId: clean(course?.courseId) || clean(cls.courseCode),

    coverImageUrl: clean(course?.coverImageUrl),
    classImageUrl: clean(cls.classImageUrl),

    // venue - stored in the existing room field
    room: clean(cls.room),

    days: Array.isArray(cls.days) ? cls.days.map(String) : [],
    dayCount: getDayCountFromClassDoc(cls),
    dayIndexToday: dayIndexToday ?? null,

    startTime: clean(cls.duration?.startTime),
    endTime: clean(cls.duration?.endTime),
  };
}

/** Sort by start time, then title. Blank start times sort last. */
export function compareMasterclassCards(a, b) {
  const at = a?.startTime || "99:99";
  const bt = b?.startTime || "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""));
}
