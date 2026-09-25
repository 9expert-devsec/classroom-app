// src/lib/kioskFetch.js
//
// fetch() for /classroom pages (L2a). When the kiosk session is gone
// (401 { reason: "kiosk_required" }) the tablet goes back to the kiosk login
// page and comes back here afterwards.
//
// L2b: when the staff step-up has closed (403 { reason:
// "staff_unlock_required" }) it only tells StaffGate (KIOSK_STAFF_LOCKED_EVENT)
// so the unlock panel comes back - no redirect. That response is returned
// as-is. Any other response is returned as-is too.
export const KIOSK_STAFF_LOCKED_EVENT = "kiosk:staff-locked";

async function reasonOf(res) {
  try {
    return (await res.clone().json())?.reason || "";
  } catch {
    return "";
  }
}

export async function kioskFetch(input, init) {
  const res = await fetch(input, init);
  if (typeof window === "undefined") return res;
  if (res.status !== 401 && res.status !== 403) return res;

  const reason = await reasonOf(res);

  if (res.status === 403) {
    if (reason === "staff_unlock_required") {
      window.dispatchEvent(new Event(KIOSK_STAFF_LOCKED_EVENT));
    }
    return res;
  }

  if (reason !== "kiosk_required") return res;

  const here = window.location.pathname + window.location.search;
  window.location.assign(`/classroom/login?next=${encodeURIComponent(here)}`);

  // the page is navigating away: never settle, so the caller does not flash an
  // error message in the meantime
  return new Promise(() => {});
}
