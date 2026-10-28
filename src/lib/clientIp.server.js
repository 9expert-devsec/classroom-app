// src/lib/clientIp.server.js
//
// PIN-P2a: the one trusted client-IP helper (moved out of externalAuth.server.js
// so rate limits and audit logs can use it without pulling in the API-key
// model). No imports - safe to use from any route.

function clean(x) {
  return String(x ?? "").trim();
}

/**
 * Client IP, resolved in trust order. Returns "" when no TRUSTED source yields
 * an address - callers must treat "" as "unknown", never as "allowed".
 *
 * Why not x-forwarded-for[0]: on Vercel a caller may send their own
 * x-forwarded-for and the platform APPENDS the real client IP to it, so entry
 * [0] is attacker-supplied. It is only trustworthy when nothing upstream can
 * inject it, i.e. local development.
 *
 *   1. x-vercel-forwarded-for - set by Vercel's edge, not client-settable
 *   2. req.ip                 - populated by the runtime, when available
 *   3. x-real-ip              - set by the platform/reverse proxy
 *   4. x-forwarded-for[0]     - LOCAL DEV ONLY, gated on !process.env.VERCEL
 */
export function clientIpFrom(req) {
  const vercelFwd = clean(req?.headers?.get?.("x-vercel-forwarded-for"));
  if (vercelFwd) return clean(vercelFwd.split(",")[0]);

  const runtimeIp = clean(req?.ip);
  if (runtimeIp) return runtimeIp;

  const realIp = clean(req?.headers?.get?.("x-real-ip"));
  if (realIp) return realIp;

  // Spoofable. Never consulted on Vercel.
  if (!clean(process.env.VERCEL)) {
    const fwd = clean(req?.headers?.get?.("x-forwarded-for"));
    if (fwd) return clean(fwd.split(",")[0]);
  }

  return "";
}
