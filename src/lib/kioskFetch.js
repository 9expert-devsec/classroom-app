// src/lib/kioskFetch.js
//
// fetch() for /classroom pages (L2a). When the kiosk session is gone
// (401 { reason: "kiosk_required" }) the tablet goes back to the kiosk login
// page and comes back here afterwards. Any other response is returned as-is.
export async function kioskFetch(input, init) {
  const res = await fetch(input, init);
  if (res.status !== 401 || typeof window === "undefined") return res;

  let reason = "";
  try {
    reason = (await res.clone().json())?.reason || "";
  } catch {
    reason = "";
  }
  if (reason !== "kiosk_required") return res;

  const here = window.location.pathname + window.location.search;
  window.location.assign(`/classroom/login?next=${encodeURIComponent(here)}`);

  // the page is navigating away: never settle, so the caller does not flash an
  // error message in the meantime
  return new Promise(() => {});
}
